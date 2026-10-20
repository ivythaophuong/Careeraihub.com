# P0: thiết kế bản sửa cho các tuyên bố sai và dữ liệu chết (chỉ thiết kế)

Trạng thái: **THIẾT KẾ, CHƯA TRIỂN KHAI. Không sửa code, SQL, cấu hình hay dữ liệu. Chưa commit. Chưa mở PR.**
Viết 2026-10-11 cho chủ sản phẩm (Ivy). Cơ sở: `origin/main` = `main` @ `2f11e29` (đã xác minh trùng nhau lúc viết). Nguồn lỗi: `docs/audits/MANUAL-TEST-FINDINGS-2026-10-11.md`. Quyết định liên quan: ADR-013 (Q-A đến Q-E, chỉ là nguyên tắc, chưa triển khai).
Nhãn: **VERIFIED** (đọc mã hoặc chạy thử cục bộ) · **PROPOSAL** · **UNKNOWN**.

## 0. Nguyên tắc cho bản sửa

1. **Sửa nhỏ nhất** làm cho giao diện nói đúng sự thật. **Không tạo nguồn dữ liệu mới** chỉ để giữ giao diện cũ (nhận xét của chủ sản phẩm).
2. Chỉ báo không có nguồn hợp lệ: **ẩn hoặc thay bằng trạng thái "chưa có dữ liệu"** có chỉ dẫn, không để số 0 hay lời hứa giả.
3. Dữ liệu cũ vẫn đọc được nhưng gắn **"Earlier AI estimate"** và không dùng làm tiêu chí hoàn thành (ADR-013, Q-D).
4. Việc thay điểm AI bằng số đếm hoạt động (Q-E) là **PR riêng sau**, không gộp vào đây.

## 1. Bảng lỗi P0: nguồn, nơi ghi, nơi đọc, giao diện, bản sửa nhỏ nhất

| Lỗi | Nơi ghi | Nơi đọc / giao diện | Bản sửa nhỏ nhất đề xuất | Loại | Cần quyết định? |
|---|---|---|---|---|---|
| **B1** Mức lương cố định, ghi là "Current market value" | **Không có nơi ghi**: hai chuỗi hằng số trong mã (`CareerRoadmap.jsx:98-99`) | Thẻ "Salary trajectory" (`CareerRoadmap.jsx:176-195`) | **Gỡ thẻ** "Salary trajectory", thay bằng một dòng chỉ dẫn tới **Salary Prep** ("Tính khoảng thương lượng từ chính số offer của bạn") | Ẩn | Không (không có dữ liệu để giữ) |
| **B2** Bước 1 và các mốc ATS đọc `scanHistory` | **Không ai ghi `scanHistory`** (đã grep toàn `src`) | `CareerRoadmap.jsx:77,82,124,141,201-202`; Dashboard ô ATS; AI Coach và AI Memory | (a) Bước 1 chỉ còn điều kiện "đã thêm CV" (`hasResume`), bỏ ngưỡng ATS ≥75; (b) **bỏ hai mốc** "Resume ATS score > 75 / > 87"; (c) nếu có dữ liệu cũ trong `scanHistory`, hiển thị như thông tin "Earlier AI estimate", **không** tính vào hoàn thành | Sửa logic + ẩn | **Có (D-1)**: bước 1 thay vào đó nghĩa là hành động chuẩn bị nào? (đề xuất: "Thêm CV") |
| **B3** Weakness Radar ô Resume luôn "Not enough evidence" | Không ai ghi `scanHistory`/`scanResult` (`setScanResult` chỉ định nghĩa, không có chỗ gọi) | `WeaknessRadar.jsx:20,94-96` | Thay ô bằng trạng thái không đòi hỏi dữ liệu không tồn tại: "Các kiểm tra CV nằm trong ATS Builder" + nút tới đó. **Không** tạo `scanHistory` mới | Thay trạng thái | **Có (D-2)** nếu muốn ô này có dữ liệu thật (xem mục 2) |
| **B4** Radar ghi "practice questions (you have 1)" nhưng đếm phiên | Số phiên = `memory.mockSessions` (từ `mock_sessions`) | `WeaknessRadar.jsx:26,103`; cũng `basis` ở dòng 100 và 108 | Đổi **đơn vị lời** cho đúng với phép đếm: "Complete at least 2 practice **sessions** (you have N)"; "Average of your last N practice **sessions**"; "stories" cho STAR. Không đổi ngưỡng `MIN_EVIDENCE` | Sửa lời | Không |

### Các chỉ báo liên quan phát hiện khi truy vết (cùng nguồn chết hoặc nói quá)

| Chỉ báo | Vấn đề | Đề xuất P0 |
|---|---|---|
| Dashboard ô "ATS Score" (`Dashboard.jsx:226,281`) | Luôn "—" và "No scans yet" với người dùng mới vì nguồn chết | Thay bằng ô "ATS Readiness" **không có số**, nút "Check in ATS Builder"; dữ liệu cũ (nếu có) gắn "Earlier AI estimate" |
| Dashboard ô "Practice Score" và vòng "Interview Readiness" | Dựa trên điểm AI; thiếu = "—" (đã đúng với "chưa có") | **Để PR Q-E** (thay bằng số đếm). P0 không đổi |
| Roadmap bước 2 ("readiness 75+"), 4 ("practice score 65"), mốc "Interview readiness > 75", "Practice score 65+" | Dựa trên điểm AI | **Để PR Q-E**; chưa thay bằng ngưỡng số đếm tùy ý (điều kiện của chủ sản phẩm). P0 không đổi |
| Trang "Resume Readiness Score" (`ReadinessScore.jsx`) | Luôn trống với người dùng mới; nút dẫn tới "Scan my resume" nhưng không có thao tác quét nào ghi điểm | **Quyết định D-3**: đổi thành trang chuyển hướng tới ATS Builder, hoặc ẩn khỏi menu cho tới khi có nguồn |

## 2. Quyết định cần chủ sản phẩm

| # | Câu hỏi | Lựa chọn | Đề xuất |
|---|---|---|---|
| **D-1** | Bước 1 của Roadmap đại diện cho hành động chuẩn bị nào? | "Thêm CV" / "Chạy kiểm tra CV trong ATS Builder" (cần lưu kết quả) | "Thêm CV" cho P0 (không cần nguồn mới); xem lại ở PR Q-E |
| **D-2** | Có muốn **lưu** kết quả ATS Builder gần nhất (điểm các phần và danh sách vấn đề) vào memory để Radar, Roadmap, Dashboard đọc? | Có / Không | **Không trong P0.** Nó tạo nguồn dữ liệu mới và cần đánh giá quyền riêng tư (danh sách vấn đề trích dẫn CV); cân nhắc ở bước sau, kèm hợp đồng trạng thái Q-C |
| **D-3** | Trang "Resume Readiness Score": chuyển hướng hay ẩn? | chuyển hướng tới ATS Builder / ẩn khỏi menu | Chuyển hướng (ít mất mát) |

## 3. Kế hoạch kiểm thử (viết trước, chạy "trước và sau")

| Lỗi | Test trước (chứng minh lỗi) | Test sau (chứng minh đã sửa) |
|---|---|---|
| B1 | Render `CareerRoadmap`: tìm thấy `SGD 6–9K` hoặc `$60–90K` | Không có chuỗi tiền tệ cố định nào, và không có nhãn "market value"; có liên kết tới Salary Prep |
| B2 | Với `memory` không có `scanHistory`: bước 1 không bao giờ "done" dù có `resumeText` | Có `resumeText` thì bước 1 done; không còn mốc ATS; với `scanHistory` cũ: hiển thị "Earlier AI estimate", không ảnh hưởng hoàn thành |
| B3 | Với `scanHistory` rỗng: ô Resume hiện "Scan your resume" | Ô hiện chỉ dẫn ATS Builder, không nói "not enough evidence" |
| B4 | `mockSessions` có 1 phiên: chuỗi "practice questions (you have 1)" | Chuỗi dùng "sessions" và đúng số phiên; test cập nhật `WeaknessRadar.test.jsx` |
| Dashboard ATS | Người dùng mới thấy "No scans yet" | Thấy ô ATS Readiness với liên kết, không số |
| Hồi quy | `npm test`, `tests/security/noFakeData.test.js` (không có số liệu bịa) | cùng, vẫn qua; thêm test mới cho `CareerRoadmap` và Dashboard (hiện **chưa có test nào** cho hai màn này) |

## 4. Rủi ro hồi quy

- **Người dùng có dữ liệu cũ** (5 dòng `resume_scans` và `memory.scanHistory` đã lưu): không được xóa hay làm mất; chỉ đổi cách hiển thị và không dùng làm tiêu chí hoàn thành.
- `CareerRoadmap` và Dashboard **không có test hiện hữu**, nên PR phải thêm test trước khi sửa (đúng thứ tự: test trước, sửa sau).
- `tests/security/noFakeData.test.js` quét mã tìm số liệu thị trường; sau khi gỡ thẻ lương test vẫn phải qua.
- Chuỗi giao diện bị đổi có thể xuất hiện trong test cũ (`WeaknessRadar.test.jsx`, `ReadinessScore.test.jsx`): cập nhật có chủ đích.

## 5. Đề xuất chia PR (mỗi PR nhỏ, test trước)

1. **PR A: B1** (gỡ thẻ lương Roadmap) + test.
2. **PR B: B4** (đơn vị lời ở Radar) + cập nhật test.
3. **PR C: B2, B3, Dashboard ATS, trang Readiness** (sau khi chốt D-1 và D-3) + test mới.
4. (P1, thiết kế riêng) B6: sửa **bộ đọc và chuẩn hóa văn bản CV** ở tầng đọc, không vá từng từ khóa; các biến thể đã tái hiện thành bộ test hồi quy; B7: bộ test so sánh văn bản dán với văn bản trích từ PDF; B5: truyền đúng vấn đề và bước sang Builder.

Chưa PR nào được viết. Chờ chủ sản phẩm duyệt thiết kế và trả lời D-1, D-3 (D-2 mặc định là Không).
