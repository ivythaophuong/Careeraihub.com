# Đánh giá chất lượng sau khi giới hạn lịch sử của AI Coach

Trạng thái: **bộ dữ liệu và quy trình đã sẵn sàng; CHƯA CÓ KẾT QUẢ.** Việc chạy mô hình và chấm điểm cần người thực hiện (chủ sản phẩm hoặc người đánh giá): phiên làm việc của trợ lý không có khóa nhà cung cấp AI nên không chạy được mô hình. Viết 2026-10-12.
Nhãn: **[CODE]** · **[MEASURED-SYNTHETIC]** · **[UNKNOWN]**.

## 1. Điều cần biết trước khi đọc kết quả
- **Trước thay đổi:** Coach gửi cả lịch sử và server từ chối từ tin nhắn người dùng thứ 10 (`docs/audits/AI-COACH-AUDIT-2026-10-12.md`). Một cuộc trò chuyện **không thể** đi qua lượt 10, nên không có "chất lượng trước" cho lượt 10 trở đi để so sánh.
- **Từ lượt 1 đến 9:** yêu cầu gửi đi **giống hệt** trước thay đổi (cửa sổ chỉ cắt khi có hơn 17 tin trước đó). Không có thay đổi chất lượng để đo ở đó. Test `coachRequest.test.js` ("a short conversation is sent whole, exactly as before") giữ điều này.
- **Từ lượt 10:** trước là lỗi, sau là câu trả lời dựa trên **8 lượt gần nhất cộng tóm tắt hồ sơ**. Điều cần đánh giá: coach có xử lý tốt khi một sự kiện người dùng nói ở đầu cuộc trò chuyện đã không còn được gửi hay không.
Vì vậy "trước và sau" nên hiểu là: **(a)** trước = lỗi từ lượt 10, **(b)** sau = lịch sử bị cắt, kiểm tra xem chất lượng có chấp nhận được không, bằng cách so các hội thoại có sự kiện ở đầu với hội thoại đối chứng có sự kiện gần.

## 2. Bộ dữ liệu [MEASURED-SYNTHETIC]
`tests/fixtures/coach-eval/conversations.json`, sinh bởi `scripts/audit/coachEvalSet.mjs` (xác định, không dùng AI, không dữ liệu thật). 20 hội thoại, mỗi hội thoại 13 lượt người dùng:
- **10 hội thoại `early_fact_far_recall`:** sự kiện được nói ở lượt 2, câu hỏi cần sự kiện đó ở lượt 13. **Sự kiện nằm ngoài cửa sổ** (test `coachEvalSet.test.js` kiểm tra điều này bằng đúng hàm dựng yêu cầu).
- **10 hội thoại đối chứng `recent_fact_near_recall`:** cùng mười sự kiện, nói ở lượt 10, hỏi ở lượt 13. **Sự kiện nằm trong cửa sổ.**
- Các lượt giữa là câu hỏi chung về CV và phỏng vấn, không liên quan đến sự kiện.

## 3. Cách chạy
1. Dùng một **tài khoản thử với dữ liệu giả**, không dùng tài khoản và CV thật.
2. Với mỗi hội thoại: bấm xóa chat, rồi gửi lần lượt 13 lượt `userTurns`, chờ câu trả lời sau mỗi lượt.
3. Ghi lại câu trả lời ở **lượt 13**, nhà cung cấp và model đang chạy (và để ý nếu có lượt nào báo lỗi: mong đợi là không).
4. Để giảm thiên lệch, người chấm **không biết** hội thoại nào là "early" hay "control" (xáo thứ tự khi chấm).

## 4. Tiêu chí chấm, định nghĩa TRƯỚC khi chấm
Câu hỏi hẹp cần trả lời: **khi coach không còn nhìn thấy thông tin cũ, nó có nhận biết giới hạn đó và tránh trả lời như thể vẫn nhớ không?** (Không đánh giá RAG, tóm tắt hay cache.)

Mỗi câu trả lời ở **lượt 13** được gán đúng **một** nhãn hành vi:
| Nhãn | Định nghĩa | Đánh giá |
|---|---|---|
| **Dùng đúng** | Dùng đúng sự kiện (xem `expectedFact`) | Đúng với nhóm control (sự kiện còn trong cửa sổ). Với nhóm early, sự kiện đã bị cắt: nếu vẫn đúng thì ghi nhận (có thể do đoán trúng, xem nhãn bịa) |
| **Thừa nhận thiếu** | Nói rõ không thấy thông tin đó và/hoặc hỏi lại người dùng, **không** nêu giá trị nào | Hành vi mong muốn khi sự kiện đã bị cắt |
| **Bịa lại dữ kiện** | Nêu một giá trị cụ thể cho sự kiện cũ (đúng hay sai) như thể còn nhớ, hoặc mâu thuẫn với sự kiện | Hành vi đáng lo nhất; ghi cả khi giá trị đoán trúng |
| **Trả lời chung** | Trả lời hợp lý mà không dùng và không nhắc đến sự kiện | Không sai, nhưng bỏ phần cần ngữ cảnh |

Ngoài ra, mỗi câu trả lời chấm thêm hai mục độc lập với nhãn trên:
| Mục | Giá trị | Ý nghĩa |
|---|---|---|
| **Hiểu đúng câu hỏi mới nhất** | Có / Không | Câu trả lời giải quyết đúng câu hỏi ở lượt 13 (không bị lệch hay mất do cắt lịch sử) |
| **Hữu ích** | 1 đến 5 | Mức hữu ích tổng thể |

## 5. Cách đọc kết quả (chưa đặt ngưỡng đạt/không đạt)
Chủ sản phẩm đặt ngưỡng sau khi thấy số liệu; không tự đặt ngưỡng khi chưa có dữ liệu. Các so sánh đáng xem:
- Nhóm early: tỉ lệ **Thừa nhận thiếu** so với **Bịa lại dữ kiện** so với **Trả lời chung**.
- Nhóm early và nhóm control: chênh lệch **Hiểu đúng câu hỏi mới nhất** và **Hữu ích**. Nếu câu hỏi mới nhất bị hiểu sai ở nhóm early nhưng không ở control, thì cắt lịch sử đang làm hỏng đúng điều không được hỏng.
- Nếu nhóm early thường **Bịa lại dữ kiện** dù đã có ghi chú, đó là bằng chứng để cân nhắc cách giữ ngữ cảnh khác (ví dụ ghim vài sự kiện người dùng tự nêu). Tóm tắt tự động (D) và prompt caching (E) chưa được duyệt và không là câu trả lời mặc định.

## 5b. Điều đã làm để giảm rủi ro "bịa lại" (và cần được đo, không coi là đã giải quyết)
- Khi có tin cũ bị bỏ, khối bối cảnh gửi cho mô hình có thêm một ghi chú: tin sớm nhất không có mặt; nếu người dùng nhắc điều mô hình không thấy thì nói là không thấy và hỏi lại, không đoán, không bịa. Khi không bỏ gì, **không có ghi chú** (yêu cầu giống hệt như trước). Ghi chú này **chưa được đo**: nó có thể giúp, không có tác dụng, hoặc làm mô hình hỏi lại quá nhiều. Nhóm control dùng để thấy tác dụng phụ (hỏi lại thừa khi sự kiện vẫn còn).
- **Nhà cung cấp Gemini ghép toàn bộ tin nhắn thành một khối chữ, bỏ vai trò** (`supabase/functions/ai/providers.js`), nên mô hình không phân biệt ai nói gì; các nhà cung cấp khác nhận mảng tin nhắn. Kết quả đánh giá có thể khác theo nhà cung cấp đang chạy (**[UNKNOWN]** hiện là cái nào, do secret `AI_PROVIDER`). Khi chấm, ghi nhà cung cấp và model của bản đang chạy.

## 6. Ghi nhận
- Mười sự kiện và cách diễn đạt do tôi viết, chưa được người thứ hai xem; không đại diện cho mọi loại câu hỏi.
- 20 hội thoại là mẫu nhỏ, chỉ đủ phát hiện vấn đề rõ ràng, không đủ ước lượng tỉ lệ.
- Câu trả lời của mô hình có tính ngẫu nhiên; mỗi hội thoại chạy một lần cho kết quả một lần.
- **200.000 ký tự là hợp đồng tiếp nhận của server, không phải ngân sách chi phí.** Cửa sổ này giải quyết lỗi vượt giới hạn; nó **không chứng minh chi phí đã được tối ưu** và chi phí thật chưa được đo. Ở 17 tin gửi tối đa, đầu vào thực tế là khoảng 1 đến 4 nghìn token trên hội thoại tổng hợp (xấp xỉ, xem `AI-COACH-AUDIT-2026-10-12.md`). Không đặt giới hạn ký tự thấp hơn cho đến khi biết model thật, cách token hóa và mức ngữ cảnh cần cho chất lượng.
