# Trang quyết định: Trust Score và điểm luyện tập

Trạng thái: **Năm quyết định đã được chủ sản phẩm đồng ý về nguyên tắc ngày 2026-10-11 (xem mục 9 và bảng trạng thái). Chưa triển khai gì: không code, không SQL, không cấu hình, không dữ liệu nào thay đổi. Các mục 2 đến 8 giữ nguyên như bản đề xuất ban đầu.** Ghi vào `DECISIONS.md` là ADR-013.
Viết 2026-10-11 cho Ivy. Bằng chứng: `docs/audits/TRUST-SCORE-TRACE.md`, `docs/audits/AI-ROLE-AUDIT.md`, ADR-011, ADR-012.
Nhãn: **[DB]** đọc từ database ngày 2026-10-11 · **[CODE]** đọc trong mã tại `main` @ `4c3b962` · **[PROPOSAL]** đề xuất của trợ lý, không phải quyết định.

---

## 1. Hiện trạng đã xác minh (không bàn lại)

| Điều | Sự thật | Nguồn |
|---|---|---|
| Công thức | `Trust = ROUND(ATS×0,40 + Interview×0,35 + STAR×0,25)`; ATS = `MAX(credibility_score)` của `resume_scans`; Interview = trung bình 5 phiên gần nhất; STAR = trung bình 5 câu gần nhất | [DB] |
| Thiếu dữ liệu | Mỗi thành phần thiếu **= 0**, và vẫn được cộng vào tổng | [DB] |
| Nguồn ATS | Không có nơi ghi `resume_scans` đang chạy; 5 dòng cũ, mới nhất 22/5/2026. Điểm ATS Readiness do code tính **không** đi vào Trust Score | [CODE], [DB] |
| Nguồn Interview, STAR | Điểm do **AI đặt** (mô hình tự chấm), code chỉ kẹp và tính trung bình | [CODE] |
| Người dùng thấy | "Practice score" trên Dashboard và Roadmap (mốc "Practice score 65+") | [CODE] |
| Nhà tuyển dụng thấy | Chế độ cũ của Employer Portal đọc thẳng bảng và hiện `trust`, `ats`, `interview` là số, `star` thành nhãn Strong/Good/Developing. Chỉ thành viên của nhà tuyển dụng **đã xác minh** đọc được | [CODE], [DB] |
| Mức phơi nhiễm hôm nay | **0** nhà tuyển dụng đã xác minh, 6 hồ sơ (1 hiển thị), 0 consent. Không ai đọc được | [DB] |
| Biện pháp tạm | Chủ sản phẩm đã quyết (2026-10-11): **chưa xác minh nhà tuyển dụng nào** cho đến khi consent hoạt động hoặc đã có quyết định về điểm nào được hiển thị | Trace |

Lưu ý: "0 nhà tuyển dụng đã xác minh" là một **điều kiện kiểm soát hiện tại**, không phải cơ chế bảo vệ lâu dài.

---

## 2. Quyết định A: Điểm tổng hợp đại diện cho điều gì?

| Lựa chọn | Nghĩa | Ưu | Nhược / điều kiện |
|---|---|---|---|
| **A0. Giữ nguyên** | Giữ công thức 40/35/25 | Không phải làm gì | Trộn các nguồn bản chất khác nhau; 0 cho thiếu dữ liệu; 60% là điểm AI chưa hiệu chỉnh. **Không khuyến nghị** |
| **A1. Bỏ điểm tổng hợp** | Chỉ hiện từng chỉ số có ý nghĩa rõ ràng, không có con số tổng | Không tuyên bố điều chưa đo được; đơn giản; không cần công thức | Mất một "tiêu đề" cho hồ sơ; Roadmap và Dashboard đang dùng mốc 65 phải đổi |
| **A2. Độ đầy đủ của bằng chứng** | Đo mức các thông tin nghề nghiệp có thể kiểm chứng, **không** nói ứng viên giỏi hơn | Gần với "Proof over claims" | Cần định nghĩa "bằng chứng" và cách kiểm chứng; hiện chưa có luồng xác minh nào cho sự kiện trong CV |
| **A3. Mức sẵn sàng ứng tuyển** | Dự đoán ứng viên đã sẵn sàng | Dễ hiểu với người dùng | Cần định nghĩa đo lường và bằng chứng đủ tốt để hỗ trợ kết luận; **chưa có** |

[PROPOSAL] **A1 cho nhà tuyển dụng ngay bây giờ.** Bỏ điểm tổng hợp khỏi mọi bề mặt nhà tuyển dụng; giữ cho người dùng một chỉ báo tiến độ luyện tập cá nhân, nói rõ nó không được chia sẻ. A2 là hướng dài hạn hợp với "Proof over claims", chỉ làm khi có luồng xác minh. Không chọn A3 nếu chưa có thước đo.

---

## 3. Quyết định B: Nhà tuyển dụng được xem gì?

Từng loại dữ liệu, quyết định riêng:

| Dữ liệu | Hiện tại (đường cũ) | Đường consent mới | Lựa chọn |
|---|---|---|---|
| Hồ sơ và thông tin nghề nghiệp ứng viên cho phép chia sẻ | Thấy hết hồ sơ hiển thị | Chỉ các trường đã đồng ý (tên, tiêu đề, giới thiệu, kỹ năng, nơi ở, hình thức làm việc, tùy chọn khoảng lương) | Chỉ qua consent |
| Điểm luyện tập phỏng vấn, STAR | Thấy | **Không** (màn consent ghi rõ không chia sẻ) | **B1: không bao giờ chia sẻ** / B2: chia sẻ nếu ứng viên đồng ý riêng, có nhãn "luyện tập" |
| Điểm ATS | Thấy (`ats`) | Không | Không chia sẻ (không có nguồn ghi sống) |
| Trạng thái xác minh bằng chứng | Chưa có | Chưa có | Chỉ khi luồng xác minh tồn tại và được phép chia sẻ |

[PROPOSAL] **B1.** Điểm luyện tập không phải dữ liệu tuyển dụng. Đường cũ phải bị vô hiệu hoặc thay bằng đường consent **trước khi** xác minh nhà tuyển dụng nào. Điều này khớp với cam kết trên màn consent và với ADR-012 (quyết định 3).

Phụ thuộc kỹ thuật (đã có kế hoạch, **chưa áp dụng**): SQL consent-only (`docs/database/proposed/2026-10-09-consent-only-recruiter-access.sql`) và Employer Portal ở chế độ consent (cờ build `VITE_CONSENT_FLOW`), kèm kiểm thử đúng như `CONSENT-FLOW-DESIGN.md`. Bật cờ **không tự chứng minh** database đã chặn đường đọc cũ; cần kiểm tra ở cả hai tầng.

---

## 4. Quyết định C: Khi thiếu dữ liệu thì hiển thị gì?

Bốn trạng thái, **khác nhau** ở logic tính, API và giao diện:

| Trạng thái | Nghĩa |
|---|---|
| Điểm bằng 0 | Đã tính và kết quả thật sự là 0 |
| `null` | Chưa có kết quả (chưa tính hoặc chưa có dữ liệu nguồn) |
| `insufficient_evidence` | Có dữ liệu nhưng chưa đủ để kết luận |
| `failed` | Việc tính toán gặp lỗi |

- Không đổi thiếu dữ liệu thành 0 chỉ để có một con số.
- **Không tự động tính lại trọng số** trên các thành phần còn lại khi thiếu một thành phần, vì đó là một quyết định đo lường, không phải chi tiết kỹ thuật.
- Cách **lưu** bốn trạng thái (cột nào, kiểu gì) chưa được chọn; phụ thuộc schema hiện có, các nơi đọc dữ liệu và dữ liệu lịch sử. Bộ chấm cấu trúc (`structure/contract.js`) đã có cách biểu diễn `status` + `score` có thể là mẫu.

---

## 5. Dữ liệu cũ

| Dữ liệu | Hiện có | Các lựa chọn |
|---|---|---|
| `resume_scans` (điểm ATS cũ do AI chấm) | 5 dòng, mới nhất 22/5/2026 | Giữ và gắn nhãn "legacy" / loại khỏi mọi phép tổng hợp / xóa theo yêu cầu người dùng. **Không xóa tự động** |
| `mock_sessions.avg_score` | Điểm AI đã lưu | Giữ nguyên, gắn `score_type`/phiên bản khi đổi cách chấm; không gắn nhãn lại trong im lặng (theo ACCEPTANCE §5) |
| `star_stories.score` | như trên | như trên |
| `candidate_trust_profiles` (6 hồ sơ) | Đã có điểm tổng | Phụ thuộc quyết định A: bỏ, hoặc tính lại theo định nghĩa mới |

Mọi thay đổi trigger hoặc dữ liệu cần SQL được duyệt riêng, có kế hoạch hoàn tác.

---

## 6. Tác động theo bề mặt

| Bề mặt | Hôm nay | Bị ảnh hưởng bởi |
|---|---|---|
| Dashboard "Practice Score" | Hiện con số, 0 cho người dùng mới | A, C |
| Career Roadmap mốc "Practice score 65+" | Dùng cùng con số | A (nếu bỏ, mốc phải đổi) |
| Employer Portal chế độ cũ | Hiện `trust`, `ats`, `interview` | B (phải bỏ hoặc thay bằng consent) |
| Employer Portal chế độ consent | Không hiện điểm luyện tập | B |
| Trigger `recompute_trust_score` và bảng `candidate_trust_profiles` | Tính và lưu điểm | A, C, dữ liệu cũ |

---

## 7. Điều kiện trước khi xác minh nhà tuyển dụng đầu tiên [PROPOSAL, theo quyết định đã có]

1. Quyết định B được chốt bằng văn bản.
2. Đường đọc cũ không còn hiện điểm luyện tập cho nhà tuyển dụng (hoặc consent-only SQL đã áp dụng và kiểm thử, cờ consent bật).
3. Đã đọc lại trigger `lock_employer_verification` trong catalog hiện tại và đã kiểm tra cờ consent của bản đang chạy.
4. Một ADR ghi lại quyết định.

## 8. Các câu hỏi dành cho chủ sản phẩm

| # | Câu hỏi | Đề xuất của trợ lý (không bắt buộc) |
|---|---|---|
| Q-A | Chọn A0, A1, A2 hay A3? | A1 cho nhà tuyển dụng ngay; A2 là hướng dài hạn |
| Q-B | Điểm luyện tập có bao giờ được chia sẻ với nhà tuyển dụng không? | Không (B1) |
| Q-C | Thiếu dữ liệu: dùng bốn trạng thái và **không** tính lại trọng số? | Đồng ý |
| Q-D | Dữ liệu cũ: giữ và gắn nhãn legacy, không xóa tự động? | Đồng ý |
| Q-E | Người dùng vẫn thấy một chỉ báo "Practice score" cá nhân (nói rõ không chia sẻ)? | Có, nhưng đổi mô tả; hoặc bỏ nếu chọn A1 hoàn toàn |

Không có thay đổi nào được thực hiện cho tới khi các câu này được trả lời; sau đó mới lập kế hoạch migration và triển khai từng gate, mỗi gate có test và hoàn tác.

---

## 9. Quyết định đã ghi

| Câu | Quyết định của chủ sản phẩm | Ngày | Ghi chú |
|---|---|---|---|
| Q-A | **A1: bỏ điểm tổng hợp cho nhà tuyển dụng.** Hướng dài hạn A2 (danh sách bao phủ bằng chứng, không điểm số) chỉ khi bộ đọc CV đạt cổng | 2026-10-11 | Chưa có thay đổi code, SQL hay dữ liệu. Cách thực hiện nằm trong lộ trình G1 đến G4 của `REVIEW-trust-evidence-architecture.md` |
| Q-B | **B2: điểm luyện tập chỉ được hiển thị cho nhà tuyển dụng nếu ứng viên cho phép** (không bao giờ mặc định). Mặc định: **không chia sẻ** | 2026-10-11 | Chưa xây. Tiền điều kiện đề xuất (chờ chủ sản phẩm xác nhận): chỉ chia sẻ điểm luyện tập khi nó **không còn do AI đặt** (Structure Score đã qua cổng hiệu chỉnh, nhãn beta); chỉ trường ứng viên chọn; không câu trả lời thô; có hạn; thu hồi được; ép buộc ở database. Cho đến lúc đó: **B1 trên thực tế**. Nội dung màn consent ("Not shared: practice scores") phải đổi cho khớp khi B2 được xây, theo ADR-012 quyết định 3 |
| Q-B (mức chia sẻ) | **Mức (ii):** khi ứng viên cho phép, nhà tuyển dụng thấy **điểm cấu trúc kèm danh sách kiểm tra đạt/chưa đạt bằng lời**. **Không** có nội dung câu trả lời, không bản ghi, không phản hồi AI | 2026-10-11 | Cần thiết kế riêng cho phạm vi consent (hiện bảng `consents` chỉ có `employer_id`, `scope` jsonb) và cột trả về của hàm đọc; ép buộc ở database; test âm tính theo `REVIEW-trust-evidence-architecture.md` mục F |
| Q-C | **Đồng ý về nguyên tắc** (chưa phải duyệt triển khai): bốn trạng thái `scored`, `insufficient_data`, `unsupported_language`, `processing_error`; "chưa có kết quả" = không có bản ghi, không có giá trị mặc định; không tự tính lại trọng số; chưa thêm `insufficient_evidence` | 2026-10-11 | **Điều kiện của chủ sản phẩm:** bốn trạng thái phải được áp dụng nhất quán từ bộ chấm, tầng lưu trữ, API đến giao diện, không chỉ ở cách hiển thị. Hai điểm cần xác minh trước khi triển khai: (1) trạng thái có được bảo toàn qua API, database và giao diện không (hiện **chưa**: `contract.js` định nghĩa đủ bốn trạng thái nhưng **không có nơi nào ngoài thư mục `structure/` import nó**, [CODE grep]); (2) khi một thành phần không có điểm, Trust Score cũ phải được đánh dấu không khả dụng thay vì tính như 0 (hiện hàm `recompute_trust_score` dùng `COALESCE(...,0)`, [DB-2026-10-11]; sửa cần SQL riêng, gate G4) |

| Q-D | **Đồng ý về nguyên tắc** (chưa duyệt SQL hay triển khai): (1) dữ liệu cũ **giữ lại, đọc được**, nhãn **"Earlier AI estimate"** (xám, không dải màu), **không đi vào mọi tổng hợp** (Dashboard, radar, điểm mới); không xóa, không gắn nhãn lại trong im lặng. (2) Nguồn gốc: `resume_scans` đã có `score_type`, `score_version` (rỗng = AI cũ); đề xuất thêm hai cột nullable tương tự cho `mock_sessions` và `star_stories`, **chỉ server ghi**; trạng thái không có điểm **không lưu**, chỉ kết quả `scored` được lưu. (3) Đủ điều kiện cho hệ thống mới: `score_type` thuộc **danh sách cho phép** do code định nghĩa và có `score_version`, không dùng so sánh chuỗi phiên bản. (4) Tính lại: STAR cũ được (nội dung có lưu) nhưng chỉ khi ứng viên bấm, kết quả là **bản ghi mới**, không ghi đè; phỏng vấn cũ và ATS cũ **không** tính lại được. (5) Chống nhầm: kiểm tra danh sách cho phép ở code + test chứng minh bản ghi cũ không vào tổng hợp. (6) Chỉ thêm cột nullable, không điền lại dữ liệu, thử trên bản sao cục bộ, hoàn tác = xóa hai cột | 2026-10-11 | SQL cần duyệt riêng từng bước theo quy trình hiện có; ghi `docs/database/` sau khi áp dụng |
| Q-E | **Đồng ý về nguyên tắc** bốn chỉ báo đếm hoạt động: phiên luyện tập đã lưu; câu chuyện STAR đủ bốn phần; danh sách chuẩn bị CV; các bước chuẩn bị đã làm. Không biến dữ liệu thiếu hoặc không đọc được thành 0 (hiển thị "chưa đánh giá"); không dùng "Metric Density"; không tuyên bố tiến bộ, tin cậy hay sẵn sàng chỉ dựa trên hoạt động | 2026-10-11 | **Hai điều kiện:** (1) "STAR đủ bốn phần" chỉ đo mức hoàn chỉnh về **cấu trúc**; thế nào là một phần hợp lệ phải được **định nghĩa cụ thể** (đề xuất dùng ngưỡng của bộ chấm cấu trúc, `MIN_SECTION_TOKENS` trong `structure/rules.js`, là một ngưỡng **phỏng đoán ban đầu, chưa hiệu chỉnh**). (2) "Danh sách chuẩn bị CV" chỉ đo các mục được kiểm tra theo **quy tắc xác định**: có bullet số liệu không có nghĩa số liệu đúng; có mục kỹ năng không có nghĩa CV phù hợp công việc. **Mốc Roadmap:** chưa thay "Practice score 65+" bằng một ngưỡng số đếm tùy ý; trước hết xác định mốc gắn với **hành động chuẩn bị cụ thể** nào, sau đó mới chọn tiêu chí hoàn thành có ý nghĩa |

### Trạng thái của các quyết định (để không biến đề xuất thành "đã triển khai")

| Câu | Trạng thái |
|---|---|
| Q-A | Đã quyết (A1). **Chưa triển khai** |
| Q-B | Đã quyết (B2, mức ii), **mặc định không chia sẻ, chưa xây**; tiền điều kiện chờ xác nhận. Kiểm soát consent **chưa hoạt động** ở production (SQL consent chưa áp dụng) |
| Q-C | Đồng ý về nguyên tắc; **cần kiểm chứng luồng trạng thái đầu cuối** (bộ chấm, lưu trữ, API, giao diện). Chưa có tầng nào ngoài `structure/` dùng chúng |
| Q-D | Đã ghi quyết định; **cần rà soát nội dung chính xác** (đặc biệt cột mới và danh sách cho phép) trước khi duyệt SQL. Chưa có SQL nào được áp dụng |
| Q-E | Đồng ý về nguyên tắc, kèm hai điều kiện và điều kiện về mốc Roadmap. Chưa triển khai |
