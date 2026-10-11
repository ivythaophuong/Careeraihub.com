# Brief: PR 1, tài liệu cho ràng buộc phía server của Interview Coach / Mock Interview

Trạng thái: **chủ sản phẩm chọn đưa PR 1 lên (2026-10-11). Chưa push, chưa mở PR; push và PR chỉ khi chủ sản phẩm xác nhận.**
Căn cứ: `docs/audits/INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md`, quyết định ngày 2026-10-11 (1 ok, 2 Cách B, 3 a+c).

## Mục tiêu

Đưa kết quả audit và các quyết định đã duyệt vào kho mã để người sau (và các PR sau) dựa vào, **không thay đổi hành vi của sản phẩm**.

## Phạm vi (chỉ tài liệu)

1. Thêm `docs/audits/INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md` (đã viết).
2. Thêm file brief này.
3. (Chủ sản phẩm đã đồng ý 2026-10-11) Một đoạn ghi chú ở đầu `docs/architecture/plans/PLAN-interview-integrity-signals.md`: "Superseded in part on 2026-10-11: paste and tab signals are not to be implemented; the server-issued `start` action and server-measured time are kept."
4. (Đã duyệt) Mục ADR-012 trong `docs/DECISIONS.md` ghi lại các quyết định đã duyệt.

## Ngoài phạm vi (không được làm trong PR này)

- Bất kỳ thay đổi nào trong `src/`, `supabase/`, `tests/`, `.github/`.
- Bất kỳ SQL hay migration nào, kể cả file dưới `docs/database/proposed/`.
- Đổi cấu hình, biến môi trường, cờ tính năng, triển khai.
- Sửa câu chữ trên màn consent (quyết định 3a: không sửa ngay, xem audit mục 11).
- Chọn nhà cung cấp chuyển giọng nói, đặt hạn mức tiền hay token, đặt giá.
- Merge `feat/ai-usage-metering` (đó là PR 2).

## Tiêu chí chấp nhận

- `git diff --stat` chỉ liệt kê file dưới `docs/`.
- `npm test` cho kết quả như baseline của `main` trong audit mục 9 (83 file, 1128 qua, 1 expected-fail, 4 skipped), vì không có code đổi. Đã chạy ngày 2026-10-11 trên nhánh `docs/interview-constraints-phase0`: đúng như vậy. Ghi kết quả thật vào mô tả PR, không ghi theo trí nhớ.
- Mọi tuyên bố trong tài liệu mang nhãn bằng chứng (CODE, TEST, DB, ESTIMATE, UNKNOWN) và không có con số hạn mức, giá hay chi phí được bịa.
- Không có dữ liệu cá nhân thật trong tài liệu.

## Cách làm khi chủ sản phẩm cho phép (từng bước, mỗi bước cần xác nhận)

1. Tạo **nhánh mới** từ `main` mới nhất (theo quy tắc chốt nhánh, dùng tên mới cho mỗi lần push), ví dụ `docs/interview-constraints-phase0`.
2. `git add` **đường dẫn cụ thể** cho các file ở phạm vi (không dùng `git add -A`; không đưa `package-lock.json` hay file White Paper HTML).
3. Commit theo cú pháp đang dùng của repo.
4. Push bằng refspec tường minh. Mở PR chỉ khi chủ sản phẩm nói; tiêu đề và mô tả do trợ lý soạn.

## PR 2 (để biết, chưa bắt đầu)

"Hạn chót tổng cho chuỗi fallback + merge đo lường C1". Cần brief riêng, không cần SQL, và chỉ bắt đầu sau khi PR 1 được duyệt.
