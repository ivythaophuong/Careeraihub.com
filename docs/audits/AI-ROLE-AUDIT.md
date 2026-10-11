# Audit: chỗ nào AI đứng đúng vai, chỗ nào AI đang giữ vai của deterministic

Trạng thái: **báo cáo audit, chỉ đọc. Chưa sửa code, SQL hay cấu hình. Chưa commit.**
Viết 2026-10-11 cho chủ sản phẩm (Ivy). Cơ sở: mã trên `main` @ `4c3b962`. Không có mô hình nào được gọi trong audit này.

Nhãn bằng chứng: **[CODE]** đọc trong mã · **[DOC]** đọc trong tài liệu của repo (ghi ngày) · **[UNKNOWN]** không xác định được · **[ASSESSMENT]** nhận định của người audit, không phải sự thật đo được.

## 1. Tiêu chí phân loại

Nguyên tắc của dự án (ADR-007, ADR-011, `AI_ARCHITECTURE_CONTRACT.md`): **code tính điều phải đúng; AI giải thích, viết, diễn đạt**.

| Ký hiệu | Nghĩa |
|---|---|
| ✅ **Đúng vai** | AI làm việc ngữ nghĩa (viết, diễn đạt lại, giải thích, hội thoại) và, nếu có con số hay sự kiện, code kiểm soát |
| ⚠️ **Lai, chấp nhận được** | AI làm một phần việc mà code có thể làm, nhưng kết quả cuối được code chốt hoặc rủi ro thấp |
| ❌ **AI giữ vai của code** | AI quyết định một con số, một nhãn, hoặc một sự kiện mà code có thể (hoặc nên) quyết định bằng luật có thể kiểm tra |

"Con số do AI" ở đây nghĩa là con số xuất hiện trong JSON mô hình trả về và được hiển thị hoặc lưu, không có công thức trong code.

## 2. Bảng audit theo chức năng

| # | Chức năng | AI đang làm gì | Code đang làm gì | Phân loại | Vì sao |
|---|---|---|---|---|---|
| 1 | **ATS Readiness** (ATS Builder) | Không chấm điểm. Lời nhắc ghi rõ "Do NOT output any overall score…the score is computed by code" | `computeDeterministicScore`: đủ mục, bullet có con số, ngày nhất quán | ✅ | Con số do code, AI chỉ trích dữ liệu và giải thích vấn đề. Đây là mẫu chuẩn của dự án |
| 2 | **ATS Builder: trích dữ liệu CV** (`ats_parse`) | Trích cấu trúc từ 5.000 ký tự đầu | `extractResumeFacts` đã có và làm việc tương tự không cần AI | ⚠️ | AI làm việc code đã làm được; trùng lặp (tốn token, có thể lệch với facts). Rủi ro thấp vì không tạo điểm |
| 3 | **Khớp từ khóa** (chip ✓ ✗) | Chọn danh sách từ khóa từ JD ("chép nguyên văn") | `checkKeywords` quyết định có/không trong CV | ✅ | Việc "có từ này trong CV không" do code chốt (ADR-007) |
| 4 | **Resume Scan: điểm khớp JD** (`matchScore`) | Mô hình tự đặt 0–100 | chỉ kẹp, lưu vào `jd_analyses` | ❌ | Con số hiển thị và lưu, không có công thức. Cùng CV+JD có thể ra điểm khác. DECISIONS ADR-011 ghi nhận "vẫn do mô hình đặt" |
| 5 | **Resume Scan: thanh "Skills alignment" và "Format score"** | Mô hình tự đặt | Chỉ thanh "Keywords matched" bị code ghi đè bằng tỉ lệ thật | ❌ | "Format score" đặc biệt đáng ngờ: mô hình chỉ nhận **chữ** của CV, không nhìn thấy bố cục, nên con số về định dạng không có căn cứ [ASSESSMENT] |
| 6 | **Resume Scan: tách dữ liệu cho mẫu PDF** (`scan_template_parse`) | Trích cấu trúc rồi đổ vào mẫu CV xuất ra | Có kiểm tra phần mất mục (`lostSections`) | ⚠️ | Đây là việc trích xuất, nên là của code. Rủi ro: nội dung do AI trích đi thẳng vào CV người dùng tải về. Chưa xác minh có so lại với văn bản gốc không **[UNKNOWN]** |
| 7 | **Resume Scan: đề xuất sửa bullet** (`issues`/`fix`) | Viết lại bullet | `guardIssues` kiểm tra | ✅ | Đúng vai AI (viết lại) có chốt chặn bằng code |
| 8 | **JD Analyzer: `matchScore`** | Mô hình tự đặt | Kẹp 0–100 | ❌ | Như #4 |
| 9 | **JD Analyzer: `keyRequirements`** (rút yêu cầu từ JD) | Rút | – | ✅ | Việc đọc hiểu văn bản JD là ngữ nghĩa, hợp lý |
| 10 | **JD Analyzer: `criticalGaps`, `hiddenKeywords` "thiếu hoặc yếu trong CV"** | Quyết định cái gì CV có hay thiếu | Không kiểm tra lại bằng `checkKeywords` | ❌ | "CV có từ này không" là việc đối chiếu chuỗi của code; ở đây AI phán, có thể sai mà không bị phát hiện |
| 11 | **Mock Interview: điểm từng câu** (`score_interview_evaluate`) | Mô hình tự đặt 0–100 theo lời nhắc | Kẹp, nhãn từ ngưỡng, trung bình phiên, chữ ký HMAC | ❌ | Quan trọng nhất: điểm này đi vào `mock_sessions` → Trust Score (35%). Đã có bộ thay thế (Structure Score) chưa nối |
| 12 | **Mock Interview: sinh câu hỏi** | Viết 5 câu theo persona | – | ✅ | Sinh nội dung là vai đúng của AI. Điểm yếu riêng: câu hỏi không được ký (xem audit trước) |
| 13 | **Mock Interview: nhận xét bằng lời** (worked/missed/tip/outline) | Viết | `findInventedInFeedback` bắt con số bịa | ✅ | Đúng vai, có guard |
| 14 | **STAR Builder: điểm từng phần** | Mô hình chấm từng phần S/T/A/R | `overallScore` do code tính **từ các điểm AI** | ❌ | Phép tính của code che đi việc nguyên liệu là ý kiến AI. Đi vào `star_stories` → Trust Score (25%) |
| 15 | **STAR Builder: viết lại câu chuyện** | Viết | `findInventedNumbers` | ✅ | Đúng vai, có guard |
| 16 | **Salary Prep: phép tính chênh lệch và %** | Không | `negotiationMath` | ✅ | Con số do code |
| 17 | **Salary Prep: lời thoại đàm phán** | Viết | `findUnsupportedFigures` | ✅ | Đúng vai, có guard |
| 18 | **Salary Prep: bảng lương theo thị trường** (`salary_market`) | Mô hình tự nêu khoảng lương | – | ❌ → đã tắt | Con số không có nguồn. Đang bị tắt bằng cờ (`MARKET_…`), nên **không đến tay người dùng** [CODE, theo kiểm kê trước]; nếu bật lại là vi phạm |
| 19 | **Skills Gap: `yourLevel` và `status` của từng kỹ năng** | Mô hình phán strong/good/basic/missing, strong/developing/gap | – | ❌ | "CV có kỹ năng này không, mạnh yếu ra sao" nên bắt đầu từ facts của code (`skills`, bằng chứng trích dẫn). Hiện không có bằng chứng đi kèm |
| 20 | **Skills Gap: khuyến nghị** | Viết gợi ý | – | ✅ | Đúng vai (diễn giải), không có con số |
| 21 | **AI Memory: `overallProgress` "0–100 dựa trên hoạt động" và `status` Ready/Almost/Needs Work** | Mô hình tự đặt | – | ❌ | "Hoạt động" đếm được hoàn toàn bằng code. AI bịa con số tổng hợp |
| 22 | **Thẻ hồ sơ khi onboarding** (`currentRole`, `yearsExp`, `topSkills`) | Mô hình trích từ 4.000 ký tự | `extractResumeFacts` có thể lấy vai trò, thời gian và kỹ năng | ❌ | `yearsExp` hiển thị trên Dashboard; tính số năm từ ngày tháng là việc của code. Sai số không bị phát hiện |
| 23 | **Trích chữ từ PDF khi pdf.js hỏng** (`onboarding_pdf_extract`) | Đọc PDF bằng mô hình | – | ⚠️ | Phương án dự phòng chấp nhận được, nhưng kết quả là chữ do AI đọc, nên phải coi là "suy đoán" chứ không phải sự kiện gốc (provenance) |
| 24 | **AI Coach (chat)** | Hội thoại | – | ✅ | Việc ngữ nghĩa thuần |
| 25 | **ATS Builder: viết lại bullet** (`ats_bullet_rewrite`) | Viết | guard con số bịa | ✅ | Đúng vai |
| 26 | **Thư xin việc** | Viết | – (prompt dặn "chỉ dùng thông tin trong CV") | ⚠️ | Việc viết là của AI, nhưng **không có chốt chặn bằng code** cho sự kiện bịa (chỉ là lời dặn) **[UNKNOWN: chưa thấy guard sau khi sinh]** |

## 3. Con số tổng hợp "chạy bằng code nhưng nguyên liệu là AI"

| Chỗ | Công thức (code) | Nguyên liệu | Phân loại |
|---|---|---|---|
| Điểm trung bình phiên Mock Interview | trung bình | điểm AI (#11) | ❌ gián tiếp |
| Vòng "Interview Readiness" trên Dashboard | lấy `avgScore` phiên gần nhất | điểm AI | ❌ gián tiếp |
| Weakness Radar | trung bình các điểm đã lưu | điểm AI (#11, #14) | ❌ gián tiếp |
| **Trust Score** (trigger DB) | 40% ATS + 35% phỏng vấn + 25% STAR | **60% là điểm AI** (#11, #14) [DOC: EVIDENCE_RESULTS 2026-10-09] | ❌ gián tiếp, ảnh hưởng nhà tuyển dụng |
| Overview của Interview Coach | đếm số lần luyện tập | số lần (không phải chất lượng) | ✅ (code ghi rõ là đếm hoạt động) |

## 4. Phát hiện bổ sung quan trọng

1. **Phần 40% "ATS" của Trust Score có vẻ không còn nguồn ghi sống.** `buildScanRecord` (tạo bản ghi `resume_scans`) chỉ được **định nghĩa**, không có chỗ gọi trong `src` ngoài test **[CODE]**, và không thấy lệnh ghi bảng `resume_scans` nào còn sống **[CODE]**; bằng chứng DB cũng ghi "resume_scans has no live writer" **[DOC]**. Hệ quả: với người dùng mới, thành phần ATS của Trust Score là 0 (theo công thức `MAX(...)` khi không có dòng), và điểm ATS Readiness do code tính hiện **không** đi vào Trust Score. "Resume Readiness Score" đọc `credibilityScore` từ lịch sử quét, nên nhiều khả năng trống với người dùng mới. **Chưa lần hết luồng nên là [UNKNOWN] một phần.**
2. **Tỉ trọng:** với người dùng mới, Trust Score hiện **gần như hoàn toàn bằng điểm AI** (35% phỏng vấn + 25% STAR), vì phần ATS là 0.
3. **Lời nhắc ATS Builder đã ghi đúng nguyên tắc** (không xuất điểm); đây là chỗ bạn đã sửa trước đó và là mẫu nên áp dụng cho các chỗ khác.

## 5. Thống kê

Trong 26 hạng mục: **✅ 12** đúng vai, **⚠️ 4** lai chấp nhận được (#2, #6, #23, #26), **❌ 10** AI giữ vai của code (#4, #5, #8, #10, #11, #14, #18, #19, #21, #22), trong đó #18 đang bị tắt nên không đến tay người dùng, còn **9 mục đang hoạt động**. Cộng thêm 4 con số tổng hợp ❌ gián tiếp ở mục 3. Số đếm phụ thuộc vào cách phân loại ở ranh giới, nên đừng đọc nó như số đo chính xác.

## 6. Thứ tự ưu tiên đề xuất [ASSESSMENT]

Xếp theo (ảnh hưởng người dùng/nhà tuyển dụng) × (độ dễ chuyển sang code):

| Ưu tiên | Hạng mục | Hướng chuyển | Phụ thuộc |
|---|---|---|---|
| 1 | #11 và #14 (điểm phỏng vấn và STAR) | Structure Score (Gate A đã có) + AI chỉ nhận xét bằng lời | Gate B, C; kết nối với D3; Trust Score chờ Gate D |
| 2 | #21 (overallProgress, status của AI Memory) | Đếm hoạt động bằng code, AI chỉ viết lời khuyên | Không cần SQL, nhỏ |
| 3 | #22 (yearsExp, role, skills ở onboarding) | Dùng `extractResumeFacts` + phép tính số năm từ ngày tháng; AI không còn lời gọi này | Nằm trong Resume Context Stage 2 |
| 4 | #10 và #19 (CV "có/thiếu" kỹ năng, từ khóa) | Code đối chiếu, AI chỉ giải thích; mỗi kết luận kèm bằng chứng trích dẫn | Stage 2 |
| 5 | #4, #5, #8 (điểm khớp JD, "Format score", "Skills alignment") | Chỉ giữ phần từ khóa do code; bỏ hoặc thay các thanh do AI đặt; riêng "Format score" nên bỏ vì mô hình không thấy bố cục | Cần quyết định sản phẩm: ADR-011 ghi "chưa đổi" |
| 6 | #6, #26 (nội dung AI đi vào CV/thư người dùng) | Thêm chốt chặn so với văn bản gốc | Nhỏ |
| 7 | Mục 4.1 (nguồn ghi ATS của Trust Score) | Xác minh luồng, rồi quyết định có nối ATS Readiness vào hay không | Cần đọc thêm, có thể cần SQL |

## 7. Giới hạn của audit này

- Chỉ đọc mã và tài liệu; không chạy ứng dụng, không gọi mô hình, không xem dữ liệu production.
- Chưa audit TrustMatch/Employer Portal/`jobs`/`verify-cert` (kiểm kê trước ghi các phần này là code hoặc chưa cài đặt, không có lời gọi AI trong danh mục `callLLM`).
- Danh sách lời gọi AI lấy từ `grep callLLM` sau khi PR #56 đặt tên cho từng nơi gọi; nơi nào không gọi qua `callLLM` (ví dụ hai hàm chấm điểm trên server) được đọc riêng.
- Phân loại là nhận định của người audit; các ranh giới (#2, #6, #23, #26) có thể được xếp khác bởi người khác.
