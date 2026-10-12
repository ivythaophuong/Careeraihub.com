# Đề xuất: sửa nhãn và nội dung tab Overview của Interview Coach

Trạng thái: **ĐỀ XUẤT. Chủ sản phẩm chọn O4 (2026-10-12): thay đổi toàn diện phần trình bày Overview theo hướng trung thực về dữ liệu, chỉ trong phạm vi Overview; không đổi công thức điểm STAR, trust score, điều kiện Roadmap hay cấu trúc Live Session.** Việc triển khai làm ở PR riêng. Viết 2026-10-12 cho chủ sản phẩm (Ivy). Phạm vi nhỏ: chỉ tab Overview (`InterviewDashboard` trong `src/features/InterviewCoach/InterviewCoach.jsx`). Không viết lại Study Modules hay Live Session trong đợt này.
Nhãn: **[CODE]** đọc trong mã · **[PROPOSAL]** · **[UNKNOWN]**.

## 1. Hiện trạng [CODE]
Tab Overview tính bốn "điểm" chỉ từ **số lần hoạt động**, rồi gắn nhãn như kỹ năng:

| Nhãn hiện tại | Cách tính thật | Vấn đề |
|---|---|---|
| Concrete examples | `min(100, số phiên × 20)` | Không đo việc dùng ví dụ cụ thể; chỉ đếm phiên |
| STAR structure | `min(100, số câu chuyện STAR × 12)` | Không đo cấu trúc STAR; chỉ đếm câu chuyện đã lưu |
| Clarity | `min(100, số phiên × 25 + 15 nếu có kết quả quét CV)` | Không đo độ rõ ràng; và `scanHistory` **không còn nơi ghi** nên phần +15 không đúng |
| Overall readiness | trung bình ba số trên | Một "mức sẵn sàng" suy ra từ số lần bấm |

Cùng màn hình có các tag và con số không có cơ sở: "Priority 1", "Weakest", "Strong", "Done", "In progress", thanh phần trăm, câu "{nhãn yếu nhất} has h…" (chọn "yếu nhất" theo số đếm). Danh sách kế hoạch (plan) còn có:
- "Salary negotiation roleplay … **Unlocks at readiness 75** / Locked": module Salary mở cho mọi người (`App.jsx` không có cổng).
- Meta cố định: "3 sessions", "2 sessions · unlocks after Concrete examples clears 40", "1 maintenance session/week", "hold score above 70": không có dữ liệu hay nghiên cứu nào hỗ trợ các con số này.
Chính mã ghi chú rằng đây là số hoạt động, không phải đánh giá chất lượng, nhưng nhãn lại đọc như đánh giá. Điều này cũng trái ADR-013 (Q-E): dashboard hiện số hoạt động, không hiện thứ trông như điểm.

## 2. Đề xuất [PROPOSAL]
Nguyên tắc: **số lần hoạt động được gọi đúng tên; không điểm thay thế; không tuyên bố mở khóa hay hạn mức không có cơ sở.**

| Phần | Hiện tại | Đề xuất |
|---|---|---|
| Bốn thẻ chỉ số | "Concrete examples / STAR structure / Clarity / Overall readiness" với số 0–100 và tag | Thẻ **đếm**: "Mock interviews completed: N", "STAR stories saved: N", "Interview average (latest session, AI estimate of your first attempts): X%" nếu có, "Practice sessions this …" (không dùng). **Bỏ** "Clarity" và "Overall readiness". Không thanh phần trăm, không tag "Priority 1 / Strong / Weakest / Done" |
| Câu đầu tab | "You have completed N … {weakest.label} has …" | "You have completed N mock interviews and saved N STAR stories." (hai con số đếm, không "yếu nhất") |
| Danh sách plan | Bốn mục có tag, thanh, meta cố định, khóa | Thay bằng khối **"What to do next"** dùng đúng `nextActions()` của Career Roadmap (đã có test, dựa trên trạng thái thật, không hứa thời gian) |
| "Salary negotiation roleplay … Unlocks at 75" | Khóa giả | Bỏ. Nếu cần lối tắt, một nút "Open Salary Prep" không điều kiện |
| Nguồn `scanHistory` | Cộng 15 điểm "Clarity" | Bỏ (đã không còn nguồn) |
| Chú thích | (không có) | Một dòng: "These are counts of what you have done in CareerAiHub. They are not a measure of how well you answer." |
| Điểm phỏng vấn gần nhất | Hiện không có nhãn rõ | Nếu hiện: ghi "AI estimate, first attempt of each question, not a verified assessment" (khớp D8) |

Không thay đổi: các tab, thứ tự tab, nội dung `HiringManagerSim`, `WeaknessRadar`, `STARBuilder`, `MemoryDashboard`.

## 3. Ghi nhận ngoài phạm vi
- Hai tab **"Study Modules" và "Live Session" render cùng một component** (`HiringManagerSim`). Chưa sửa; sẽ khảo sát ở bước audit Study Modules.
- Weakness Radar, Readiness Score, Dashboard và Memory Dashboard còn đọc `scanHistory`: kiểm kê riêng, không sửa ở đây.

## 4. Rủi ro
- Người dùng đã quen thấy "điểm" sẽ thấy các con số biến mất. Cần câu giải thích (ở trên) để họ hiểu đó là đếm, không phải bị mất điểm.
- "Interview average" vẫn là ước lượng của AI; chỉ hiển thị khi có phiên và phải có nhãn.
- Khối "What to do next" lặp với Roadmap; chấp nhận vì dùng chung hàm, không lặp logic.

## 5. Tiêu chí nghiệm thu
- Không nhãn nào ngụ ý đánh giá kỹ năng từ số lần hoạt động; không thanh phần trăm hay tag xếp loại trên số đếm.
- Không câu "unlock", "locked", "hold score above" hay số phiên bắt buộc không có cơ sở.
- Mỗi con số hiển thị truy được về một nguồn đang được ghi (`mockSessions`, `starBank`) và có tên đúng.
- Test: không có chữ "Overall readiness", "Concrete examples", "Clarity", "Unlocks at", "Locked" ở tab Overview ở bất kỳ trạng thái nào; các số đếm đúng với `memory`.

## 6. Quyết định cần chủ sản phẩm
| # | Câu hỏi | Đề xuất |
|---|---|---|
| O1 | Duyệt thay bốn thẻ điểm bằng thẻ đếm như bảng trên? | Có |
| O2 | Thay danh sách plan bằng "What to do next" của Roadmap? | Có |
| O3 | Có hiện "Interview average" (ước lượng AI) hay chỉ hiện số phiên? | Chỉ hiện số phiên cho tới khi có quyết định về cách hiển thị điểm AI |
| O4 | Câu chú thích và câu chữ khác (tiếng Anh, để người dùng thấy) | Duyệt từng câu trước khi code |
