# Thiết kế: Panel gợi ý trong Resume Builder (điểm sống + nút Apply)

Trạng thái: **DESIGN. Code làm theo 3 commit nhỏ ở mục 6; mỗi commit có test.** Viết 2026-10-12 cho chủ sản phẩm (Ivy). Thuật ngữ kỹ thuật giữ tiếng Anh.
Nhãn: **[CODE]** đọc trong mã · **[PROPOSAL]** đề xuất, chủ sản phẩm có thể đổi · **[UNKNOWN]**.

## 1. Mục tiêu (theo mô tả của chủ sản phẩm)
Bên phải Builder có một panel liệt kê các vấn đề AI đã tìm, mỗi vấn đề có "trước / sau", một nút **Apply** đưa gợi ý vào đúng ô trong CV, và điểm **ATS Readiness cập nhật ngay khi người dùng sửa**.

## 2. Hiện trạng [CODE]
- Điểm do code tính: `computeDeterministicScore(text)` (ba kiểm tra: đủ mục, bullet có số liệu, ngày nhất quán). Hàm nhận **văn bản**, không nhận dữ liệu có cấu trúc.
- Vấn đề do AI viết trong `parseResume` (`ATSBuilder.jsx`), lưu ở `profile.issues`: `severity, title, description, before, after, builderStep`. `before` là câu **trích nguyên văn** từ CV.
- Builder giữ dữ liệu có cấu trúc `data` (contact, summary, experience[].bullets, education, skills, awards, extras), tự lưu nháp vào localStorage.
- "Fix in Builder" (PR #65) chỉ mở đúng bước và nhắc lại vấn đề; chưa sửa gì hộ.
- Có sẵn chốt chặn con số bịa: `neutralizeInventedFigures(text, source)` đổi số lạ thành `[X]`; `revertInsertion` để hoàn tác.

## 3. Thiết kế

### 3.1 Điểm sống (code, miễn phí, không gọi AI)
- Hàm thuần mới `builderDataToText(data)`: xếp `data` thành văn bản CV có tiêu đề mục chuẩn (Summary, Work Experience, Education, Skills, Awards, extras), rồi chạy `computeDeterministicScore`. Debounce ~300 ms.
- Panel hiện: điểm, ba thành phần với bằng chứng của code, danh sách "còn thiếu" (`score.missing`).
- Nhãn: "Tính bằng code từ nội dung đang sửa". Điểm **chỉ** phản ánh ba kiểm tra đó; panel nói rõ gợi ý của AI có thể không làm điểm đổi.

### 3.2 Danh sách vấn đề và Apply
- Nguồn: `profile.issues` (AI, đã có). **Danh sách hữu hạn: AI không thêm vấn đề mới khi người dùng sửa.**
- Mỗi thẻ: mức độ, tiêu đề, mô tả, trước/sau, trạng thái (Chưa làm / Đã áp dụng / Đã bỏ qua).
- **Apply chỉ bật khi tìm được `before` đúng một chỗ** trong ô sửa được (summary hoặc một bullet; so khớp sau khi chuẩn hoá khoảng trắng). Khi đó thay `before` bằng `after` **sau khi** đi qua `neutralizeInventedFigures(after, văn bản CV hiện tại)`.
- Không tìm thấy, tìm thấy nhiều chỗ, hoặc vấn đề không có `before` (ví dụ thiếu mục): nút là "Edit this step" (mở đúng bước như hiện nay). **Không đoán vị trí.**
- Số lạ trong `after` thành `[X]`: thẻ hiện "Điền số thật vào [X]"; ô chứa `[X]` được đánh dấu. [PROPOSAL] không chặn xuất file, nhưng khi bấm tải PDF/Word mà còn `[X]` thì hỏi lại một lần.
- Hoàn tác: ghi `{inserted, original}` cho mỗi lần Apply; nút Undo dùng `revertInsertion`; nếu người dùng đã sửa tay đoạn đó thì nói rõ không hoàn tác được.
- Gợi ý của AI là **đề xuất người dùng chấp nhận**, không tự áp dụng. Nhãn "AI draft: kiểm tra mọi con số và phạm vi trách nhiệm" (chốt chặn chỉ phủ con số, không phủ việc đẩy quyền sở hữu hay quy mô; xem `docs/VERIFICATION_STATUS.md`).

### 3.3 Mục từ code [PROPOSAL]
Các mục trong `score.missing` (thiếu email, không có bullet nào có số liệu, ngày mâu thuẫn...) hiện như thẻ "do kiểm tra của code", có nút mở đúng bước, không cần AI. Như vậy panel vẫn hữu ích khi chưa chạy phân tích AI hoặc AI hỏng.

### 3.4 Chỗ đặt [PROPOSAL]
Cột phải của Builder, phía trên bản xem trước, gập được. Trên màn hình hẹp xếp dưới form.

## 4. Không làm trong đợt này
- Không gọi AI mỗi lần gõ; không tạo vấn đề mới sau khi sửa; không tự áp dụng gì.
- Không đổi công thức điểm, không thêm ngưỡng độ dài/độ sâu (xem quyết định về cảnh báo "độ sâu kinh nghiệm", làm riêng).
- Không lưu trạng thái Apply ngoài trình duyệt (như nháp hiện tại).

## 5. Rủi ro đã biết
- Điểm của Builder tính trên văn bản dựng lại từ dữ liệu có cấu trúc, nên có thể khác điểm của chính nội dung đó khi tải lên dưới dạng file. **Đã đo (2026-10-12, 7 CV tổng hợp, `builderEquivalence.test.js`): 6/7 trùng điểm; 1/7 lệch 7 điểm.** Nguyên nhân của ca lệch nằm ở **bộ đọc file tải lên**, không phải Builder: dòng tiêu đề công việc dạng "Title, Company" đứng riêng sau một dòng trống bị tính là bullet của công việc trước (3 bullet đọc thành 4). Đã ghi thành test `it.fails`, cần PR sửa bộ đọc riêng. Mẫu 7 CV là nhỏ và tổng hợp: chưa đủ để nói "hai điểm bằng nhau" với CV thật; panel ghi rõ hai con số có thể lệch vài điểm.
- Điểm do code tính xác định và minh bạch về nguồn, nhưng **chưa được kiểm chứng là dự đoán được kết quả của một ATS cụ thể**; panel nói rõ điều này.
- `before` do AI trích có thể không khớp nguyên văn: khi đó Apply tắt (đã nêu ở 3.2).

## 6. Thứ tự làm
1. `builderDataToText` + panel điểm sống (+ test điểm đổi khi sửa).
2. Thẻ vấn đề + Apply/Undo + chốt chặn số (+ test các nhánh: khớp 1, 0, nhiều chỗ, số lạ).
3. Mục từ code (3.3).
