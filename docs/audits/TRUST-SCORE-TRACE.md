# Truy vết Trust Score từ đầu đến cuối (P0.1 và P0.2)

Trạng thái: **chỉ đọc. Chưa sửa code, SQL hay cấu hình; chưa commit.** Viết 2026-10-11. Cơ sở mã: `main` @ `4c3b962`.
Nhãn: **[CODE]** đọc trong mã · **[DB-2026-10-09]** số liệu catalog/đếm do chủ sản phẩm lấy ngày 2026-10-09 (không phải tôi lấy, đã cũ) · **[UNKNOWN]** không xác định được từ repo; cần truy vấn chỉ-đọc trên database.

## 1. Sơ đồ luồng (theo bằng chứng)

```
ATS (40%)        resume_scans.credibility_score ──┐
Interview (35%)  mock_sessions.avg_score ─────────┼─► trigger recompute_trust_score ─► candidate_trust_profiles
STAR (25%)       star_stories.score ──────────────┘   (thân hàm nằm trong DB, không có trong repo)      │
                                                                                   ┌───────────────────┼─────────────────────┐
                                                                                   ▼                   ▼                     ▼
                                                                  Dashboard, Career Roadmap     Employer Portal         (nhà tuyển dụng đã
                                                                  ("Practice score")             (chế độ cũ đọc trực      xác minh, theo RLS)
                                                                                                 tiếp bảng)
```

## 2. Từng thành phần

| Thành phần | Ai ghi dữ liệu nguồn | Bằng chứng | Kết luận |
|---|---|---|---|
| **ATS 40%** | **Không có ai ghi (live writer) trong mã.** `resume_scans` chỉ được **đọc** (`useMemory.js:62`) hoặc nằm trong danh sách xóa (`MemoryDashboard.jsx:82`). `buildScanRecord` (`atsBuilderUtils.js`) chỉ được định nghĩa, **không có chỗ gọi** ngoài test. Không có Edge Function nào ghi bảng này. `scanHistory` cũng không được ghi ở đâu ngoài việc xóa/reset | [CODE] | Điểm **ATS Readiness do code tính** chỉ nằm trong state của màn ATS Builder (`detResult`), **không được lưu vào memory hay database** và **không đi vào Trust Score** |
| **Interview 35%** | `score-interview` ghi `mock_sessions` bằng service role, `avg_score` tính từ các điểm đã ký. Điểm từng câu do **mô hình AI đặt** | [CODE] | Nguyên liệu là điểm AI |
| **STAR 25%** | `score-star` ghi `star_stories`. Điểm từng phần do **AI chấm**, tổng do code tính từ đó | [CODE] | Nguyên liệu là điểm AI |
| **Công thức** | Trigger `recompute_trust_score` trong database: ATS = `MAX(resume_scans.credibility_score)`, Interview = trung bình 5 phiên gần nhất, STAR = trung bình 5 câu chuyện gần nhất, thiếu dữ liệu = **0**, Trust = `ROUND(ATS×0.40 + Interview×0.35 + STAR×0.25)` | [DB-2026-10-09] (`EVIDENCE_RESULTS`); thân hàm **không có trong repo** | Cần xác nhận lại bằng truy vấn chỉ-đọc nếu muốn chắc nó chưa đổi |

## 3. Hệ quả đã xác minh trong mã

1. **Thiếu dữ liệu bị biến thành số 0.** Theo công thức trên, một người dùng chưa có `resume_scans` có ATS = **0** (không phải "chưa có điểm"). Trust Score = 0,35×Interview + 0,25×STAR, tối đa **60** khi hai thành phần kia đạt 100. Đây chính là lỗi thiết kế mà nhận xét đã cảnh báo: `0` (điểm thật bằng 0), `null` (chưa có), `insufficient_evidence`, `failed` bị gộp thành một.
2. **Với người dùng mới, 100% Trust Score đến từ điểm do AI đặt** (35% phỏng vấn + 25% STAR), vì thành phần ATS không có nguồn mới.
3. **Điểm ATS cũ chỉ tồn tại ở các dòng `resume_scans` lịch sử** (ghi trước khi các luồng quét cũ bị gỡ). Theo [DB-2026-10-09]: 5 dòng, mới nhất 2026-05-22. Người dùng có dòng cũ vẫn có ATS cũ do **luồng quét cũ do mô hình AI chấm** trong Trust Score.
4. **Người dùng thấy gì:** Dashboard và Career Roadmap hiển thị con số này dưới nhãn **"Practice score"** ("From your practice", mốc "Practice score 65+"). Nhãn đó khá trung thực về bản chất luyện tập.
5. **Nhà tuyển dụng thấy gì (khi bật):** Employer Portal, ở chế độ **không consent** (mặc định, khi cờ consent tắt), chạy `sb.select('candidate_trust_profiles', { is_visible: 'eq.true', order: 'trust_score.desc' })` và hiển thị `trust`, `ats`, `interview` là số, và `star` thành nhãn Strong/Good/Developing (`EmployerPortal.jsx:790`, `mapCandidate`). Cơ sở dữ liệu giới hạn chỉ **nhà tuyển dụng đã xác minh** mới đọc được (theo chính sách). Chế độ consent (`employer_view_candidates`) có sẵn nhưng là chế độ có cờ, **không đọc `candidate_trust_profiles`** và không hiển thị điểm luyện tập.
6. **Số người bị ảnh hưởng hiện tại [DB-2026-10-09, cũ]:** 0 nhà tuyển dụng đã xác minh, 1 hồ sơ hiển thị, 0 consent. Nghĩa là **hiện chưa có ai ngoài chủ hồ sơ nhìn thấy các điểm này**. Con số có thể đã đổi sau ngày đó **[UNKNOWN]**.

## 4. Những gì chưa xác minh được, và cần gì để xác minh

| Câu hỏi | Vì sao chưa trả lời | Cần gì |
|---|---|---|
| Thân hàm `recompute_trust_score` hiện hành có đúng như bản ghi 2026-10-09? | Hàm nằm trong DB, repo chỉ có ảnh chụp tài liệu | Truy vấn chỉ-đọc `pg_get_functiondef` (chủ sản phẩm chạy, như các lần trước) |
| Hiện có bao nhiêu nhà tuyển dụng đã xác minh, hồ sơ hiển thị, consent? | Số liệu ngày 2026-10-09 | Chạy lại truy vấn đếm chỉ-đọc ở `PRODUCTION_APPLY_PLAN.md` mục 2 |
| Còn dòng `resume_scans` nào, của ai, điểm bao nhiêu? | Không đọc được dữ liệu từ repo | Truy vấn đếm chỉ-đọc, **không** lấy nội dung cá nhân |
| Chế độ consent đang bật hay tắt ở build đang chạy? | Cờ là biến build | Kiểm tra cấu hình build/biến môi trường của bản đang deploy |
| "Resume Readiness Score" có hiển thị gì cho người dùng mới? | Chưa lần hết `effectiveResult` | Đọc tiếp mã, chỉ đọc |

## 5. Điều đề xuất cho P0.3 (kiểm soát việc dùng điểm chưa xác thực), chưa thực hiện

Mọi thay đổi dưới đây **cần chủ sản phẩm duyệt**; không có gì được làm ở đây.

1. **Giữ chế độ consent tắt cho tới khi** các điểm luyện tập không còn vào kết quả nhà tuyển dụng thấy, và **không bật Employer Portal chế độ cũ** cho nhà tuyển dụng thật. Hiện không có nhà tuyển dụng xác minh nên rủi ro đang ở mức tiềm năng, không phải đang xảy ra (theo số liệu cũ).
2. **Không sửa công thức, không xóa cột, không chuyển dữ liệu** trước khi có quyết định sản phẩm: sản phẩm có cần **một điểm Trust tổng hợp** không, và nếu có thì nó biểu diễn điều gì.
3. **Khi sửa, dùng bốn trạng thái khác nhau** thay vì 0: điểm thật bằng 0, `null` (chưa có), `insufficient_evidence`, `failed`.
4. Đã có ADR-012 ghi: tuyên bố kiểm soát truy cập nhà tuyển dụng phải chờ cơ chế chỉ-đọc-khi-có-consent được triển khai và kiểm thử.

## 6. P0.2 khép kín (đọc thêm trong mã, 2026-10-11)

1. **"Resume Readiness Score" không có luồng nào còn nạp dữ liệu.** `ReadinessScore.jsx` đọc `scanResult` (prop) hoặc `memory.scanHistory[0].result.credibilityScore`. Prop `scanResult` lấy từ `memory.scanResult` (`App.jsx:118`); hàm `setScanResult` chỉ được **định nghĩa và truyền xuống** (`App.jsx:125, 297`), **không có chỗ nào gọi** [CODE: grep]. `scanHistory` cũng không có nơi ghi. Hệ quả: với người dùng mới, trang này luôn hiện "No readiness score yet. Scan your resume to get a score", nhưng **không có thao tác "quét" nào còn tạo ra giá trị đó**. Chỉ người dùng có dữ liệu cũ đã lưu mới thấy điểm. Đây là một lỗi sản phẩm, không chỉ là vấn đề dữ liệu.
2. **Cùng nguồn trống** cho ô ATS trên Dashboard (`Dashboard.jsx:226`), `CareerRoadmap.jsx:77` và lịch sử quét trong AI Memory.
3. **Nơi đọc `candidate_trust_profiles` trong ứng dụng** [CODE]: Dashboard ("Practice Score"), Career Roadmap ("Practice score 65+"), Employer Portal chế độ cũ (`EmployerPortal.jsx:790`). Không còn nơi đọc nào khác trong `src`.
4. **Cờ consent:** `consentFlowEnabled()` đọc `VITE_CONSENT_FLOW === 'true'` lúc **build** (`consent.js:15`). Trong repo không có `ARG`/`ENV` nào trong `Dockerfile` cho biến này và không có trong `.env.example` hay `docker-compose.yml`, nên mặc định build là **tắt**. Có thể có tệp `.env` lúc build khiến nó khác đi: **[UNKNOWN]**.
5. **Chế độ consent vẫn cần kiểm tra ở tầng database** (chính sách RLS thực tế), vì nó chỉ chứng minh rằng ứng dụng không đọc bảng trực tiếp, chưa chứng minh rằng bảng được bảo vệ.

## 7. Gói xác minh chỉ-đọc cho database (P0.1), chạy từng bước

Mỗi bước là một truy vấn `select` do chủ sản phẩm chạy trong `~/supabase-baseline` (đã link tới dự án CareerAiHub; luôn kiểm tra mã dự án trước, **không** phải dự án ZenDMS). Không lấy CV, tên hay nội dung.

| Bước | Hỏi gì | Dạng truy vấn |
|---|---|---|
| 1 | Định nghĩa hiện hành của `recompute_trust_score` | `pg_get_functiondef` |
| 2 | Trigger nào gắn trên `resume_scans`, `mock_sessions`, `star_stories` | `pg_trigger` |
| 3 | Số lượng: nhà tuyển dụng đã xác minh, hồ sơ hiển thị, consent còn hiệu lực | các `count(*)` |
| 4 | Số dòng `resume_scans` và ngày mới nhất, **không** lấy `user_id` hay nội dung | `count(*)`, `max(created_at)` |
| 5 | Chính sách RLS đang áp dụng trên `candidate_trust_profiles` | `pg_policies` |

## 8. Kết quả xác minh chỉ-đọc trên database (P0.1), đọc 2026-10-11

Nguồn: bốn truy vấn `select` do chủ sản phẩm chạy trong dự án `ruibdsvrcctxgxctaxwe` (mã dự án đã đối chiếu), kết quả ghi ra tệp ngoài repo và được trợ lý đọc. Nhãn **[DB-2026-10-11]**. Không lấy CV, tên hay nội dung nào.

| Câu hỏi | Kết quả [DB-2026-10-11] | Ý nghĩa |
|---|---|---|
| Định nghĩa `recompute_trust_score` | Khớp bản ghi 2026-10-09: ATS = `COALESCE(MAX(credibility_score),0)` (chú thích ghi "Latest" nhưng dùng `MAX`), Interview = trung bình 5 phiên gần nhất, STAR = trung bình 5 câu gần nhất, **thiếu dữ liệu = 0**, Trust = `ROUND(ATS×0.40 + Interview×0.35 + STAR×0.25)`. `SECURITY DEFINER` | **Xác nhận ở tầng DB** việc thiếu dữ liệu bị thành 0 |
| Trigger | `mock_sessions`, `resume_scans`, `star_stories` mỗi bảng có trigger AFTER INSERT/UPDATE và trigger AFTER DELETE; `candidate_trust_profiles` có `trg_lock_trust_columns` (BEFORE INSERT/UPDATE) | Khớp với các bước S1 đã áp dụng |
| Số nhà tuyển dụng đã xác minh | **0** | |
| Hồ sơ | **6** hồ sơ, trong đó **1** hiển thị (`is_visible`) | |
| Consent | **0** tổng, **0** còn hiệu lực | |
| `resume_scans` | **5** dòng, mới nhất **2026-05-22** | Không có dòng mới trong gần 5 tháng, khớp việc không còn nơi ghi |
| RLS `candidate_trust_profiles` | Chủ hồ sơ: `ALL` khi `auth.uid() = user_id`. Nhà tuyển dụng: `SELECT` khi `is_visible = true AND is_verified_employer_member()` | Chỉ thành viên của nhà tuyển dụng đã xác minh mới đọc được hồ sơ hiển thị |
| RLS ba bảng nguồn | Chủ sở hữu: `ALL` theo `auth.uid() = user_id` (quyền ghi INSERT/UPDATE đã bị thu hồi ở mức đặc quyền theo SQL S4 đã áp dụng; `pg_policies` không hiển thị đặc quyền) | |

### Kết luận (mức phơi nhiễm hiện tại)

1. **Hôm nay, nhà tuyển dụng không đọc được điểm nào**, vì **không có nhà tuyển dụng nào đã xác minh** (0), và chính sách chỉ cho thành viên của nhà tuyển dụng đã xác minh đọc. Đây là kết luận **dựa trên số đếm của hôm nay**, cộng với giả định rằng hàm `is_verified_employer_member()` đúng như tên gọi và người dùng thường không tự xác minh được (SQL `lock_employer_verification` có trong repo nhằm chặn việc đó). **Thân hàm `is_verified_employer_member()` đã được đọc ở cuối mục này.**
2. **Rủi ro chuyển từ tiềm ẩn sang thật vào lúc nhà tuyển dụng đầu tiên được xác minh.** Khi đó, nếu Employer Portal chạy chế độ cũ (cờ consent tắt mặc định), nhà tuyển dụng đó sẽ thấy `trust`, `ats`, `interview` của 1 hồ sơ hiển thị, trong đó 60% từ điểm do AI đặt, và ATS bằng 0 hoặc lấy từ bản quét cũ.
3. **Quy tắc an toàn đề xuất, cần chủ sản phẩm duyệt:** **không xác minh nhà tuyển dụng nào** cho tới khi một trong hai điều kiện được đáp ứng: (a) chế độ consent đã được bật và kiểm thử đúng như ADR-012, hoặc (b) chủ sản phẩm quyết định rõ điểm nào được hiển thị cho nhà tuyển dụng.
4. **Còn mở:** chính sách ghi của `employer_members` (xem bên dưới); cờ consent của bản đang chạy; quyết định sản phẩm về Trust Score tổng hợp.

### Quyết định của chủ sản phẩm (2026-10-11, "ok")

**Không xác minh nhà tuyển dụng nào** (không đặt `verified_at` cho bất kỳ `employers` nào) cho đến khi: (a) chế độ consent đã được bật và kiểm thử đúng như ADR-012, hoặc (b) chủ sản phẩm quyết định rõ bằng văn bản điểm nào được hiển thị cho nhà tuyển dụng. Quyết định này chưa nằm trong `DECISIONS.md`; sẽ ghi thành ADR khi chủ sản phẩm yêu cầu.

### Hàm `is_verified_employer_member(p_employer_id uuid default null)` [DB-2026-10-11]

`SECURITY DEFINER`, `STABLE`, `search_path = public, pg_temp`. Trả về `true` khi **tồn tại** một dòng `employers` có `verified_at is not null` (và đúng `p_employer_id` nếu được truyền) mà người gọi (`auth.uid()`) là **chủ** (`owner_id`) hoặc có một dòng trong `employer_members` của nhà tuyển dụng đó.

Hệ quả: với **0 nhà tuyển dụng đã xác minh**, hàm trả `false` cho mọi người, nên chính sách "recruiters can read visible profiles" không cho ai đọc. **Đã xác minh ở tầng database cho hôm nay.**

Điều chưa biết, cần một truy vấn chỉ-đọc nữa: **ai được thêm mình vào `employer_members`?** Nếu một người dùng bất kỳ có thể tự chèn dòng vào `employer_members` của một nhà tuyển dụng **đã xác minh**, thì ngay khi có nhà tuyển dụng đầu tiên được xác minh, người đó cũng đọc được hồ sơ. Chính sách RLS và đặc quyền của `employer_members` chưa được đọc: **[UNKNOWN]**. Việc `lock_employer_verification` chặn người dùng tự đặt `verified_at` đã có trong SQL của repo, nhưng chưa được đối chiếu với catalog hôm nay.

### Chính sách của `employers` và `employer_members` [DB-2026-10-11]

| Bảng | Chính sách | Ý nghĩa |
|---|---|---|
| `employer_members` | `ALL` "employer owner can manage members": điều kiện là tồn tại `employers` với `id = employer_id` **và** `owner_id = auth.uid()`; không có `WITH_CHECK` riêng nên điều kiện này cũng áp dụng khi chèn | Chỉ **chủ** của một nhà tuyển dụng mới thêm, sửa, xóa được thành viên của nhà tuyển dụng đó |
| `employer_members` | `SELECT` "member can read own membership": `auth.uid() = user_id` | Người dùng chỉ thấy dòng thành viên của chính mình |
| `employers` | `ALL` "owner full access": `auth.uid() = owner_id` | Chủ toàn quyền trên nhà tuyển dụng của mình (kể cả tạo mới) |

Quyền ở mức bảng (đặc quyền) của `anon` và `authenticated` trên hai bảng đều ở mức mặc định rộng của Supabase; RLS là lớp giới hạn thực tế. Không có đặc quyền nào bị thu hồi trên hai bảng này.

### Kết luận P0.1 (đã khép kín, trừ một mục)

1. **Một người dùng bất kỳ không thể tự thêm mình vào một nhà tuyển dụng đã xác minh của người khác**, vì thêm thành viên đòi hỏi là chủ của nhà tuyển dụng đó [DB-2026-10-11].
2. **Một người dùng tạo nhà tuyển dụng của riêng mình được phép** (ứng dụng làm đúng việc này), nhưng nhà tuyển dụng đó **không được xác minh** vì `verified_at` không đặt được từ trình duyệt: có trigger `lock_employer_verification` trên INSERT và UPDATE [DB-2026-10-09, `EVIDENCE_RESULTS` dòng 7; **chưa đọc lại trong catalog hôm nay**] và `verified_at` chỉ được đặt bởi quản trị viên trong SQL Editor (`docs/database/README.md`).
3. **Vì vậy, con đường để một người đọc được điểm Trust Score hiện đòi hỏi một hành động thủ công của chủ sản phẩm:** đặt `verified_at` cho một nhà tuyển dụng. Quy tắc "chưa xác minh nhà tuyển dụng nào" chặn đúng điểm này.
4. **Khi bạn xác minh một nhà tuyển dụng**, chủ và các thành viên mà **chủ đó thêm** sẽ đọc được mọi hồ sơ hiển thị (hiện 1 trong 6), gồm `trust_score`, `ats_score`, `interview_score`, `star_score`, bất kể consent.
5. **Còn mở:** cờ consent của bản đang chạy (cấu hình build) và việc đọc lại trigger `lock_employer_verification` trong catalog hôm nay.
