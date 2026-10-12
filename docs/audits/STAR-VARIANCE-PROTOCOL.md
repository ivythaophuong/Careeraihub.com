# Giao thức P5: đo độ biến thiên của điểm STAR

Trạng thái: **giao thức và công cụ đã sẵn sàng; CHƯA CÓ KẾT QUẢ.** Việc chạy cần mô hình thật nên do chủ sản phẩm thực hiện trên máy của mình bằng khóa của mình. Viết 2026-10-12.
Nhãn: **[CODE]** · **[PROPOSAL]** · **[UNKNOWN]**. Quyết định D-S3 (chủ sản phẩm): đo độ biến thiên trước khi bàn về hiệu chỉnh.

## 1. Câu hỏi và điều gì KHÔNG được kết luận
**Câu hỏi:** khi cùng một câu chuyện STAR được review lại với cùng cấu hình, điểm từng phần và điểm tổng dao động bao nhiêu? (Phát hiện F1 của `STAR-BUILDER-AUDIT-2026-10-12.md`: điểm là ước lượng của AI, độ lệch chưa đo.)

Kết quả chỉ nói về **độ ổn định**. Nó **không** chứng minh điểm chính xác, công bằng hay dự báo được năng lực của ai. Ổn định và chính xác là hai câu hỏi khác nhau. **Không dùng kết quả để tự động đổi trọng số, ngưỡng hay công thức.**

## 2. Thiết kế
| Hạng mục | Quy định |
|---|---|
| Bộ dữ liệu | `tests/fixtures/star-variance/stories.json`: **10 câu chuyện tổng hợp**, nhiều mức viết (tối thiểu, mơ hồ, nói "chúng tôi", có hành động nhưng không có kết quả, cụ thể không có số, cụ thể có số, xung đột giữa người với người, trường ngắn, dài và độn chữ). Không dữ liệu thật, không email, điện thoại hay liên kết (test kiểm tra). Nhãn `intended` là cách tôi tự mô tả kiểu viết, viết trước khi chạy, **không gửi cho mô hình** và không phải chân lý |
| Số lần chạy | **5 lần mỗi câu chuyện, tổng 50 lượt review.** Chạy xen kẽ (mỗi vòng gồm mọi câu chuyện) để giờ giấc không dồn vào một câu |
| Mã chạy | **Chính hàm `review` của `score-star`** [CODE]: cùng prompt, cùng cách chuẩn hóa và tính điểm tổng (0.15 / 0.15 / 0.40 / 0.30), cùng mã gọi nhà cung cấp. Khác với production: xác thực được thay bằng một người dùng cục bộ; không ghi gì vào cơ sở dữ liệu; không có vai trò, cấp độ, ngành trong prompt |
| Cấu hình cố định | Một nhà cung cấp và một model cho cả lần đo (script từ chối chạy nếu có hơn một khóa nhà cung cấp, vì dự phòng có thể trộn model). Tham số: `maxTokens` do mã đặt; **nhiệt độ không do mã đặt** nên dùng mặc định của nhà cung cấp (ghi vào kết quả) |
| Được ghi lại | Nhà cung cấp và model thực sự dùng, số token (vào, ra, suy nghĩ), thời gian, **mã băm SHA-256 của prompt từng câu chuyện**, phiên bản mã (git commit), phiên bản Node, ngày giờ, số lần thử lại, có dùng dự phòng không |
| Đầu ra mỗi lượt | Bốn điểm thành phần và điểm tổng theo công thức hiện tại |
| Thống kê | Với từng câu chuyện và từng điểm (năm số): số lượt hợp lệ, trung bình, độ lệch chuẩn mẫu (n-1), nhỏ nhất, lớn nhất, khoảng (max trừ min) |
| Phân tích | **Biến thiên cùng một câu chuyện giữa các lần chạy** tách khỏi **khác biệt giữa các câu chuyện**: độ lệch chuẩn gộp trong từng câu, độ lệch chuẩn của trung bình các câu, và tỉ lệ phần biến thiên là do chạy lại (mô tả, không phải hệ số tin cậy). Cộng với mức độ nhất quán thứ tự các câu chuyện giữa các lần chạy (tương quan hạng Spearman với thứ tự trung bình) |
| Lượt lỗi | Được đếm riêng theo từng câu chuyện, **không bao giờ tính vào thống kê**. Lỗi giới hạn tần suất (429) và lỗi máy chủ của nhà cung cấp (502) được **thử lại sau một khoảng chờ** (30 giây, 65 giây, 120 giây); số lần thử lại và lý do lỗi thật được ghi lại. Lỗi 422 (câu trả lời bị cắt hoặc bị chặn) **không** được thử lại, vì đó là kết quả về câu trả lời |

## 3. Cách chạy (trên máy của chị, một bước một lúc)
1. Vào đúng nhánh và thư mục: `cd ~/careeraihub`. Ghi lại nhánh/commit đang dùng (script tự ghi commit).
2. **Chỉ một nhà cung cấp.** Kiểm tra tên biến khóa đang có (không in giá trị): `env | grep -E '^(ANTHROPIC|GEMINI|OPENAI|GROQ|OPENROUTER)_API_KEY=' | cut -d= -f1`. Nếu hiện hơn một tên, bỏ các biến còn lại bằng `unset TÊN_BIẾN`.
3. Nhập khóa mà không hiện ra màn hình (ví dụ cho Anthropic): `read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY`. **Đừng dán khóa vào chat hay vào tệp.**
4. Tùy chọn: `export AI_MODEL=<tên model muốn đo>` (nếu không, dùng mặc định của mã cho nhà cung cấp đó). Nên dùng **cùng model đang chạy ở production** nếu biết (hiện chưa biết: UNKNOWN).
5. Chạy: `node scripts/audit/starVariance.mjs --runs 5`
   - Mặc định chờ 1,5 giây giữa các lượt (`--delay-ms` để đổi). Thời gian: vài phút đến vài chục phút tùy nhà cung cấp [ước lượng, chưa đo]. Chi phí: **chưa biết**; số token từng lượt có trong kết quả.
   - Kết quả đầy đủ ghi vào `~/star-variance/results-<thời gian>.json` (ngoài kho git). Không có khóa nào trong tệp (test kiểm tra).
6. Báo lại cho tôi tên tệp. Tôi đọc tệp cục bộ trên cùng máy; tệp chỉ gồm câu chuyện tổng hợp, điểm và cấu hình.
7. Xong thì có thể bỏ khóa khỏi phiên: `unset ANTHROPIC_API_KEY`.

### Chạy tiếp từ một tệp kết quả cũ
Nếu một lần chạy bị mất nhiều lượt (ví dụ vì giới hạn tần suất), chạy tiếp bằng `--resume <tệp>`: giữ nguyên các lượt đã thành công, chỉ chạy các cặp (câu chuyện, vòng) còn thiếu. Công cụ **từ chối** chạy tiếp nếu model hoặc prompt của bất kỳ câu chuyện nào khác tệp cũ, hoặc nếu mã chấm điểm đã đổi (khi tệp cũ có ghi mã băm). Nếu tệp cũ không ghi mã băm của mã chấm điểm thì ghi chú điều đó vào kết quả. Các lượt đo ở những thời điểm khác nhau vẫn là các quan sát độc lập của cùng một cấu hình, nhưng chênh lệch theo giờ hoặc theo ngày (nếu có) sẽ nằm lẫn trong độ biến thiên.

## 4. Cách đọc kết quả (không đặt ngưỡng trước)
Chưa đặt ngưỡng "ổn định" hay "không ổn định" vì chưa có dữ liệu để biện minh cho một con số. Các so sánh đáng xem:
- Độ lệch chuẩn và khoảng của **cùng một câu chuyện**, cho điểm tổng và từng phần (phần nào dao động nhiều nhất).
- So với khoảng cách **giữa các câu chuyện**: nếu dao động giữa các lần chạy gần bằng khác biệt giữa câu chuyện yếu và mạnh, điểm khó dùng để phân biệt.
- Thứ tự các câu chuyện có giữ nguyên từ lần chạy này sang lần khác không.
- Có lượt lỗi hay dùng dự phòng không (nếu có, kết quả bị lẫn).
Mọi thay đổi trình bày hoặc công thức sau đó (ví dụ hiển thị khoảng thay vì một số) là **quyết định riêng**, không tự động theo từ kết quả này.

## 5. Giới hạn (nói thẳng)
- 10 câu chuyện do một người viết, 5 lần mỗi câu: đủ thấy dao động lớn, **không** đủ ước lượng chính xác một độ biến thiên hay nói về mọi loại câu chuyện.
- Một nhà cung cấp và một model mỗi lần đo; kết quả không suy ra được cho model khác. Model có thể đổi phiên bản theo thời gian.
- Nhiệt độ và các tham số lấy mẫu là mặc định của nhà cung cấp (mã không đặt), nên độ biến thiên đo được bao gồm cả chúng. Đó là điều người dùng thật gặp.
- Prompt ở đây không có vai trò, cấp độ, ngành như khi người dùng thật đã nhập; có thể ảnh hưởng nhẹ.
- Đo độ ổn định của **điểm**, không đo chất lượng của nhận xét hay bản viết lại.
- Chưa đo độ chính xác hay độ công bằng: cần người chấm độc lập và bộ dữ liệu phủ (xem `ACCEPTANCE-deterministic-practice-scores.md`).
