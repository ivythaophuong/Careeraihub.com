# Audit: AI Career Coach (dữ liệu gửi đi, token, giới hạn, độ chính xác của bối cảnh)

Trạng thái: **báo cáo đo lường và kiểm chứng (không đổi hành vi nào bởi chính tài liệu này).** Cập nhật sau khi viết: đề xuất A đã được làm và merge (PR #74, cửa sổ lịch sử); đề xuất B đã có PR riêng (độ chính xác của bối cảnh); C, D, E chưa làm (D, E chưa được duyệt). Viết 2026-10-12 cho chủ sản phẩm (Ivy). Thuật ngữ kỹ thuật giữ tiếng Anh.
Nhãn: **[CODE]** đọc trong mã · **[MEASURED-SYNTHETIC]** đo trên dữ liệu tổng hợp, **không phải dữ liệu production** · **[PROPOSAL]** · **[UNKNOWN]**.

## 0. Đính chính một ước tính trước đây
Trong báo cáo trước tôi viết "khoảng 9 nghìn token mỗi lần gửi ở 60 tin, tăng khoảng 20 lần". Con số đó là suy ra từ các giới hạn trong mã, chưa đo, và **số đo dưới đây không ủng hộ nó trong điều kiện vận hành thực**: Coach không bao giờ gửi được 60 tin, vì server từ chối từ tin nhắn thứ 10 (mục 2). Chi phí đầu vào bị chặn bởi chính lỗi đó, không bởi một thiết kế.

## 1. Luồng dữ liệu [CODE]
`AICoach.jsx` → `send()` dựng yêu cầu gồm:
1. Một **cặp tin nhắn giả** ở đầu: `[COACH CONTEXT] … [END CONTEXT] Acknowledge you have this context.` (khối bối cảnh từ `buildSystemPrompt`) và trả lời giả "Understood — I have your full profile context loaded."
2. **Toàn bộ** tin nhắn của cuộc trò chuyện (không cắt), gồm cả lời chào đầu.
3. Tin nhắn mới.
→ `callLLMFor('ai_coach')(history, 600)` → hàm `ai` (`supabase/functions/ai`). Trần trả lời 600 token; prompt dặn dưới 200 từ.
Bộ nhớ lưu 60 tin gần nhất (`aiChat`, trong `user_memory`); trong một phiên số tin không bị giới hạn khi gửi.

## 2. Giới hạn của server: phát hiện chính [CODE + MEASURED-SYNTHETIC]
`supabase/functions/ai/handler.js`: `LIMITS.maxMessages = 20`; một yêu cầu quá 20 tin bị trả về HTTP 400 "messages must be an array of 1–20 items." Giới hạn này có từ commit đầu tiên của hàm (`9642a2e`). Client không cắt lịch sử.

Đo bằng **chính mã `handleRequest` thật** với yêu cầu tổng hợp dựng đúng như `send()`:

| Tin nhắn người dùng thứ | Số tin gửi đi | Kết quả |
|---|---|---|
| 1 đến 9 | 4, 6, … 20 | HTTP 200 |
| **10** | **22** | **HTTP 400** |
| 11, 12, 13… | 24, 26, 28… | HTTP 400 |

Hệ quả: sau 9 lượt hỏi đáp, **mọi tin nhắn tiếp theo đều thất bại** cho đến khi người dùng bấm xóa chat. Giao diện hiện thông báo "Something went wrong: …". Trần 60 tin của bộ nhớ không bao giờ chạm tới.
Giới hạn của chứng cứ: đây là kết quả của mã trong repo trên yêu cầu tổng hợp. **[UNKNOWN]** hàm `ai` đang chạy trên production có cùng giới hạn không (hàm đã được deploy từ `main` sau PR #54, nhưng chưa xác nhận bằng một phiên thật). Cách xác nhận: mở Coach trên môi trường thật và gửi 10 tin liên tiếp.
Test đặc tả ban đầu là `it.fails`; đã được chuyển thành test thường khi sửa (PR #74, `src/features/AICoach/AICoach.limits.test.jsx`).

## 3. Token đầu vào [MEASURED-SYNTHETIC, phương pháp ghi rõ]
**Phương pháp.** Bộ đếm là `gpt-tokenizer` (tokenizer của OpenAI, cài **ngoài repo**), tức là **một xấp xỉ**: mô hình thật đang dùng là **[UNKNOWN]** (do secret `AI_PROVIDER`; mặc định trong mã là `claude-sonnet-5-5` hoặc `gemini-3.8-flash`) và không có bộ đếm offline của chúng. Số liệu chính xác chỉ có từ các dòng log `ai_usage` do server ghi (token do nhà cung cấp báo, `feature = ai_coach`); chưa thu thập (xem mục 7). Dữ liệu: bộ nhớ tổng hợp (5 STAR, 3 phiên phỏng vấn, 3 JD, 7 kỹ năng thiếu) và hội thoại sinh từ câu mẫu; độ dài câu trả lời của trợ lý là **giả định** (80, 180, 400 từ), không phải đo từ mô hình.

Khối bối cảnh: 783 ký tự = **179 token** (bộ nhớ rỗng: 79). Tỉ lệ 4,37 ký tự/token.

Tổng token đầu vào mỗi lần gửi, theo số tin trước đó (cột giữa là tin đã gửi cả khối bối cảnh và tin mới):

| Tin trước đó | Tin gửi đi | Trả lời ~80 từ | Trả lời ~180 từ | Trả lời ~400 từ |
|---|---|---|---|---|
| 1 (chỉ lời chào) | 4 | 256 | 256 | 256 |
| 9 | 12 | 673 | 1.120 | 2.105 |
| **17 (mức tối đa server chấp nhận)** | **20** | **1.086** | **1.983** | **3.951** |
| 61 (hiện server không nhận) | 64 | 3.377 | 6.737 | 14.117 |

Đọc kết quả:
- Ở mức tối đa mà server chấp nhận, đầu vào mỗi lần gửi khoảng **1.100 đến 4.000 token** (gấp khoảng 4 đến 15 lần tin đầu), phần lớn là lịch sử. Khối bối cảnh chỉ khoảng 200 token, **khoảng 10 đến 20%** của một yêu cầu ở mức tối đa.
- Con số này phụ thuộc mạnh vào độ dài thật của câu trả lời; mô hình thật có thể trả lời dài hơn hoặc ngắn hơn giả định.
- Đầu ra (tối đa 600 token mỗi lần) **chưa đo**.
- Không số nào ở đây là số production.

## 4. Dữ liệu trong bối cảnh: lỗi thời, thiếu, hoặc không có cơ sở [CODE]
| Dòng trong bối cảnh | Vấn đề | Bằng chứng |
|---|---|---|
| `Latest resume ATS score: N/100` | Lấy từ `memory.scanHistory`, **không có nơi ghi mới**; chỉ có thể là dòng cũ từ `resume_scans` (5 dòng, cuối cùng 2026-05-22), có thể là điểm AI cũ, trình bày như sự thật hiện tại | `AICoach.jsx:20`; `useMemory.js` chỉ đọc từ bảng; không có nơi ghi `scanHistory` |
| `Market: Singapore` | Khi người dùng chưa chọn thì vẫn **bịa** "Singapore": giá trị mặc định của `form.market` trong `App.jsx`, cộng `|| 'Singapore'` | `App.jsx:77`, `AICoach.jsx` |
| `Industry: Tech` | Khi trống thì **bịa** "Tech" | `AICoach.jsx` (`form?.industry \|\| 'Tech'`) |
| `Best STAR: "…"` | Là câu chuyện **mới nhất** (`starBank[0]`, mới được thêm vào đầu), không phải câu "tốt nhất" | `STARBuilder.jsx:102` |
| `latest score N/100` của phỏng vấn | Là điểm **do AI ước lượng** của lần thử đầu, không được ghi nhãn là ước lượng; Coach có thể coi là sự thật | `interview` scoring (D8) |
| Lời chào "I have full context on your profile — your resume scans…" | Nói quá: bối cảnh chỉ có vài con số và đếm, **không có văn bản CV, không có nội dung STAR, không có câu trả lời phỏng vấn** | `buildSystemPrompt` |
| Câu gợi ý "Why is my ATS score low?" | Coach **không có dữ liệu** để trả lời (không có văn bản CV hay chi tiết điểm): chỉ trả lời chung chung | `QUICK_PROMPTS` |
| Chip "Resume scans (N)" ở phần Memory của Coach | Cùng nguồn `scanHistory` lỗi thời | `AICoach.jsx:216` |

## 5. Câu hỏi nào trả lời được bằng code, không cần AI [PROPOSAL]
| Câu hỏi | Cách trả lời tất định | Ghi chú |
|---|---|---|
| "What should I focus on this week?" | `nextActions()` của Career Roadmap (dựa trên trạng thái thật, đã có test) | Nội dung là các việc cần làm kèm số đếm thật; AI có thể chỉ diễn giải thêm |
| "Why is my ATS score low?" | `computeDeterministicScore(resumeText)` + `codeFindings` (đã có) nếu có văn bản CV | Hiện trả lời chung chung vì không có dữ liệu |
| Điểm phỏng vấn gần nhất, số STAR, số JD đã phân tích | Đọc từ `memory` | Phải ghi rõ "điểm do AI ước lượng, lần thử đầu" |
| Cách trả lời câu "điểm yếu lớn nhất", đàm phán lương, chiến lược nộp đơn | **Cần AI** (lời khuyên chung) | |
Cách đưa vào: **nút cố định** ("My data", "What to do next") gọi các hàm trên, không phân loại ý định từ văn bản tự do (dễ sai và không kiểm chứng được).

## 6. Đề xuất tối ưu và cách kiểm chứng [PROPOSAL; chưa làm gì]
| # | Đề xuất | Tác động dự kiến | Kiểm chứng |
|---|---|---|---|
| A | Cửa sổ lịch sử: chỉ gửi vài lượt gần nhất để **không bao giờ vượt `maxMessages`** (giữ khối bối cảnh và tin mới) | Bỏ lỗi từ tin thứ 10; đầu vào bị chặn ở khoảng 1–4 nghìn token (mục 3) | Test `AICoach.limits.test.jsx` đổi `it.fails` thành `it`; thử một cuộc trò chuyện dài trên bản thật; **chất lượng** đánh giá bằng người trên bộ ~20 câu hỏi có ngữ cảnh nhiều lượt, trước và sau |
| B | Bỏ dữ liệu lỗi thời và bịa: bỏ `scanHistory`, bỏ mặc định Singapore/Tech, đổi "Best STAR" thành "Latest STAR", ghi nhãn điểm phỏng vấn là ước lượng của AI, sửa lời chào | Bối cảnh đúng sự thật; không tốn thêm token | Test cho từng dòng của `buildSystemPrompt`: mỗi dòng truy ra một nguồn còn sống |
| C | Nút trả lời bằng code cho câu hỏi về dữ liệu của chính người dùng và "việc nên làm" | Bớt một phần lệnh gọi AI (tỉ lệ **chưa biết**, cần đo xem người dùng thật hỏi gì) | Test: câu trả lời khớp `nextActions` và `memory`; đếm số lệnh gọi AI giảm trên cùng kịch bản |
| D | Tóm tắt các lượt cũ thay vì bỏ | Giữ ngữ cảnh dài hơn | **Chỉ sau khi A có số liệu**; chất lượng tóm tắt phải đo; thêm một lệnh gọi AI |
| E | Prompt caching | **Giả thuyết**: chưa biết nhà cung cấp, định dạng, điều kiện cache, kích thước tối thiểu. Bộ đọc usage hiện **không đọc trường token cache** nên chưa quan sát được khoản tiết kiệm | Mở rộng đo lường trước; không ghi tiết kiệm dự kiến như kết quả |

Thứ tự đề xuất: B và A là sửa lỗi đúng sự thật và độ tin cậy (không phụ thuộc đo lường chi phí); C sau; D và E chỉ khi có số liệu thật.

## 7. Cách thu số liệu thật (cần chủ sản phẩm làm)
Hàm `ai` ghi mỗi lần gọi một dòng `ai_usage` với token do nhà cung cấp báo. Để có số production cho Coach: dùng Coach vài cuộc trò chuyện **trên tài khoản thử với dữ liệu giả**, rồi Supabase dashboard > Functions > `ai` > Logs, tìm `ai_coach`, sao chép và lưu bằng `pbpaste > file` (ngoài repo). Em sẽ đọc các file đó. Đây là giai đoạn đo lường Stage 1 chưa thu.

## 8. Tiêu chí nghiệm thu cho các thay đổi sau này
- **Độ chính xác dữ liệu:** mỗi dòng trong bối cảnh truy được về một nguồn đang được ghi, có nhãn (ước lượng của AI, đếm, mặc định); không dòng nào bịa giá trị khi người dùng chưa nhập.
- **Token đầu vào:** đo bằng log `ai_usage` thật (hoặc phương pháp ước tính ghi rõ), tách khối bối cảnh, lịch sử và tin mới; không dùng số mô phỏng như số production.
- **Giới hạn:** một cuộc trò chuyện dài không bao giờ bị server từ chối vì số tin.
- **Chất lượng câu trả lời:** bộ câu hỏi nhiều lượt đánh giá bằng người trước và sau; ghi nhận cả trường hợp xấu đi.
