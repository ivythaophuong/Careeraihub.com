# P1: thiết kế sửa bộ đọc CV (B6 và B7), chỉ thiết kế

Trạng thái: **THIẾT KẾ, CHƯA TRIỂN KHAI. Không sửa code, SQL, cấu hình hay dữ liệu. Chưa commit.** Viết 2026-10-11 cho chủ sản phẩm (Ivy). Cơ sở: `main` @ `10bf9ab`.
Nguồn lỗi: `docs/audits/MANUAL-TEST-FINDINGS-2026-10-11.md` (B6, B7). Nhãn: **VERIFIED** (đọc mã hoặc chạy thử cục bộ) · **PROPOSAL** · **UNKNOWN**.
Dữ liệu thử: CV tổng hợp "Jordan Lee" (không phải người thật), ngoài repo, `~/stage1-measurement/`.

## 1. Nguyên nhân gốc (đã xác minh)

| Hiện tượng | Nguyên nhân gốc | Bằng chứng |
|---|---|---|
| Tên "not found" khi dòng đầu là `Tên \| Chức danh`, `Jordan A. Lee, MBA`, `Name: Jordan Lee` | `nameShaped` đòi **cả dòng** gồm 1 đến 6 từ chỉ chứa chữ, dấu nháy, chấm, gạch nối. Dấu `\|`, dấu phẩy, dấu hai chấm làm cả dòng bị loại | `src/extraction/contact.js:41-52` |
| Tên "not found" khi dòng liên hệ đứng trước tên | `extractName` xét **tối đa ba dòng đầu** và **dừng ngay** khi dòng đầu không giống tên (`if (i === 0) return empty`). Dòng email không giống tên nên bỏ cuộc dù tên nằm ở dòng 2 | `contact.js:65-75` |
| Kỹ năng "not found" khi tiêu đề là `Technical Skills & Tools` | Tiêu đề được nhận bằng **một danh sách cố định** (bảng bí danh + `HEADING_BASE`). Biến thể không có trong danh sách thì không thành tiêu đề, và `SKILLS_SECTION` chỉ nhận ba tên (`skills`, `technical skills`, `core competencies`) | `resumeDigest.js:12-27`, `resumeFacts.js:15` |
| Mọi mục "not found" khi văn bản dán mất xuống dòng | `splitSections` cắt theo **dòng**; không còn dòng thì không có tiêu đề nào. Điểm 25 thay vì 85 | Thử cục bộ [VERIFIED] |
| **Dán và PDF cho điểm khác nhau**, "43 bullet" cho một CV ngắn | `extractTextFromPdfFile` ghép **mỗi mảnh chữ** (`item.str`) của pdf.js thành **một dòng riêng** (`join('\n')`). Một dòng có hai kiểu chữ (đậm rồi thường), ký hiệu bullet là một mảnh riêng, hay một câu bị ngắt giữa chừng đều thành nhiều dòng. Trên CV mẫu đơn giản, 45 mảnh thành 45 dòng, xen kẽ dòng trống. pdf.js có cờ `hasEOL` (hết dòng) và tọa độ mà **không được dùng** | `resumeParser.js:5-19`; chạy thử pdf.js trên CV mẫu [VERIFIED] |

Kết luận: các lỗi tên và kỹ năng là lỗi của **bộ đọc bằng code**, không phải của AI; lỗi chênh lệch dán/PDF nằm ở **bước dựng dòng từ PDF**.

## 2. Nguyên tắc sửa

1. Sửa ở **tầng đọc và chuẩn hóa văn bản**, một lần cho cả hai đường (dán và PDF), không vá từng từ khóa cho từng CV.
2. **Không biết thì để không biết.** Tên không chắc thì để trống (và báo), không đoán một chức danh thành tên.
3. Điểm chỉ đổi khi đổi đó **giải thích được bằng quy tắc đã định nghĩa**; mọi thay đổi quy tắc đi qua test hồi quy và tăng phiên bản (cơ chế `rulesFingerprint` đã có).
4. Bộ đọc **báo trung thực** khi không đọc được cấu trúc, thay vì cho một điểm thấp giả.

## 3. Thiết kế đề xuất (từng lớp, mỗi lớp một PR nhỏ)

### Lớp 1: dựng dòng từ PDF [PROPOSAL]
Thay `join('\n')` bằng việc **nhóm các mảnh theo dòng**: dùng `hasEOL` và tọa độ dọc (`transform[5]`) để nối các mảnh cùng dòng bằng một khoảng trắng khi có khoảng cách, bỏ dòng trống do mảnh rỗng, và nối ký hiệu bullet với câu đứng sau nó. Kết quả mong muốn: **một dòng trên giấy là một dòng trong văn bản**. Giới hạn đã biết: CV hai cột và bảng cần xử lý riêng (đó là cổng reader quality chưa đạt, không giải quyết trong lớp này).

### Lớp 2: chuẩn hóa văn bản chung [PROPOSAL]
Một hàm duy nhất áp dụng cho cả văn bản dán và văn bản trích từ PDF trước khi đọc: chuẩn hóa Unicode (NFC), đổi khoảng trắng đặc biệt (NBSP, zero-width) và dấu nháy cong về dạng chuẩn, thống nhất ký hiệu bullet, gộp các dòng trống liên tiếp. Mục đích: hai đường vào cùng văn bản giống nhau cho cùng một CV. Test tương đương: **cùng CV mẫu (txt và PDF) phải cho cùng các sự kiện và cùng điểm.**

### Lớp 3: tiêu đề mục theo lớp từ vựng [PROPOSAL]
Thay "danh sách cố định các tiêu đề" bằng **bộ phân loại**: một dòng là tiêu đề của mục X nếu ngắn (không quá khoảng năm từ), không có câu dài hay chữ số, và **mọi từ** thuộc tập từ của mục đó (danh từ chính cộng từ bổ nghĩa và từ nối `&`, `and`). Ví dụ mục kỹ năng: danh từ chính {skills, competencies, expertise, proficiencies, technologies, tools, tech stack, strengths}, từ bổ nghĩa {technical, core, key, professional, relevant, additional, soft, hard}. Cách này đã được dùng cho mục kinh nghiệm (tổ hợp sinh tự động); mở rộng cho kỹ năng, học vấn và các mục khác để nhất quán.

### Lớp 4: tên theo đoạn, không theo cả dòng [PROPOSAL]
- Tách dòng thành các **đoạn** theo `|`, `·`, `•`, `–`, dấu phẩy và nhãn kiểu `Name:`; lấy đoạn đầu giống tên.
- **Bỏ qua dòng chỉ chứa thông tin liên hệ** (email, số điện thoại, URL) khi tìm tên, thay vì dừng; xét tối đa vài dòng đầu.
- Loại đoạn trông như **chức danh** bằng một danh sách từ chức danh (analyst, engineer, manager, developer, designer, director, consultant...) và hậu tố bằng cấp (MBA, PhD, CPA, MSc...).
- Mơ hồ thì **để trống** (`requiresInterpretation`), không đoán. Độ tin cậy thấp hơn khi không phải dòng đầu.
Rủi ro: danh sách chức danh không bao giờ đầy đủ; hậu quả của việc sót là một chức danh bị nhận thành tên, nên cần test âm tính và giữ mức tin cậy thấp hơn khi đoạn không ở dòng đầu.

### Lớp 5: văn bản mất cấu trúc [PROPOSAL]
Phát hiện văn bản **gần như không có xuống dòng** so với độ dài. Khi đó **không chấm điểm thấp giả**: trả trạng thái `insufficient_data` với lý do ("văn bản này không còn xuống dòng, không đọc được các mục") và hướng dẫn dán lại hoặc tải tệp, kèm nút xem "text we read". Không tự cắt tiêu đề giữa dòng (dễ sai).

## 4. Kế hoạch kiểm thử (viết trước, chạy trước và sau)

| Nhóm | Nội dung |
|---|---|
| Biến thể đã tái hiện | 12 biến thể trên CV mẫu: tên kèm chức danh, tên có tên đệm và bằng cấp, liên hệ trước tên, nhãn `Name:`, tiêu đề kỹ năng nhiều dạng, một dòng, in hoa. Mỗi biến thể có kết quả kỳ vọng rõ |
| Tương đương dán và PDF | CV mẫu tổng hợp ở dạng txt và PDF (tệp PDF mẫu sinh bằng mã, **không** dùng CV thật) cho cùng sự kiện và cùng điểm |
| Dựng dòng PDF | Một dòng nhiều kiểu chữ, ký hiệu bullet tách rời, câu bị ngắt: mỗi tình huống thành đúng một dòng |
| Âm tính | Chức danh một mình ở dòng đầu không thành tên; email không thành tên; tiêu đề trông giống kỹ năng nhưng là câu dài không thành tiêu đề |
| Hồi quy | Toàn bộ test hiện có (đặc biệt `resumeDigest`, `contact`, `skills`, `computeDeterministicScore`, ATS Builder); `rulesFingerprint` được cập nhật có chủ đích |
| Báo cáo | Với mỗi thay đổi điểm trên bộ mẫu: ghi lý do bằng quy tắc |

## 5. Đề xuất chia PR

1. **PR 1:** Lớp 2 (chuẩn hóa chung) + Lớp 1 (dựng dòng PDF) + test tương đương dán/PDF.
2. **PR 2:** Lớp 3 (tiêu đề mục theo lớp từ vựng) + test kỹ năng.
3. **PR 3:** Lớp 4 (tên theo đoạn) + test tên.
4. **PR 4:** Lớp 5 (văn bản mất cấu trúc) + chữ trên giao diện.

Mỗi PR nhỏ, có test viết trước, không đổi điểm ngoài những thay đổi giải thích được.

## 6. Giới hạn và quyết định cần chủ sản phẩm

- **Chưa xử lý:** CV hai cột, bảng, biểu tượng (cổng reader quality, cần khoảng 30 CV ẩn danh ngoài repo và ngưỡng 95%/90% bạn chưa chốt).
- **Chưa tái hiện** lỗi tên và kỹ năng bằng đúng CV của bạn (không có nội dung đó trong repo). Nếu bạn có thể sao chép **hai dòng đầu** của CV và **tiêu đề mục kỹ năng** (đã xóa tên thật) dán vào đây, mình thêm đúng biến thể đó vào bộ test.
- **Quyết định:** (a) duyệt chia PR như mục 5? (b) dùng danh sách chức danh và bằng cấp ở Lớp 4 (chấp nhận không bao giờ đầy đủ) hay chỉ dựa vào vị trí và dạng chữ?
