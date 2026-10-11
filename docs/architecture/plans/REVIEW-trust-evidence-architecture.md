# Rà soát kiến trúc: Trust, bằng chứng, điểm luyện tập, quyền truy cập của nhà tuyển dụng

Trạng thái: **PROPOSED, NOT APPROVED. Chỉ kiểm tra và đề xuất. Không code, không SQL, không migration, không commit, không deploy, không đổi cấu hình hay cờ.**
Viết 2026-10-11 cho chủ sản phẩm (Ivy). Cơ sở: `main` @ `4c3b962`; kết quả truy vấn chỉ-đọc database do chủ sản phẩm chạy ngày 2026-10-11 (dự án `ruibdsvrcctxgxctaxwe`).
Tài liệu nguồn: `docs/audits/TRUST-SCORE-TRACE.md`, `docs/audits/AI-ROLE-AUDIT.md`, `docs/architecture/plans/DECISION-trust-score.md`, `CONSENT-FLOW-DESIGN.md`, `ACCEPTANCE-deterministic-practice-scores.md`, ADR-003, 007, 011, 012.

Nhãn: **VERIFIED** (đọc trong mã, tài liệu của repo hoặc kết quả database hôm nay, có nguồn) · **INFERENCE** (suy ra từ bằng chứng) · **PROPOSED** (đề xuất, chưa duyệt) · **UNKNOWN** (cần xác minh từ bên ngoài).

---

## A. Khuyến nghị tóm tắt

| Câu | Khuyến nghị (PROPOSED) |
|---|---|
| **Q-A** thay Trust Score bằng gì | **A1: bỏ điểm tổng hợp** khỏi mọi bề mặt nhà tuyển dụng; **không** tạo điểm 0–100 mới. Với nhà tuyển dụng chỉ hiện **thông tin ứng viên cho phép chia sẻ** và, nếu cần, một **danh sách mức bao phủ bằng chứng không có điểm số** (ví dụ "đã có mục kinh nghiệm, học vấn, kỹ năng; số bullet có số liệu: 3/7"). Chỉ báo dành cho ứng viên: số hoạt động chuẩn bị (Q-E), không gọi là sẵn sàng hay năng lực. A4 bị loại. |
| **Q-B** chia sẻ điểm luyện tập | **B1: không bao giờ chia sẻ** ở giai đoạn này. B2/B3 chỉ thiết kế lại khi có nhu cầu thật và sau khi Structure Score qua cổng hiệu chỉnh |
| **Q-C** trạng thái điểm | Giữ đúng **bốn `status`** đã có trong `structure/contract.js`: `scored`, `insufficient_data`, `unsupported_language`, `processing_error`; `score` chỉ có số khi `scored`. **Không thêm** `insufficient_evidence` hay cột `reason` riêng cho tới khi một chỉ số cụ thể cần. "Chưa có kết quả" là **không có bản ghi**, không phải một giá trị. Không tự tính lại trọng số |
| **Q-D** dữ liệu cũ | Giữ nguyên và đọc được; coi là **"ước tính AI trước đây"**; **loại khỏi mọi phép tổng hợp mới**. Dùng cột nguồn gốc **đã có** trên `resume_scans` (xem mục D), không so sánh chuỗi phiên bản. Không xóa, không gắn nhãn lại trong im lặng |
| **Q-E** thay điểm gây hiểu nhầm trên dashboard | Dùng **số đếm hoạt động** với tử số và mẫu số rõ ràng (mục E). Không dùng "Metric Density" |
| **Cổng bảo mật** | **Không thể bật quyền truy cập của nhà tuyển dụng một cách an toàn hôm nay.** Giữ nguyên quy tắc "chưa xác minh nhà tuyển dụng nào" (mục C) |
| **Lời hứa sản phẩm** | CareerAiHub hiện chỉ có thể hứa **giúp nhà tuyển dụng nhìn rõ hơn những bằng chứng do ứng viên cung cấp**, không hứa **xác minh năng lực** (mục I) |

---

## B. Ma trận quyết định

### Q-A

| Lựa chọn | Đo cái gì | Tính tất định được? | Dữ liệu đầu vào đủ tin cậy? | Rủi ro gây hiểu nhầm | Cần bằng chứng gì trước khi phát hành | Chi phí | Kết luận |
|---|---|---|---|---|---|---|---|
| **A1 bỏ điểm tổng** | Không tuyên bố gì | n/a | n/a | Thấp nhất | Không | Nhỏ: bỏ khỏi giao diện nhà tuyển dụng; đổi Dashboard/Roadmap | **Khuyến nghị** |
| **A2 mức bao phủ bằng chứng** | Có những mục nào, bao nhiêu sự kiện có bằng chứng trong nguồn | Một phần: có (`extractResumeFacts`, `sectionReport`); nhưng bộ đọc còn lỗ hổng với bảng/biểu tượng | Có điều kiện: phụ thuộc chất lượng đọc CV (cổng reader chưa đạt) | Trung bình: dễ bị đọc thành "chất lượng" | Cổng reader đạt; mô tả rõ "đã thấy trong CV", không phải "đúng" | Trung bình | **Chỉ dạng danh sách không điểm số**, sau khi reader đạt cổng |
| **A3 chuẩn bị/sẵn sàng cho ứng viên** | Hoạt động chuẩn bị | Có (đếm) | Có | Cao nếu gọi là "sẵn sàng" | Không cần nếu chỉ đếm hoạt động | Nhỏ | **Chỉ như số đếm hoạt động (Q-E)** |
| **A4 giữ công thức cũ** | Trộn ATS cũ, điểm AI, 0 cho thiếu | Một phần (phép tính) | **Không** (60% điểm AI; ATS không có nguồn ghi sống) | Cao | Không thể đủ | Không | **Loại** |

Phân biệt sáu khái niệm (không thay thế được nhau) và hệ thống hiện hỗ trợ đến đâu:

| Khái niệm | Hệ thống hiện có thể hỗ trợ? | Căn cứ |
|---|---|---|
| Evidence coverage (đã thấy gì trong nguồn) | Một phần | `extractResumeFacts` có `evidence` cho từng sự kiện [VERIFIED `contracts/resumeFacts.js`] |
| Verification status (đã đối chiếu nguồn độc lập) | **Không**, ngoại trừ `verify-cert` kiểm tra liên kết chứng chỉ với danh sách ngắn nhà cấp | `verify-cert`, [VERIFIED trong CLAUDE.md] |
| Evidence credibility (độ tin cậy của bằng chứng) | Không | Chưa có phương pháp |
| Demonstrated competency | Không | Điểm AI chưa hiệu chỉnh; Structure Score chỉ đo hình thức |
| Preparation activity | Có | Đếm bản ghi |
| Job readiness | Không | Không có thước đo |

### Q-B

| Lựa chọn | Kết luận |
|---|---|
| **B1 không chia sẻ** | **Khuyến nghị.** Khớp màn consent (`NOT_SHARED` gồm "Practice scores") [VERIFIED `consent.js:13`]. Ứng viên vẫn có thể quan tâm/ứng tuyển mà không chia sẻ dữ liệu luyện tập |
| **B2 chia sẻ có phạm vi, thu hồi được** | Hoãn. Nếu sau này làm: phạm vi consent theo **nhà tuyển dụng + tin tuyển dụng** (không theo cả nhà tuyển dụng); trường được tiết lộ liệt kê cụ thể; **không** có câu trả lời thô, bản ghi, hoặc phản hồi AI; có hạn; thu hồi có hiệu lực ở yêu cầu kế tiếp; ép buộc ở **cả database (RPC/RLS), API và giao diện**; nhật ký kiểm toán; test âm tính (mục F) |
| **B3 chỉ chia sẻ bản tóm tắt ứng viên duyệt** | Hoãn; cùng điều kiện như B2, thêm yêu cầu ứng viên xem đúng nội dung sẽ gửi trước khi gửi |

### Q-C, Q-D, Q-E: xem các mục tương ứng dưới đây.

---

## C. Phát hiện về luồng dữ liệu và kiểm soát truy cập

**Đường dữ liệu đầy đủ** (`Nguồn → Tính → Lưu → Truy vấn → Phân quyền → Giao diện → Tuyên bố`):

| Thành phần | Nguồn | Tính | Lưu | Truy vấn | Phân quyền | Giao diện | Tuyên bố sản phẩm |
|---|---|---|---|---|---|---|---|
| Interview 35% | câu trả lời của người dùng | **AI đặt điểm**; code kẹp và trung bình (`interviewScoring.js`) | `mock_sessions.avg_score` bằng service role qua `score-interview` | trigger `recompute_trust_score` | RLS chủ sở hữu | Dashboard "Practice Score"; Employer Portal `interview` (đường cũ) | "Practice score" (ứng viên); số `interview` (nhà tuyển dụng, đường cũ) |
| STAR 25% | câu chuyện STAR | **AI chấm từng phần**; code tính tổng | `star_stories.score` qua `score-star` | như trên | như trên | như trên | như trên |
| ATS 40% | **không có nơi ghi đang chạy** | điểm ATS Readiness do code chỉ nằm trong state màn ATS Builder | `resume_scans` 5 dòng cũ (mới nhất 22/5/2026) | `MAX(credibility_score)`, thiếu = 0 | như trên | `ats` (đường cũ) | không có nguồn mới |

Tất cả VERIFIED (`TRUST-SCORE-TRACE.md` mục 2, 3, 8).

**Kiểm soát truy cập nhà tuyển dụng, trạng thái thật:**

| Điều | Trạng thái | Nguồn |
|---|---|---|
| Chính sách đường cũ "recruiters can read visible profiles" (`is_visible AND is_verified_employer_member()`) | **Vẫn tồn tại** trong database | [VERIFIED, `pg_policies` 2026-10-11] |
| SQL consent-only (`consent-only-recruiter-access.sql`) | **Chưa áp dụng**: nó xóa chính sách trên (`drop policy …`), mà chính sách đó còn nguyên; README ghi "Proposed, NOT applied" | [VERIFIED suy ra từ hai bằng chứng khớp nhau] |
| Cờ consent của ứng dụng | Mặc định tắt (`VITE_CONSENT_FLOW === 'true'`); không có trong Dockerfile, compose, `.env.example`. Giá trị của bản đang chạy | [VERIFIED mặc định]; **[UNKNOWN] bản đang chạy** |
| Nhà tuyển dụng đã xác minh | 0; 6 hồ sơ, 1 hiển thị; 0 consent | [VERIFIED hôm nay] |
| Thêm thành viên vào nhà tuyển dụng | Chỉ chủ của nhà tuyển dụng | [VERIFIED policy `employer_members`] |
| `verified_at` không đặt được từ trình duyệt | Có trigger `lock_employer_verification` | [VERIFIED 2026-10-09; **chưa đọc lại hôm nay**] |

**Có thể bật quyền truy cập của nhà tuyển dụng một cách an toàn hôm nay không? Không.** Lý do: (1) đường cũ còn nguyên và hiện `trust`, `ats`, `interview` bất kể consent, trái cam kết "không chia sẻ điểm luyện tập"; (2) đường consent mới chưa được áp dụng ở database nên một cờ ở giao diện **không đủ** làm cơ chế ủy quyền; (3) chưa có bằng chứng kiểm thử RLS trên database thật. Hiện an toàn **chỉ vì** không có nhà tuyển dụng nào đã xác minh, một điều kiện kiểm soát tạm thời. **Khuyến nghị: giữ nguyên "chưa xác minh nhà tuyển dụng nào" cho đến khi gate G2 (mục H) đạt.**

---

## D. Hợp đồng đề xuất (chỉ những gì cần)

**Trạng thái điểm** (đã có trong `supabase/functions/_shared/structure/contract.js`; không phát minh trường mới):

| Trường | Giữ? | Ghi chú |
|---|---|---|
| `status` | Có | `scored` / `insufficient_data` / `unsupported_language` / `processing_error` |
| `score` | Có | Số nguyên 0–100 **chỉ khi** `scored`; ngược lại `null`. **0 hợp lệ là một điểm thật** |
| `score_type` (= "method") | Có | Đã có |
| `score_version` | Có | Đã có, kèm `rulesFingerprint` |
| `computed_at` | Có khi lưu | Chưa có trong contract thuần; thêm khi bắt đầu lưu |
| `reason` | **Không** | `evidence[]` và `notes` đã giải thích; thêm cột sẽ trùng |
| `insufficient_evidence` | **Không thêm** | Khó phân biệt với `insufficient_data` trong các bộ chấm hiện có; chỉ thêm nếu một chỉ số bằng chứng cụ thể cần hai trạng thái khác nhau |

**Nguồn gốc dữ liệu cũ** (dùng cái đã có):
- `resume_scans` đã có ba cột nullable `deterministic_score`, `score_type`, `score_version` (**đã áp dụng 2026-10-09**), có ràng buộc "nếu có điểm thì phải có type và version theo dạng x.y.z". **Hàng cũ có `NULL` ở cả ba = "chấm trước thay đổi này (do AI)"** [VERIFIED `2026-10-08-resume-scans-score-metadata.sql`]. Chưa có chỗ nào trong ứng dụng đọc các cột này.
- `mock_sessions` và `star_stories`: **không có cột nguồn gốc nào** (xem G0b) [VERIFIED catalog 2026-10-11]. Hệ quả: không phân biệt được điểm AI cũ với điểm mới trong hai bảng này; muốn phân biệt phải thêm cột (SQL, duyệt riêng) hoặc dùng mốc thời gian áp dụng thay đổi làm ranh giới (không đủ chặt, chỉ là lựa chọn tạm).

**Quy tắc đủ điều kiện** (PROPOSED): một bản ghi chỉ được dùng cho phép tính mới nếu `score_type` nằm trong **danh sách cho phép** (allowlist) và `status = scored`. Không dùng phép so sánh chuỗi `score_version >= '1.0.0-beta'`, vì một chuỗi phiên bản không chứng minh phương pháp, nguồn gốc hay tính hợp lệ.

---

## E. Chỉ báo hoạt động thay cho điểm gây hiểu nhầm (PROPOSED)

| Chỉ báo | Tử số / mẫu số | Bản ghi không hợp lệ | Nguồn tất định? | **Không** chứng minh |
|---|---|---|---|---|
| Phiên Mock Interview đã hoàn thành | Số bản ghi `mock_sessions` có `questions_count ≥ 1`; hiển thị "N phiên" (không có mẫu số) | Phiên chưa lưu không tính. Giới hạn 10 phiên/24 giờ có sẵn ở server | Có (đếm) | Chất lượng câu trả lời, tiến bộ |
| Câu chuyện STAR đầy đủ | Số câu chuyện mà code xác nhận cả bốn phần S/T/A/R đều có nội dung tối thiểu ÷ số câu chuyện đã lưu | Câu chuyện thiếu phần: tính riêng "chưa đủ" | Có (đếm theo `MIN_FIELD_CHARS`) | Câu chuyện tốt hay đúng sự thật |
| Danh sách chuẩn bị CV | Số mục đạt trong danh sách cố định (có liên hệ, kinh nghiệm, học vấn, kỹ năng, có bullet số liệu) ÷ tổng mục | Văn bản không đọc được: "chưa đánh giá", không phải 0 | Có (`extractResumeFacts`, `sectionReport`) | CV tốt, đúng sự thật, hay phù hợp công việc |
| Các bước chuẩn bị đã làm | Số bước trong lộ trình cố định đã hoàn thành ÷ số bước | Bước bỏ qua không tính | Có | Năng lực hay sẵn sàng |

Không dùng "Metric Density" (chưa có định nghĩa kiểm thử được hay giá trị người dùng đã chứng minh). Không gọi hoạt động là năng lực, tiến bộ, độ tin cậy hay sẵn sàng.

---

## F. Kế hoạch kiểm thử (PROPOSED; chưa có test nào trong số này được chạy hay viết trong rà soát này)

**RLS / database (trên bản sao hoặc staging, không phải production):**
1. Nhà tuyển dụng chưa xác minh: không đọc được `candidate_trust_profiles`.
2. Nhà tuyển dụng đã xác minh, không có consent: **không** đọc được gì (kỳ vọng sau S3).
3. Consent cho nhà tuyển dụng khác / tin tuyển dụng khác: bị từ chối.
4. Consent hết hạn; consent đã thu hồi: yêu cầu kế tiếp bị từ chối.
5. Consent phạm vi hẹp (không có `salary`): không thấy trường lương.
6. Truy cập trực tiếp qua REST/GraphQL bỏ qua giao diện: bị từ chối đúng như bước 2 đến 5.
7. Truy vấn cũ (`select` thẳng bảng) sau khi áp dụng S3: bị từ chối.
8. Thành viên được thêm bởi người không phải chủ: bị từ chối.
9. `verified_at` đặt từ trình duyệt: bị chặn.
(Các bước này đã có hạ tầng thử trên bản sao: `docs/database/replica-test/`, `staging/rest-consent-test.mjs`, theo README; cần chạy lại sau mỗi thay đổi.)

**Ứng dụng / giao diện:** Employer Portal chế độ cũ không còn hiện `trust/ats/interview` (sau thay đổi); chế độ consent lỗi thì đóng (fail closed) và không có truy vấn trực tiếp vào bảng; Dashboard không còn con số "Practice Score" mơ hồ; trạng thái `insufficient_data`/`unsupported_language`/`processing_error` có giao diện riêng; không còn điểm AI dạng số ở Mock Interview và STAR sau Gate B (theo ACCEPTANCE §5).
**Hồi quy:** `structure.test.js` (fingerprint), `consent*.test.*`, test Dashboard, test không gọi mạng ở Tầng 0.

---

## G. ADR dự thảo (PROPOSED, NOT APPROVED)

**ADR-013 (dự thảo): Không có điểm tổng hợp độ tin cậy cho nhà tuyển dụng; điểm luyện tập không bao giờ được chia sẻ.**
Bối cảnh: Trust Score dùng thành phần AI và ATS không có nguồn ghi, thiếu = 0, đường đọc cũ bỏ qua consent. Phương án đã xét: A0–A4, B1–B3. Quyết định: A1 + B1. Hệ quả: Employer Portal và Dashboard/Roadmap đổi; trigger và bảng `candidate_trust_profiles` cần quyết định riêng (SQL, hoàn tác). Bảo mật/riêng tư: loại bỏ phơi nhiễm điểm luyện tập; vẫn cần consent cho hồ sơ. Kiểm chứng: mục F. Điều kiện đảo ngược: có thước đo được hiệu chỉnh và consent theo phạm vi.

**ADR-014 (dự thảo): Hợp đồng trạng thái điểm và nguồn gốc dữ liệu cũ.**
Quyết định: dùng bốn `status` hiện có; `null` = không có bản ghi; nguồn gốc dùng `score_type` allowlist; dữ liệu cũ đọc được nhưng loại khỏi phép tổng hợp mới. Không xóa, không gắn nhãn lại. Điều kiện đảo ngược: một chỉ số cần trạng thái thứ năm.

**ADR-015 (dự thảo): Chỉ báo hoạt động trên dashboard.**
Quyết định: các chỉ báo ở mục E, có tử số/mẫu số, không dùng từ "năng lực/sẵn sàng/tin cậy".

---

## H. Trình tự triển khai (PROPOSED, mỗi bước nhỏ, kiểm thử được, có cổng)

| Cổng | Việc | Cần duyệt? | Hoàn tác |
|---|---|---|---|
| **G0 (đang xong)** | Truy vết, kết quả database hôm nay | — | — |
| **G0b** | Đọc lại trigger `lock_employer_verification` và kiểm tra cờ consent của bản đang chạy; một truy vấn catalog xem `mock_sessions`/`star_stories` có cột nguồn gốc không | Chỉ đọc | — |
| **G1** | Đổi giao diện: Employer Portal chế độ cũ không hiện điểm luyện tập; bỏ điểm tổng khỏi bề mặt nhà tuyển dụng | PR code, duyệt | Revert |
| **G2** | **Áp dụng S3 consent-only** (SQL đã viết, chưa chạy) theo kế hoạch từng bước, kiểm thử RLS trên bản sao, bật cờ consent, chạy các test mục F; chỉ sau đó **mới** được cân nhắc xác minh nhà tuyển dụng | SQL, duyệt từng bước | Có tập lệnh hoàn tác trong repo |
| **G3** | Thay Dashboard/Roadmap bằng chỉ báo hoạt động (mục E) | PR code | Revert |
| **G4** | Quyết định về trigger `recompute_trust_score` và `candidate_trust_profiles` (giữ nguyên nhưng không dùng, đóng băng, hoặc xóa) | SQL riêng | Cần kế hoạch |
| **G5** | Nối Structure Score (Gate B/C/D của ACCEPTANCE) | Theo ACCEPTANCE | Theo ACCEPTANCE |

Phụ thuộc: G2 phải xong **trước** khi xác minh nhà tuyển dụng đầu tiên. G4 không nên làm trước G1 và G2.

---

## I. Câu hỏi còn mở (chỉ những câu ảnh hưởng thật đến kiến trúc)

1. ~~`mock_sessions` và `star_stories` có cột nguồn gốc không?~~ **Đã trả lời bằng truy vấn catalog hôm nay (mục G0b): không có.**
2. Bản đang chạy có bật `VITE_CONSENT_FLOW` không? (UNKNOWN; cấu hình build)
3. Ứng viên vẫn nên thấy một chỉ báo cá nhân nào về luyện tập sau khi bỏ "Practice Score"? (quyết định sản phẩm)
4. Sau G2, nhà tuyển dụng đầu tiên sẽ là ai và có thỏa thuận nào? (không phải kỹ thuật)

### Lời hứa sản phẩm

**CareerAiHub nên giúp nhà tuyển dụng nhìn bằng chứng do ứng viên cung cấp rõ ràng hơn, không tuyên bố xác minh năng lực ứng viên.**

- **Hệ thống hiện hỗ trợ được:** trình bày thông tin ứng viên đã đồng ý chia sẻ, kèm nguồn trong CV; danh sách bao phủ bằng chứng; kiểm tra hình thức bằng luật. Không hơn.
- **Thiếu gì cho lời hứa mạnh hơn ("xác minh năng lực"):** nguồn xác minh độc lập (cơ quan cấp chứng chỉ, xác minh danh tính, `verify-cert` hiện chỉ kiểm tra liên kết với danh sách ngắn); phép đo được hiệu chỉnh với đánh giá của người, có báo cáo sai số, thiên lệch và giới hạn (ACCEPTANCE §7 chưa đạt); consent theo phạm vi được ép buộc ở database và kiểm thử; nhật ký kiểm toán; đánh giá pháp lý về hệ thống hỗ trợ quyết định tuyển dụng.
- **Điều kiện trước khi được phép tuyên bố:** các mục trên đều **đúng và có bằng chứng**, không chỉ nằm trong thiết kế.

---

## G0b. Kết quả truy vấn catalog chỉ-đọc (2026-10-11)

| Câu hỏi | Kết quả [VERIFIED] | Hệ quả |
|---|---|---|
| Cột của `mock_sessions` | `id, user_id, mode, questions_count, avg_score, created_at` | **Không lưu câu trả lời** và không có nguồn gốc điểm. Không thể tính lại điểm phỏng vấn cũ; không thể phân biệt AI với mới |
| Cột của `star_stories` | `id, user_id, one_liner, score, situation, task, action, result, refined (jsonb), created_at` | **Có lưu nội dung S/T/A/R**, nên **có thể tính lại** điểm cấu trúc cho STAR cũ bằng bộ chấm bằng code (cần xem xét quyền riêng tư của việc đọc nội dung); không có cột nguồn gốc điểm |
| Cột của `resume_scans` | thêm `deterministic_score, score_type, score_version` (nullable) | Cột nguồn gốc đã có, như mục D |
| Cột của `consents` | `id, candidate_id, employer_id, scope (jsonb), purpose, granted_at, expires_at, revoked_at` | Consent hiện theo **nhà tuyển dụng**, **không có cột tin tuyển dụng**. Phạm vi "theo tin tuyển dụng" ở B2 cần đổi schema hoặc đặt trong `scope` (jsonb); cần thiết kế riêng |
| Trigger trên `employers` | `trg_lock_employer_verification`, BEFORE INSERT và UPDATE | Đã đọc lại **hôm nay**: nếu người gọi là `anon` hoặc `authenticated` thì INSERT đặt `verified_at = null`, UPDATE giữ nguyên giá trị cũ. Chỉ vai trò khác (ví dụ quản trị viên trong SQL Editor) mới đặt được |
| Trigger trên `employer_members` | Không có | Bảo vệ hoàn toàn dựa vào RLS (chỉ chủ nhà tuyển dụng được thêm) |

Cập nhật tình trạng cổng G0b: **đã xong**, trừ việc kiểm tra cờ `VITE_CONSENT_FLOW` của bản đang chạy (cấu hình build, bạn xem).

**Giới hạn của rà soát này:** không chạy test nào, không thực thi SQL, không xem dữ liệu cá nhân; số liệu database là các số đếm và định nghĩa hàm/chính sách do chủ sản phẩm lấy hôm nay; đã đọc cột của `consents` nhưng **chưa đọc chính sách RLS của `consents`** và chưa chạy bất kỳ test RLS nào.
