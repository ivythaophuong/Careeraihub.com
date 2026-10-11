# Thiết kế: Mock Interview, Tầng 0 (Structure Feedback) và AI Feedback theo yêu cầu

Trạng thái: **DESIGN ONLY. Chưa viết code, chưa SQL, chưa đổi hệ thống chấm điểm đang chạy.** Cần chủ sản phẩm duyệt từng phần ở mục 11.
Viết 2026-10-11 cho chủ sản phẩm (Ivy). Thuật ngữ kỹ thuật giữ tiếng Anh.
Nhãn bằng chứng: **[CODE]** đọc trong mã · **[ACCEPT]** nằm trong `ACCEPTANCE-deterministic-practice-scores.md` (quyết định đã duyệt của chủ sản phẩm) · **[PROPOSAL]** đề xuất mới, chưa duyệt · **[UNKNOWN]** chưa xác định.

**Phạm vi ngôn ngữ (chủ sản phẩm, 2026-10-11): nền tảng chỉ phục vụ người dùng tiếng Anh.** Trong thiết kế này chỉ tiếng Anh cần được kiểm chứng và bật; tiếng Việt giữ `unsupported_language`, không mở nhánh kiểm chứng tiếng Việt. Các danh sách từ tiếng Việt trong code vẫn còn nhưng không được bật.

Tài liệu liên quan: `ACCEPTANCE-deterministic-practice-scores.md`, `supabase/functions/_shared/structure/README.md`, `docs/audits/INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md`, ADR-011, ADR-012.

---

## 1. Mục tiêu và nguyên tắc

1. Người dùng nhận **phản hồi tức thì, miễn phí** về hình thức câu trả lời, không cần AI.
2. AI chỉ chạy **khi người dùng yêu cầu**, để giải thích và gợi ý cách nói. AI không đặt điểm.
3. Ba thứ luôn tách biệt, về dữ liệu lẫn giao diện: **Structure Score** (code), **AI Feedback** (lời văn do AI viết), **Trust Score** (không đổi trong thiết kế này).
4. Không ai bị hiển thị một con số khi chưa đủ dữ liệu, chưa hỗ trợ ngôn ngữ, hoặc chưa qua kiểm chứng.
5. Không dùng thời gian, dán chữ hay chuyển tab làm đầu vào (ADR-012; `interviewStructure.js` đầu file đã ghi rõ).

## 2. Hiện trạng [CODE]

- Mock Interview (`HiringManagerSim.jsx`): AI chấm điểm từng câu (qua `score-interview`), code chỉ kẹp 0–100 và tính verdict; điểm trung bình phiên đi vào `mock_sessions` và từ đó vào `trust_score`.
- `supabase/functions/_shared/structure/` (Gate A) đã có bộ chấm cấu trúc thuần code cho câu trả lời phỏng vấn (`interviewStructure.js`) và câu STAR. **Không có gì trong app dùng nó** (README của thư mục). `ENABLED_LANGUAGES` hiện là danh sách **rỗng** (`languageGate.js:4`), nghĩa là kết quả hiện luôn là `unsupported_language` cho tới khi một ngôn ngữ được bật có chủ đích.
- Chưa có hẹn giờ, chưa có ghi âm.

## 3. Điều quan trọng cần nói thẳng: AI score và Structure Score

Một nhận xét gần đây đề nghị "chưa nên thay ngay điểm AI hiện tại". Hai điều đã được duyệt trước đó cần đặt cạnh nhau:

- **[ACCEPT] §5:** khi Structure Score ra mắt, phản hồi AI **không được hiện điểm 0–100 do AI tạo**; điểm AI không được dùng làm điểm tất định, không được vào Trust Score, không được lưu như một kết quả tất định mới; điểm AI lịch sử phải còn phân biệt được, không bị gắn nhãn lại.
- Nhưng việc bật Structure Score cho người dùng còn phải qua Gate B (API + UI), Gate C (beta + hiệu chỉnh) và duyệt ngôn ngữ.

**Cách dung hòa (đề xuất):** hai trạng thái chuyển tiếp rõ ràng, không thay thế ngầm.
1. **Hiện tại → Gate B:** Mock Interview giữ nguyên hành vi hiện tại (AI chấm). Không đổi gì.
2. **Khi Tầng 0 được bật cho một ngôn ngữ đã qua kiểm chứng:** Tầng 0 xuất hiện **bên cạnh**; AI Feedback chuyển sang dạng văn bản, **không còn số do AI tạo** đúng như [ACCEPT] §5. Đây là một lần chuyển có chủ đích, có test giao diện chứng minh không còn con số AI, và cần chủ sản phẩm duyệt riêng (câu hỏi D3).
3. Không bao giờ có giai đoạn hiển thị hai con số cạnh tranh nhau cho cùng một câu trả lời.

## 4. Luồng giao diện [PROPOSAL]

Mỗi câu hỏi:
1. Hiện câu hỏi. Hẹn giờ **tùy chọn, mặc định ẩn** (nút "Show timer"), đếm lên, có thể tạm dừng, không cắt câu trả lời (đã bàn ở phần nghiên cứu thời gian). Gợi ý "câu behavioural thường 1 đến 2 phút" chỉ là lời khuyên.
2. Người dùng nhập câu trả lời (giai đoạn A chỉ có text).
3. Bấm **Check structure** → chạy Tầng 0 tại chỗ, **không gọi mạng, không gọi AI**, hiện ngay danh sách kiểm tra (xem mục 5).
4. Bấm **Get AI feedback** (nút riêng, có ghi "uses your AI allowance" khi hạn mức tồn tại) → Tầng 1.
5. Sang câu kế tiếp. Cuối phiên: tổng hợp (mục 6).

Không có đồng hồ đếm ngược, không có hạn chót bắt buộc, không có tín hiệu hành vi.

## 5. Tầng 0: Structure Feedback (không AI)

Dùng nguyên `scoreInterviewAnswer` làm nguồn sự thật; giao diện chỉ hiển thị kết quả, không tính lại.

**Chạy ở đâu:** [PROPOSAL] ở trình duyệt, bằng chính module đã có, để phản hồi tức thì và không tốn một request nào. Điều kiện: module phải thuần (không phụ thuộc Deno), hiện nằm dưới `supabase/functions/_shared/` nên cần quyết định chia sẻ mã giữa web và Edge (D4). Nếu sau này điểm được **lưu**, việc tính phải lặp lại ở server (không tin số do trình duyệt gửi, ADR-003).

**Hiển thị:** danh sách kiểm tra bằng lời dễ hiểu từ `evidence` (ví dụ "Chưa thấy con số hay chi tiết đếm được", "Câu trả lời nói nhiều về 'chúng tôi', bạn đã nêu phần của riêng mình chưa?"). Điểm số tổng chỉ hiện khi qua cổng ở mục 9; nếu chưa, chỉ hiện checklist, **không con số**.

**Ánh xạ trạng thái sang giao diện** [ACCEPT §5 + contract.js]:

| `status` | Điều người dùng thấy |
|---|---|
| `scored` | Checklist + (nếu đã qua cổng) Structure Score kèm nhãn **beta**, kèm câu "đo hình thức, không đo sự thật, năng lực hay mức phù hợp tuyển dụng" |
| `insufficient_data` | "Câu trả lời còn quá ngắn để kiểm tra cấu trúc" + còn thiếu gì. **Không con số, không 0.** |
| `unsupported_language` | "Chúng tôi chưa kiểm tra cấu trúc cho ngôn ngữ này." **Không điểm thấp giả.** AI Feedback vẫn dùng được nếu người dùng yêu cầu |
| `processing_error` | "Không kiểm tra được lần này. Thử lại." Lỗi xử lý không bao giờ là điểm |

Mọi câu chữ nằm trong một file duy nhất để duyệt (cách `consentCopy.js` đang làm).

## 6. Cuối phiên

Điểm phiên (nếu qua cổng) là trung bình các câu `scored`; câu bỏ qua, quá ngắn, ngôn ngữ chưa hỗ trợ, lỗi, hoặc phiên bản quy tắc khác không bị tính là 0 mà được liệt kê trong bằng chứng [CODE, structure README]. Không có đủ câu `scored` thì không có điểm phiên.

## 7. Tầng 1: AI Feedback theo yêu cầu

- **Chỉ chạy khi bấm nút.** Không chạy tự động sau khi nộp câu trả lời.
- **Nội dung gửi cho AI** [PROPOSAL, chỉnh theo nhận xét gần đây]: câu hỏi, **toàn bộ câu trả lời** (đã bị chặn ≤3000 ký tự nên rẻ), và **bản tóm tắt có cấu trúc** từ Tầng 0 (kiểm tra nào đạt, kiểm tra nào chưa) kèm các đoạn cần giải thích. Không chỉ gửi vài câu bị đánh dấu yếu, vì AI có thể thiếu ngữ cảnh. Phần tốn nhất trong prompt hiện nay là **CV** (≤6000 ký tự); mặc định **không gửi CV**, chỉ gửi bản rút gọn khi câu hỏi hỏi về kinh nghiệm của chính người dùng (hành vi này cần duyệt, D5).
- **Đầu ra:** lời văn gồm điểm mạnh, khoảng trống, gợi ý hành động; **không có điểm 0–100 do AI tạo** [ACCEPT §5]. Gắn nhãn "AI-generated guidance, not a verified assessment". Tách biệt trực quan với khối Tầng 0.
- **Giữ nguyên các lớp bảo vệ có sẵn:** người dùng không gửi được model hay prompt tùy ý; guard số liệu bịa (`findInventedInFeedback`); trần token do server đặt.

## 8. Kiểm soát chi phí và chống gọi lặp [PROPOSAL, phụ thuộc PR 2 đến 5]

| Cơ chế | Cách làm | Phụ thuộc |
|---|---|---|
| Không gọi AI nếu chưa cần | Tầng 0 không dùng mạng; Tầng 1 chỉ khi bấm | giao diện |
| Không gọi AI cho nội dung quá ngắn | dùng `insufficient_data` để chặn nút | Tầng 0 |
| **Cache** | Khóa = hash của (nội dung câu hỏi + câu trả lời đã chuẩn hóa) **cộng** phiên bản prompt, model, phiên bản rubric/quy tắc (`rulesFingerprint`), ngôn ngữ. Đổi bất kỳ thành phần nào thì khóa mới | PR 3 (phiên, sổ cái) |
| Idempotency | Bấm hai lần không tạo hai lời gọi | PR 3 |
| Trần chi phí tối đa | công thức theo trần kích thước (xem trao đổi về chi phí tất định) + giữ chỗ Cách B | PR 5 |
| Chọn model | server quyết định; không để trình duyệt chọn | đã có |

Cache nội dung người dùng là dữ liệu cá nhân: cần quyết định lưu ở đâu, bao lâu, và có xóa được không (D6). Chưa được tự quyết.

## 9. Kiểm chứng và điều kiện hiển thị điểm

Phản hồi định tính (checklist) và con số tổng hợp là hai mức khác nhau. Theo [ACCEPT §6 và §7], hiện:
- Một ngôn ngữ chỉ được bật khi bộ test và bước người xem xét của ngôn ngữ đó đạt (`ENABLED_LANGUAGES` đang rỗng).
- Con số cần: ít nhất 50 câu STAR thật được người chấm duyệt, đủ loại (mạnh, yếu, thiếu, độn chữ, nói về cả nhóm, có số nhưng lạc đề), tách tiếng Anh/tiếng Việt, báo cáo sai lệch, chủ sản phẩm duyệt, nhãn beta.
- **Câu trả lời phỏng vấn cần tập đánh giá riêng**; 50 câu STAR không chứng minh bộ chấm câu trả lời phỏng vấn.

**Phạm vi:** chỉ tiếng Anh cần qua cổng. Cổng ngôn ngữ của tiếng Việt trong [ACCEPT §6] không áp dụng cho thiết kế này vì tiếng Việt không được phục vụ.

**Bổ sung đề xuất (chưa trong ACCEPT):**
- 50 là mức tối thiểu, không phải bằng chứng đủ mạnh. Cần mô tả độ phủ: ngành nghề, cấp độ kinh nghiệm, kiểu trả lời, và báo cáo rõ phần nào chưa phủ.
- Có bộ tiêu chí chấm viết sẵn và độc lập với người viết quy tắc; tốt nhất ít nhất hai người đánh giá và đo mức đồng thuận. Nếu chỉ có một người, nói rõ giới hạn.
- Kiểm tra thiên lệch theo ngôn ngữ và phong cách viết (ví dụ người dùng tiếng Anh không phải tiếng mẹ đẻ).
- Mọi thay đổi ngưỡng đi qua thay đổi có phiên bản + test hồi quy [ACCEPT §7].

**Về việc hiển thị checklist trước khi hiệu chỉnh xong:** nhận xét gần đây đề nghị cho thử checklist định tính sớm. [ACCEPT §6] nói rõ ngôn ngữ chỉ bật khi qua cổng của nó, và checklist dùng chính các kiểm tra đó. Vì vậy **không bật ngầm**. Nếu chủ sản phẩm muốn một giai đoạn thử nghiệm checklist cho nhóm nhỏ trước, đó là một quyết định ngoại lệ cần được ghi lại (D1), kèm điều kiện: nhóm nhỏ, nhãn beta, không con số, không lưu, không ảnh hưởng điểm nào.

## 10. Ngoài phạm vi

Ghi âm thật và chuyển giọng nói thành chữ (giai đoạn B, sau PR 5), đổi công thức `trust_score`, thay hệ thống chấm điểm đang chạy một cách ngầm, SQL, tín hiệu dán/chuyển tab, hạn mức tiền, chọn nhà cung cấp giọng nói.

**Thứ tự:** PR 1 tài liệu nền tảng (đang chờ review) → PR 2 hạn chót + đo lường → **thiết kế này được duyệt** → thực hiện từng phần nhỏ sau review. Thiết kế này không cần chờ PR 2 vì không tạo chi phí AI và không đổi hệ thống.

## 11. Quyết định cần chủ sản phẩm

| # | Câu hỏi | Đề xuất của trợ lý |
|---|---|---|
| D1 | Cho phép giai đoạn thử checklist (không con số) cho nhóm nhỏ trước khi ngôn ngữ qua cổng đầy đủ? | Chỉ nếu ghi lại như ngoại lệ có điều kiện ở mục 9; mặc định là **không** |
| D2 | Tiêu chí số lượng và độ phủ cho tập đánh giá câu trả lời phỏng vấn (tách khỏi 50 câu STAR). Chỉ tiếng Anh. | Chủ sản phẩm đặt; trợ lý đề xuất độ phủ ở mục 9 |
| D3 | Thời điểm bỏ điểm AI số trong Mock Interview và thay bằng Structure Score + AI Feedback văn bản | Cùng lúc Tầng 0 được bật cho một ngôn ngữ, đúng [ACCEPT §5]; không đổi trước |
| D4 | Cách chia sẻ module chấm cấu trúc giữa trình duyệt và Edge Function | Cần khảo sát riêng (UNKNOWN: module có phụ thuộc Deno không); không tự quyết |
| D5 | Có gửi CV cho AI Feedback không, và khi nào | Mặc định không; gửi bản rút gọn khi câu hỏi liên quan kinh nghiệm cá nhân |
| D6 | Cache nội dung người dùng: lưu ở đâu, bao lâu, xóa thế nào | Cần quyết định cùng chính sách quyền riêng tư; chưa làm cache cho tới lúc đó |
| D7 | Hẹn giờ tùy chọn mặc định ẩn, đếm lên, không cắt câu trả lời | Duyệt như đã bàn |

## 12. Tiêu chí hoàn thành của thiết kế này

Chủ sản phẩm trả lời D1 đến D7 (hoặc chỉ định cái nào hoãn). Sau đó mới viết brief triển khai từng PR nhỏ, mỗi PR có test giao diện: không con số AI, đủ bốn trạng thái, nhãn beta, Tầng 0 không gọi mạng.
