# Thiết kế: thị trường nghề nghiệp do người dùng xác định khi onboarding

Trạng thái: **DESIGN. Chưa triển khai, chưa SQL, chưa đổi giao diện.** Viết 2026-10-12 cho chủ sản phẩm (Ivy). Thuật ngữ kỹ thuật giữ tiếng Anh.
Nhãn: **[CODE]** đọc trong mã · **[OWNER]** quyết định của chủ sản phẩm · **[REVIEW]** đề xuất từ bài đánh giá thiết kế được chủ sản phẩm chuyển tới · **[PROPOSAL]** đề xuất của trợ lý, chưa duyệt · **[UNKNOWN]**.

## 1. Quyết định và nguyên tắc
- **[OWNER]** Thị trường được xác định khi onboarding, bởi người dùng.
- **[REVIEW, nên giữ]** *Product default là quyết định của hệ thống; market preference là dữ liệu về ý định của người dùng. Không được đánh đồng hai thứ.* Singapore là lựa chọn **được đề xuất**, không phải lựa chọn **đã xác nhận**.
- **[REVIEW]** Câu hỏi đổi thành **"Where do you want to grow your career?"** (thị trường nhắm tới, không phải nơi đang sống).
- **[REVIEW]** Hỗ trợ chọn nhiều thị trường có thứ tự ưu tiên; phân biệt `not_asked` (chưa hỏi), `skipped` (đã bỏ qua), `selected` (đã chọn); thị trường hiệu lực được tính **khi tạo yêu cầu**, không ghi đè dữ liệu gốc; mọi nơi đọc cùng một nguồn.

## 2. Hiện trạng [CODE]
**Onboarding đã hỏi thị trường, nhưng không phân biệt được chọn và mặc định.**
- `src/App.jsx`: onboarding có 3 bước; bước 2 có nhóm nút "Target Market" với `['Singapore', 'Southeast Asia', 'Global']`. `form.market` khởi tạo bằng `'Singapore'`, nên Singapore **được chọn sẵn**; người dùng bấm Next mà không chạm vào nhóm nút thì vẫn có `market = 'Singapore'`.
- Đồng bộ lên cơ sở dữ liệu: một `useEffect` upsert hàng `profiles` (`role, industry, level, market, urgency`) 1 giây sau thay đổi, miễn là có `role`. Vậy `profiles.market` **chứa 'Singapore' cho mọi người dùng không đổi nó**, không có cột nào ghi "do người dùng chọn". `loadProfile` đọc lại và gán vào `form`.
- Hệ quả: **mọi giá trị `market` đã lưu trước đây không thể được coi là lựa chọn của người dùng**, kể cả giá trị 'Singapore'. Một giá trị khác 'Singapore' thì chắc chắn do người dùng bấm (vì mặc định là Singapore).
- Chỉ có một chuỗi, không có danh sách có thứ tự; ba lựa chọn là khu vực, không phải thị trường theo quốc gia (không có Vietnam, Malaysia).

**Những nơi đọc thị trường** (cần chuyển sang một hàm đọc chung):
| Nơi | Cách đọc |
|---|---|
| `AICoach.jsx` (`buildSystemPrompt`) | đưa vào bối cảnh (đã bỏ `|| 'Singapore'` ở nhánh B) |
| `SkillsGap.jsx` | `form?.market || 'Singapore'` vào prompt và nhãn "Market data · …" |
| `SalaryCoach.jsx` | `form?.market || 'Singapore'` |
| `JDAnalyzer.jsx` / `jdAnalysis.js` | truyền `market` vào prompt phân tích JD |
| `JobSearch.jsx` | lấy làm địa điểm tìm việc mặc định (`useState(form.market || "")`) |
| `CareerRoadmap.jsx`, `Dashboard.jsx`, `MemoryDashboard.jsx` | hiển thị "in {market}" / "Targeting … · {market}" / mô tả cho AI |
| `salaryLevel.js` | khóa cache theo `market` |
Lưu ý trùng tên: trong `ATSBuilder.jsx`, `profile.market` là **thành phố/khu vực do AI trích từ CV**, một khái niệm khác, không liên quan.

**Lược đồ đã có (Phase 1, chưa dùng)** [CODE, `docs/database/phase1/`]: bảng `career_profiles` (một hàng mỗi người dùng, có `location`) và `career_targets` (nhiều mục tiêu mỗi người, có cột `market` dạng chuỗi, một mục `is_primary`). Theo ghi nhận của chủ sản phẩm chúng đã được áp dụng lên production (2026-10-05); mã ứng dụng **không** dùng chúng (`STATUS.md`). Lược đồ thật chưa so sánh từng dòng với script: **[UNKNOWN]**.

→ Hiện đã có ba nơi có thể chứa thị trường (`profiles.market`, `career_targets.market`, và bảng mới `user_market_preferences` mà bài đánh giá đề xuất). Đề xuất bên dưới nhằm **không tạo thêm một nguồn thứ tư trùng lặp**.

## 3. Mô hình dữ liệu [PROPOSAL, cần chủ sản phẩm chọn: D-M1]
Dữ liệu cần lưu (bất kể nơi lưu):
```
marketPreference = {
  status:    'not_asked' | 'skipped' | 'selected',
  markets:   ['SG', 'VN'],        // mã chuẩn, thứ tự = ưu tiên; rỗng nếu chưa chọn
  updatedAt: '2026-10-12T…Z'
}
```
Quy tắc: chỉ ghi `selected` khi người dùng **thực sự bấm chọn hoặc xác nhận**; `skipped` khi bấm "Skip for now"; `not_asked` là trạng thái khi chưa có bản ghi; **không bao giờ ghi mặc định như thể người dùng đã chọn**; không suy ra `skipped` từ việc thiếu dữ liệu.

| Phương án | Nơi lưu | Ưu | Nhược |
|---|---|---|---|
| **A (MVP, không SQL)** | `memory.marketPreference` trong `user_memory` (JSON theo người dùng, đã tải lúc đăng nhập, đã được ghi lại mỗi lần cập nhật) | Không SQL, không chính sách RLS mới, dùng cơ chế đã chạy; một nguồn cho Coach, onboarding và các tính năng | Không truy vấn phía server được (matching, thống kê); do client ghi nên không dùng để quyết định ở server |
| B | Bảng mới `user_market_preferences` (+ trạng thái onboarding) như bài đánh giá đề xuất | Truy vấn phía server, thứ tự ưu tiên có ràng buộc, rõ ràng | **Cần SQL được duyệt**, RLS và quyền, kế hoạch áp dụng; hiện chưa có tính năng phía server nào cần nó |
| C | Dùng lại `career_targets.market` | Đã tồn tại trên production | Sai ngữ nghĩa: là thị trường **của một mục tiêu vai trò**, không phải của người dùng; ứng dụng chưa dùng bảng này; một chuỗi, không danh sách |

**Đề xuất: A trước**, vì chưa có người dùng phía server nào của dữ liệu này, nó tránh SQL, và hình dạng dữ liệu ở trên **sao chép thẳng** sang phương án B khi matching cần truy vấn phía server. Khi chuyển, `user_memory` thôi là nguồn và được xóa trường: không để hai nơi cùng sống. Phương án C không khuyến nghị.
`profiles.market` giữ nguyên là **giá trị cũ không còn được coi là ý định của người dùng**; không đọc nó như lựa chọn, dừng ghi vào nó khi phương án A có hiệu lực (hoặc ghi nhưng không dùng; chọn khi triển khai).

## 4. Lựa chọn hiển thị trong onboarding [PROPOSAL, D-M2]
Câu hỏi: **"Where do you want to grow your career?"**, chọn nhiều, có thể sắp thứ tự, có **"Skip for now"**.
- **Singapore (Recommended)**: hiện đầu tiên, có nhãn, **không được chọn sẵn**.
- Vietnam, Malaysia, và các thị trường châu Á khác: danh sách ban đầu do chủ sản phẩm duyệt (đề xuất: Singapore, Vietnam, Malaysia, Indonesia, Thailand, Philippines, Hong Kong, "Other Asia-Pacific", "Remote / global").
- Mã chuẩn ISO 3166-1 alpha-2 cho quốc gia (SG, VN, MY…) và hai mã đặc biệt cho "Other Asia-Pacific" và "Remote / global". Tên hiển thị tách khỏi mã.
- Giá trị cũ `Southeast Asia` và `Global` không phải thị trường theo quốc gia: ánh xạ gợi ý `Global` thành "Remote / global"; `Southeast Asia` **không** tự động ánh xạ (hỏi lại).
- Nút Next ở bước này chỉ bật khi đã chọn ít nhất một thị trường **hoặc** bấm Skip; không suy ra `skipped` từ việc bấm Next.
- Chỗ sửa sau: phần hồ sơ hoặc cài đặt (cần xác định chỗ có sẵn trong ứng dụng; **[UNKNOWN]**, chưa khảo sát).

## 5. Quy tắc thị trường hiệu lực khi tạo yêu cầu [PROPOSAL, D-M3]
Hàm chung `effectiveMarket(memory)` trả `{ markets, source }` với `source` ∈ `user_selected | none`. Không bao giờ trả "mặc định" như một lựa chọn.
| Trạng thái | Coach nhận | Tính năng cần thị trường (Skills Gap, Salary, JD, Job Search) |
|---|---|---|
| `selected` | "Career market preferences: Singapore, Vietnam (user-selected, in priority order)" | dùng danh sách, ghi nguồn |
| `skipped` | "Career market: not specified by the user" | hiện "Choose your market" hoặc chạy không có thị trường và nói rõ |
| `not_asked` (gồm người dùng cũ) | không đưa dòng thị trường | nhắc chọn một lần, không chặn |
Khác với bài đánh giá: **em không khuyến nghị tự đưa "Singapore (product-recommended default)" vào ngữ cảnh khi chưa xác nhận**, vì Coach có thể xem đó là sự thật; nếu một tính năng thực sự cần một thị trường để chạy, nó nên **hỏi** hoặc ghi rõ "chưa chọn". Chủ sản phẩm quyết (D-M3). Câu hỏi nào không phụ thuộc thị trường thì không cần dòng này; em không đề xuất phân loại ý định từ văn bản tự do.

## 6. Người dùng hiện có [PROPOSAL]
Mọi người dùng cũ ở trạng thái `not_asked`. Giá trị `profiles.market` cũ **không** chuyển thành `selected` (không biết họ có chọn không). Hiển thị một lời nhắc nhẹ, không chặn, một lần ("Where do you want to grow your career?") ở nơi họ thấy sớm (ví dụ Dashboard); sau khi chọn hoặc bỏ qua thì không hỏi lại.

## 7. Giai đoạn chuyển tiếp (đã áp dụng ở nhánh B của Coach, không cần SQL)
Cho đến khi có `marketPreference`, nguồn gốc có thể suy ra từ chính dữ liệu: giá trị `form.market` **khác 'Singapore' chắc chắn do người dùng chọn** (mặc định là Singapore); giá trị **'Singapore' thì không biết**. Coach vì thế nói "Market: X (selected by the user)" cho giá trị khác, và "Market: Singapore (product default; the user may not have chosen it)" cho Singapore. Đây là cầu nối, bị thay khi có `marketPreference`.

## 8. Tiêu chí nghiệm thu (khi triển khai)
- Default không bao giờ bị ghi thành `selected`: người dùng bấm Next/đi qua onboarding mà không chọn thì trạng thái là chưa chọn, không phải 'SG'.
- `skipped` được giữ qua tải lại và đăng nhập lại; `loadProfile` không ghi đè nó.
- Thứ tự ưu tiên và nhiều lựa chọn được lưu và đọc đúng; đổi thứ tự không tạo hồ sơ mới.
- Coach nhận đúng nguồn: `user-selected`, hoặc không có dòng thị trường; không bao giờ một mặc định trình bày như lựa chọn.
- Người dùng cũ: giá trị `profiles.market` cũ không được coi là lựa chọn; lời nhắc xuất hiện một lần.
- Không còn `|| 'Singapore'` hay mặc định ngầm ở bất kỳ nơi đọc nào trong mục 2 (một test quét mã nguồn chặn điều này).
- Một nguồn: không có hai nơi cùng ghi thị trường của người dùng.

## 9. Rủi ro
- `user_memory` do client ghi: không dùng cho quyết định phía server. Chuyển sang bảng khi cần (D-M1).
- Tách mặc định khỏi lựa chọn đổi hành vi của 7 nơi đọc; từng nơi cần thông điệp "chưa chọn thị trường" rõ ràng, không im lặng chạy với một giá trị bịa.
- Danh sách thị trường là quyết định sản phẩm; nền tảng chỉ phục vụ người dùng tiếng Anh, nên "thị trường" ở đây là nơi tìm việc, không phải ngôn ngữ.

## 10. Quyết định cần chủ sản phẩm
| # | Câu hỏi | Đề xuất |
|---|---|---|
| D-M1 | Nơi lưu: A (`user_memory`, không SQL), B (bảng mới, cần SQL), hay C | A trước, chuyển B khi matching cần truy vấn phía server |
| D-M2 | Danh sách thị trường ban đầu và nhãn "Recommended" cho Singapore | Danh sách ở mục 4, Singapore (Recommended) không chọn sẵn |
| D-M3 | Khi chưa xác nhận: không đưa dòng thị trường vào Coach (đề xuất) hay đưa "Singapore (default, chưa xác nhận)" như bài đánh giá | Không đưa; tính năng cần thì hỏi |
| D-M4 | Người dùng cũ: nhắc một lần ở đâu | Dashboard, không chặn |
| D-M5 | `profiles.market`: giữ ghi (không dùng) hay dừng ghi khi A có hiệu lực | Dừng ghi, giữ cột |
