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
3. Ghi lại câu trả lời ở **lượt 13** (và để ý nếu có lượt nào báo lỗi: mong đợi là không).
4. Để giảm thiên lệch, người chấm **không biết** hội thoại nào là "early" hay "control" (xáo thứ tự khi chấm).

## 4. Thang chấm cho câu trả lời lượt 13
Mỗi câu trả lời chấm bốn mục:
| Mục | Giá trị | Ý nghĩa |
|---|---|---|
| Dùng đúng sự kiện | Có / Không | Câu trả lời dùng sự kiện người dùng đã nói (xem `expectedFact`) |
| Bịa giá trị khác | Có / Không | Nói một giá trị trái với sự kiện hoặc tự đặt một giá trị |
| Hỏi lại người dùng | Có / Không | Coach hỏi lại điều người dùng đã nói (chấp nhận được khi sự kiện không còn được gửi) |
| Hữu ích | 1 đến 5 | Mức hữu ích tổng thể |

## 5. Tiêu chí đọc kết quả (chưa đặt ngưỡng đạt/không đạt)
Chủ sản phẩm đặt ngưỡng sau khi thấy số liệu; em không tự đặt ngưỡng khi chưa có dữ liệu. Các so sánh đáng xem:
- Tỉ lệ "Bịa giá trị khác" ở nhóm early so với nhóm control. Đây là rủi ro đáng lo nhất: coach tự tin nói sai một sự kiện đã bị cắt.
- Tỉ lệ "Hỏi lại" ở nhóm early (hành vi tốt) so với "Bịa".
- Chênh lệch điểm "Hữu ích" giữa early và control.
- Nếu nhóm early cho thấy coach hay bịa, đó là bằng chứng để cân nhắc các cách giữ ngữ cảnh (ví dụ ghim vài sự kiện người dùng tự nêu), không phải để tự động tóm tắt (D chưa được duyệt).

## 6. Ghi nhận
- Mười sự kiện và cách diễn đạt do tôi viết, chưa được người thứ hai xem; không đại diện cho mọi loại câu hỏi.
- 20 hội thoại là mẫu nhỏ, chỉ đủ phát hiện vấn đề rõ ràng, không đủ ước lượng tỉ lệ.
- Câu trả lời của mô hình có tính ngẫu nhiên; mỗi hội thoại chạy một lần cho kết quả một lần.
