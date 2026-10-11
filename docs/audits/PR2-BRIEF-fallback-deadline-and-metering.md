# Brief: PR 2, hạn chót tổng cho chuỗi fallback + đưa đo lường sử dụng (C1) vào `main`

Trạng thái: **bản nháp để chủ sản phẩm duyệt. Chưa viết code, chưa tạo nhánh, chưa deploy.**
Căn cứ: ADR-012, `INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md` mục 6, 7 (R1, R5, R7) và 10. Không cần SQL.

## Mục tiêu

1. Chuỗi fallback trong `callWithFallback` có **hạn chót tổng**: yêu cầu không thể kéo dài (và không thể gọi thêm nhà cung cấp) sau khi client đã bỏ cuộc. Đóng R5 một phần và là điều kiện của Cách B (ADR-012, quyết định 2).
2. Đưa vào `main` việc đo lường sử dụng C1 (nhánh `feat/ai-usage-metering` @ `550e618`, 1 commit, ghép sạch vào `main` @ `1112b0b` theo `git merge-tree`, không xung đột) để có **số đo thật** trước khi đặt bất kỳ hạn mức nào.

## Ngoài phạm vi

Quota, sổ cái, bảng mới, `start`, session ID, idempotency, cổng thực thi chung, bất kỳ SQL nào, đổi giao diện, chọn đơn giá, đặt hạn mức. Đó là PR 3 trở đi.

## Phần 1: hạn chót tổng

**Hành vi hiện tại [CODE]:** mỗi nhà cung cấp có timeout 80 s (`providers.js:158`); chuỗi chạy tuần tự, không có giới hạn tổng; client hủy sau 100 s (`ai.jsx`, `serverScoring.js`) nhưng hàm Edge vẫn tiếp tục.

**Thiết kế đề xuất:**
- Thêm tham số `deadlineMs` (tổng thời gian cho cả chuỗi) vào `callWithFallback`.
- Trước mỗi lần thử: nếu thời gian còn lại ≤ ngưỡng tối thiểu có ích thì **không bắt đầu nhà cung cấp kế tiếp** và ném lỗi hết hạn (loại `upstream`, trạng thái hiển thị cho người dùng như lỗi quá thời gian, có thể thử lại).
- Timeout của từng lần thử = nhỏ hơn giữa 80 s và thời gian còn lại.
- Mặc định phải **nhỏ hơn timeout phía client** (100 s) để server không làm việc cho một yêu cầu mà client đã bỏ.
- Cả ba hàm (`ai`, `score-interview`, `score-star`) truyền cùng hạn chót.

**Giá trị cần chủ sản phẩm xác nhận (không tự đặt):** hạn chót tổng và ngưỡng tối thiểu. Gợi ý khởi điểm để bàn: tổng nhỏ hơn 100 s (ví dụ 90 s), ngưỡng bằng một phần nhỏ của timeout mỗi nhà cung cấp. **Giới hạn thời gian thật của Supabase Edge Function: [UNKNOWN] từ repo**, phải tra tài liệu Supabase trước khi chốt, vì hạn chót phải nhỏ hơn nó.

**Lưu ý:** hủy `fetch` không chứng minh nhà cung cấp ngừng tính tiền. PR này giảm thời gian và số lần thử bị bỏ rơi, không giải quyết đối soát chi phí (đó là PR 5).

## Phần 2: đo lường C1

- Merge `feat/ai-usage-metering` (hoặc cherry-pick commit `550e618`) vào nhánh mới từ `main`.
- Giữ nguyên các bảo đảm đã có: mỗi lần thử một dòng log `[usage] {json}`, chỉ đếm và metadata, **không** nội dung CV hay câu trả lời, người dùng đã băm bằng `USAGE_LOG_SALT`, `PRICE_TABLE` để trống (chi phí tính ra là `null`, không đoán).
- `USAGE_LOG_SALT` đặt bằng `supabase secrets set` do Ivy chạy cục bộ (không dán vào chat).
- Kiểm tra lại: `src/lib/ai.jsx` gửi trường `feature` và test cũ đã cập nhật.

## Kiểm thử cần có

- Hạn chót: chuỗi 3 nhà cung cấp giả, mỗi cái treo; tổng thời gian không vượt hạn chót; nhà cung cấp kế tiếp **không** được gọi khi hết giờ; lỗi trả về đúng loại.
- Khi nhà cung cấp đầu thành công trong hạn chót: hành vi không đổi.
- Khi nhà cung cấp đầu lỗi nhanh và nhà cung cấp thứ hai thành công trong hạn chót: fallback vẫn hoạt động.
- Hạn chót áp dụng cho cả ba hàm (test handler).
- Đo lường: dòng log không chứa nội dung; không có `userRef` thô; lỗi đo lường không làm hỏng yêu cầu (đã có trong `usage.test.js`).
- Toàn bộ `npm test` so với baseline 86 file / 1215 qua + test mới; ghi **kết quả thật**.

## Triển khai (do Ivy chạy, từng bước, chỉ sau khi duyệt)

1. Đặt `USAGE_LOG_SALT` (cục bộ, `read -s`).
2. Deploy lại `ai`, `score-star`, `score-interview` bằng Supabase CLI. Phiên bản hiện đang chạy ở production so với repo: **[UNKNOWN]**, nên ghi lại phiên bản trước khi deploy để có thể quay lại.
3. Theo dõi log: dòng `[usage]` xuất hiện, không có nội dung, tỉ lệ lỗi không tăng.
4. Quay lại nếu cần: deploy lại phiên bản hàm cũ. Không có thay đổi dữ liệu để hoàn tác.
5. **Không** deploy website (container) trong bước này; PR 2 không đụng giao diện.

## Tiêu chí hoàn thành (cổng sang PR 3)

- Test mới và toàn bộ test qua.
- Sau deploy, có log `[usage]` thật cho ít nhất các lời gọi `ai`, `score-interview` và `score-star`.
- Báo cáo sử dụng (`scripts/usage-report.mjs`) chạy được trên log thật, cho số lượng và token theo tính năng (chi phí vẫn là "chưa có đơn giá").
- Chủ sản phẩm có số liệu đó trong tay để quyết định hạn mức (câu 3b của audit) trước khi PR 3 bắt đầu.

## Rủi ro

- Hạn chót quá ngắn có thể làm lỗi những yêu cầu hợp lệ nhưng chậm (CV lớn, PDF). Giảm bằng cách chọn hạn chót từ số đo thật của log C1 nếu có thể, hoặc đặt dễ thở rồi siết sau.
- Nhà cung cấp miễn phí hay bị 429 (đã gặp Gemini và Groq): hạn chót ngắn hơn làm số lần fallback thành công ít hơn. Cần quan sát sau deploy.

## Thứ tự xây sau PR 2 (đã duyệt hướng, chưa duyệt chi tiết)

PR 3 (cần SQL được duyệt riêng): bảng phiên + sổ cái, `start`, idempotency · PR 4: cổng thực thi chung, `ai` đi qua cổng · PR 5: quota người dùng/phiên/đồng thời và đối soát timeout (Cách B) · PR 6: quan sát và bật dần bằng cờ phía server. Giao diện giai đoạn A (hẹn giờ hướng dẫn, nhập text, trạng thái phiên) có thể chốt song song, không cần backend mới. Ghi âm (giai đoạn B) chỉ sau PR 5.
