# P5, phần 2: temperature 0,1 so với mặc định (Groq)

Trạng thái: **một phép so sánh, một model, dữ liệu tổng hợp.** Không đổi code production, công thức, trọng số, ngưỡng hay trust score. Viết 2026-10-12. Phần 1: `STAR-VARIANCE-RESULTS-2026-10-12.md`. Công cụ: `scripts/audit/starVariance.mjs` với `--temperature`.
Nhãn: **[MEASURED]** đo trong lần chạy này · **[INFERENCE]** suy ra, không phải số đo · **[UNKNOWN]**.

## 1. Điều gì đã được so sánh
- Model `openai/gpt-oss-120b` trên Groq, 10 câu chuyện tổng hợp × 5 lần, cả hai lần **50/50 thành công, không lỗi** [MEASURED].
- Lần A: temperature mặc định của nhà cung cấp (mã production không gửi giá trị nào cho Groq). Lần B: **0,1**, do công cụ gửi thay cho cấu hình của mã.
- Hai lần dùng **cùng một hash của mã chấm điểm** (`f7b6ad5a…`) và cùng prompt. Chỉ temperature khác. `codeVersion` khác nhau vì lần B chạy từ nhánh có thêm tùy chọn `--temperature`, không chạm mã chấm điểm [MEASURED].
- Mã production đặt temperature **0,1 cho Gemini** và không gửi gì cho các nhà cung cấp còn lại. Kết quả Groq mặc định và kết quả Gemini trước đây vì vậy không so được với nhau về temperature.

## 2. Kết quả [MEASURED]
| | Mặc định | 0,1 |
|---|---|---|
| Độ lệch trong cùng câu chuyện (điểm tổng) | 3,33 | **2,07** |
| Độ lệch giữa các câu chuyện | 18,33 | 18,20 |
| Khoảng lớn nhất trong một câu chuyện | 14 (s09) | **10** (s09) |
| Số câu có khoảng từ 9 điểm trở lên | 4 | **1** |
| Tương quan hạng giữa các lần (trung bình) | 0,98 | **0,99** |
| Độ lệch từng phần: Situation / Task / Action / Result | 5,1 / 4,3 / 4,3 / 3,4 | **3,0 / 2,3 / 2,8 / 2,4** |

Theo từng câu chuyện (trung bình, độ lệch, khoảng):
| Câu | Mặc định | 0,1 |
|---|---|---|
| s01 | 30,6 / 0,9 / 2 | 30,0 / 0,0 / 0 |
| s02 | 41,2 / 1,8 / 4 | 36,0 / 2,7 / 5 |
| s03 | 60,8 / 2,5 / 6 | 61,6 / 0,9 / 2 |
| s04 | 66,6 / 5,8 / 13 | 65,8 / 1,1 / 2 |
| s05 | 69,6 / 0,9 / 2 | 69,6 / 1,3 / 3 |
| s06 | 83,2 / 0,8 / 2 | 83,0 / 0,0 / 0 |
| s07 | 77,4 / 2,3 / 6 | 77,2 / 3,1 / 7 |
| s08 | 73,6 / 3,3 / 9 | 72,4 / 1,3 / 3 |
| s09 | 60,0 / 5,7 / 14 | 60,0 / 4,5 / 10 |
| s10 | 34,6 / 4,2 / 10 | 40,0 / 0,0 / 0 |

## 3. Điều có thể và không thể nói
**Có thể nói** (cho model này, bộ này) [MEASURED]:
- Ở 0,1 độ lệch điểm tổng trong cùng câu chuyện nhỏ hơn khoảng 38%, và độ lệch từng phần nhỏ hơn.
- Không phải câu nào cũng ổn định hơn: s07 (2,3 lên 3,1) và s02 (1,8 lên 2,7) lệch nhiều hơn, và s09 vẫn có khoảng 10 điểm.
- Temperature còn **dịch mức điểm trung bình** của một số câu: s10 tăng 5,4 điểm, s02 giảm 5,2 điểm.

**Không thể nói:**
- Rằng giảm độ lệch là chắc chắn. Mỗi cấu hình chỉ có 5 lần cho mỗi câu, một độ lệch ước lượng từ 5 điểm rất nhiễu, và hai câu đi ngược hướng.
- Rằng Groq áp temperature 0,1 đúng như với model thường. `gpt-oss` là model suy luận [UNKNOWN: chưa xác minh cách Groq xử lý giá trị này]. Yêu cầu có kèm temperature và được nhận, nhưng điều đó chưa chứng minh nó có tác dụng.
- Rằng cấu hình nào cho điểm **đúng hơn**. Phép đo chỉ nói về độ ổn định. Mức điểm trung bình đổi theo temperature, mà không có chuẩn do người chấm để biết cấu hình nào gần đúng hơn.
- Rằng kết quả đúng cho model production [UNKNOWN: chưa biết model production] hoặc cho nhà cung cấp khác.
- Chưa đo temperature 0.

## 4. Hàm ý [INFERENCE; không ràng buộc]
- Hạ temperature có thể giảm dao động vừa phải nhưng không xóa nó. Một khoảng 10 điểm vẫn xảy ra.
- Hiện một lần gọi `review` trả cả điểm lẫn phần viết lại, nên một temperature áp lên cả hai. Chủ sản phẩm muốn giữ sự sáng tạo của phần viết, nên **không** hạ temperature của production. Nếu sau này cần ổn định điểm, các hướng không ảnh hưởng phần viết là: một kết quả được tính cho mỗi câu chuyện (D-S1), hiển thị khoảng điểm, hoặc tách lần chấm điểm khỏi lần viết (tốn thêm một lần gọi). Chưa có hướng nào được chọn hay triển khai.
- Không quyết định nào thay đổi bởi tài liệu này.
