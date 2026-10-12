# Kết quả P5: điểm STAR dao động bao nhiêu giữa các lần review

Trạng thái: **kết quả đo đầu tiên, trên một model, bằng dữ liệu tổng hợp.** Không đổi công thức, trọng số, ngưỡng hay trust score. Viết 2026-10-12 cho chủ sản phẩm (Ivy). Giao thức: `STAR-VARIANCE-PROTOCOL.md`. Quyết định D-S3: đo độ biến thiên trước khi bàn về hiệu chỉnh.
Nhãn: **[MEASURED]** đo trong lần chạy này · **[INFERENCE]** suy ra từ số đo, không phải số đo · **[UNKNOWN]**.

## 1. Điều gì đã được đo
- **Groq, model `openai/gpt-oss-120b`** [MEASURED]: 10 câu chuyện tổng hợp × 5 lần = **50 lượt, cả 50 thành công, 0 lỗi**. Chạy qua chính hàm `review` của `score-star` (cùng prompt, cùng cách tính điểm tổng 0.15 / 0.15 / 0.40 / 0.30). Không dùng nhà cung cấp dự phòng. 5 lượt cần thử lại (tổng 8 lần) vì giới hạn tần suất; lượt cuối thành công được tính là một quan sát. Tệp thô: `~/star-variance/groq-20261012-1326.json` (ngoài kho git).
- **Gemini `gemini-3.8-flash`** [MEASURED, không đủ]: chỉ **18/50** lượt thành công (hạn mức miễn phí cạn: 25 lỗi 429 và 7 lỗi 502 ở lần đầu; lần chạy tiếp bị 429 ngay và bị ngắt). Bốn câu chuyện chỉ có 1 lượt, sáu câu có 2 đến 3 lượt. **Không đủ để nói gì về độ ổn định của model này.** Nguồn bên thứ ba cho biết gói miễn phí của model này khoảng 20 yêu cầu mỗi ngày (chưa xác minh).

## 2. Kết quả Groq: điểm tổng của từng câu chuyện [MEASURED]
| Câu chuyện (kiểu viết) | n | Trung bình | Độ lệch chuẩn | Nhỏ nhất | Lớn nhất | Khoảng |
|---|---|---|---|---|---|---|
| s01 tối thiểu | 5 | 30,6 | 0,9 | 30 | 32 | 2 |
| s02 mơ hồ | 5 | 41,2 | 1,8 | 39 | 43 | 4 |
| s03 nhiều "chúng tôi" | 5 | 60,8 | 2,5 | 57 | 63 | 6 |
| s04 không có kết quả | 5 | 66,6 | 5,8 | 60 | 73 | **13** |
| s05 cụ thể, không số | 5 | 69,6 | 0,9 | 69 | 71 | 2 |
| s06 có số liệu | 5 | 83,2 | 0,8 | 82 | 84 | 2 |
| s07 mạnh, chi tiết | 5 | 77,4 | 2,3 | 75 | 81 | 6 |
| s08 xung đột | 5 | 73,6 | 3,3 | 69 | 78 | 9 |
| s09 trường ngắn | 5 | 60,0 | 5,7 | 56 | 70 | **14** |
| s10 dài, độn chữ | 5 | 34,6 | 4,2 | 29 | 39 | 10 |

## 3. Tổng quan [MEASURED]
- **Biến thiên của cùng một câu chuyện** (độ lệch chuẩn gộp): **3,3 điểm** cho điểm tổng. **Khác biệt giữa các câu chuyện**: 18,3 điểm. Phần biến thiên là do chạy lại chiếm khoảng **3%** tổng độ phân tán (mô tả, không phải hệ số tin cậy).
- **Thứ tự các câu chuyện** gần như không đổi giữa các lần chạy: tương quan hạng trung bình **0,98**, thấp nhất 0,98.
- **Điểm từng phần dao động nhiều hơn điểm tổng:**
  | Phần | Độ lệch chuẩn trong cùng câu | Ổn định thứ tự (Spearman) |
  |---|---|---|
  | Situation | 5,1 | 0,94 |
  | Task | 4,3 | 0,96 |
  | Action | 4,3 | 0,95 |
  | Result | 3,4 | 0,99 |
  Khoảng lớn nhất của một phần trong cùng câu: **25 điểm** (s09, Situation 55 đến 80), 20 điểm (s04, Situation 60 đến 80), 17 điểm (s08, Action 68 đến 85).
- **Chi phí và thời gian** (mỗi lượt): khoảng 670 token vào, 480 token ra, 80 token suy nghĩ; 1,4 đến 3 giây. (Gemini ở lần chạy đầu: 477 đến 1.335 token suy nghĩ, 9 đến 23 giây.)

## 4. Đối chiếu sơ bộ với Gemini [INFERENCE; mẫu rất nhỏ]
Trên 6 câu chuyện mà Gemini có 2 đến 3 lượt, trung bình của Gemini **thấp hơn Groq khoảng 4 đến 16 điểm** (ví dụ s01: 17 và 31; s10: 20 và 35; s06: 79 và 83). Hai model đặt các câu chuyện yếu ở các mức khác nhau. Điều này cần được xác nhận với đủ lượt, nhưng gợi ý rằng **cùng một câu chuyện có thể nhận mức điểm khác nhau tùy model**.

**Hai bên không đo cùng điều kiện** [MEASURED, bổ sung sau]: mã production đặt temperature 0,1 cho Gemini và không gửi giá trị nào cho Groq, nên lần đo Groq này dùng mặc định của nhà cung cấp. Ở Groq, đổi sang 0,1 làm trung bình một số câu dịch khoảng 5 điểm (xem `STAR-VARIANCE-TEMPERATURE-2026-10-12.md`). Vì vậy một phần chênh lệch ở trên có thể do temperature chứ không do model, và em không tách được phần nào do cái nào. Phép so sánh này chỉ là gợi ý để đo lại, không phải kết luận.

## 5. Điều có thể nói và điều không thể nói
**Có thể nói** (cho model này, bộ này) [MEASURED]:
- Thứ tự câu chuyện yếu đến mạnh khá ổn định.
- Cùng một câu chuyện, điểm tổng thường lệch vài điểm (độ lệch chuẩn khoảng 3), nhưng với một số câu **khoảng 10 đến 14 điểm** trong năm lần.
- Điểm từng phần lệch nhiều hơn điểm tổng, tới 25 điểm ở một phần.

**Không thể nói:**
- Rằng điểm **chính xác** hay phản ánh năng lực thật. Đo độ ổn định không đo độ chính xác.
- Rằng kết quả đúng cho model đang chạy ở production [UNKNOWN: chưa biết model production] hay cho model khác (Gemini chưa đủ dữ liệu).
- Rằng 10 câu chuyện do một người viết, 5 lần mỗi câu, đại diện cho mọi câu chuyện hay cho độ biến thiên thật; đủ để thấy vấn đề, không đủ để ước lượng chính xác.
- Bất kỳ ngưỡng nào là "ổn định": chưa đặt.

## 6. Hàm ý cho các quyết định đang mở [INFERENCE; không ràng buộc]
- **D-S1 (một câu chuyện, một kết quả được tính):** nếu cứ review lại rồi lưu lần cao nhất, cùng một văn bản có thể tăng điểm vài điểm chỉ nhờ may rủi. Trong dữ liệu này, lần cao nhất trong năm lần cao hơn trung bình **10 điểm** (s09), 6 điểm (s04), 4 điểm (s10 và s08). Điều đó ủng hộ nguyên tắc chỉ tính một kết quả cho mỗi câu chuyện.
- **P2 (nhãn "ước lượng AI", bỏ màu và ngưỡng):** số đo ủng hộ. Một ngưỡng như 75 hay 50 nằm trong khoảng dao động của chính số điểm.
- **Hiển thị điểm cho người dùng và nhà tuyển dụng:** khác biệt vài điểm giữa hai người hay hai lần chạy không đáng tin là khác biệt về năng lực.
Đây là các suy luận để chủ sản phẩm cân nhắc. Không quyết định nào được thay đổi bởi tài liệu này.

## 7. Việc tiếp theo có thể làm
- Hoàn thiện số liệu Gemini khi hạn mức cho phép, hoặc đo model đang dùng ở production khi biết nó là gì.
- Đo thêm một nhà cung cấp khác bằng cùng công cụ, để xem dao động và chênh lệch giữa model có phải đặc điểm chung.
- Chưa đo: độ chính xác và độ công bằng (cần người chấm độc lập và bộ dữ liệu phủ).
