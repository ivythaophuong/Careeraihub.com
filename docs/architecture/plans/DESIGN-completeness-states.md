# Thiết kế: trạng thái dữ liệu của Completeness ("không đọc được" khác "thiếu")

Trạng thái: **DESIGN + bộ test ghi trước (`it.fails`). Chưa triển khai, chưa đổi `SCORE_VERSION`, chưa đổi điểm đang chạy.** Cần chủ sản phẩm duyệt mục 9 trước khi code.
Viết 2026-10-12 cho chủ sản phẩm (Ivy). Thuật ngữ kỹ thuật giữ tiếng Anh. Nhãn: **[CODE]** đọc trong mã · **[PROBE]** chạy thử trên CV tổng hợp · **[PROPOSAL]** đề xuất · **[UNKNOWN]**.

## 1. Nguyên tắc (đã chốt)
- Không tìm thấy dữ liệu trong **văn bản đã trích xuất** không đồng nghĩa với CV gốc không có dữ liệu đó. "Missing" chỉ được dùng khi quy trình đọc đủ tin cậy để hỗ trợ kết luận.
- "Unknown" phải **có căn cứ và truy vết được** (mã lý do + số đếm), không phải cách né điểm thấp, và không được suy ra từ một dấu hiệu mơ hồ.
- Loại "unknown" khỏi phép tính, nhưng **phải cho người dùng thấy** phần nào chưa được đánh giá; điểm 90 không được tạo cảm giác chính xác tuyệt đối khi một phần chưa được đọc.
- Đổi ý nghĩa của điểm thì tăng `SCORE_VERSION`; điểm cũ không so sánh với điểm mới như cùng một tiêu chuẩn.

## 2. Hiện trạng [CODE] và [PROBE]
- `scoreCompleteness` (`src/scoring/resumeScore.js`) có 4 tín hiệu ngang nhau: tên, email, kinh nghiệm hoặc học vấn, kỹ năng. Mỗi tín hiệu chỉ là `present` hoặc `missing`. Điểm = số `present` / 4.
- `extraction.status` có `ok | partial | failed`; `failed` làm cả điểm `null` (đúng). `structure_lost` đặt `failed`.
- Chuỗi bằng chứng `"<tên>: present|missing"` được **phân tích bằng regex** ở `src/lib/describeScorePart.js` và `src/features/ATSBuilder/codeFindings.js`: đó là một hợp đồng ngầm, dễ vỡ.
- Hai kiểm tra còn lại (`measurable_impact`, `chronology_health`) đã `null` khi thiếu dữ liệu và bị loại khỏi trung bình. Chỉ Completeness chưa có khái niệm "không biết".

Các CV tổng hợp bị gán `missing` sai hiện nay [PROBE]:

| CV | Điểm hiện tại | Điều thực sự đúng |
|---|---|---|
| Kỹ năng ghi dưới tiêu đề lạ ("Toolbox Matters") | 90, `skills: missing` | Có danh sách kỹ năng; reader không nhận tiêu đề |
| Công việc dưới tiêu đề lạ ("Career Odyssey") | 75, `experience or education: missing` | Có công việc có ngày; reader không nhận tiêu đề |
| Tiêu đề "Experience" nhưng nội dung là đoạn văn, không tách được mục | 75, `missing` | Có mục kinh nghiệm; reader không tách được |
| Email bị xuống dòng giữa chừng ("jordan@" / "example.com") | 90, `email: missing` | Có email; reader không ghép được |
| Tên mơ hồ (hai dòng cùng giống tên) | 90, `name: missing` | Có tên; reader từ chối đoán (đúng thiết kế) |
| CV hai cột (tên ở cột phải, sau tiêu đề "Contact") | `name: missing` | Có tên; reader chưa nhận biết cột |

## 3. Trạng thái của từng tín hiệu [PROPOSAL]
Mỗi tín hiệu có một `state` và, nếu `unknown`, một `reason` cùng bằng chứng đếm được (**không lưu nội dung CV**):

| state | Nghĩa |
|---|---|
| `present` | Có bằng chứng: có giá trị đọc được và nguồn của nó |
| `missing` | Có cơ sở khẳng định không có trong văn bản đã đọc: quy trình đọc `ok` và không có dấu hiệu nào cho thấy dữ liệu có ở đâu đó mà reader không đọc được |
| `unknown` | Chưa đủ bằng chứng để xác định; có mã lý do |
| `not_applicable` | **Chưa dùng.** Không có tín hiệu nào hiện nay mà "không áp dụng" là một câu trả lời đúng ("kinh nghiệm hoặc học vấn" đã cho phép sinh viên chỉ có học vấn). Chỉ thêm khi có trường hợp thật và định nghĩa rõ. |

## 4. Quy tắc cho từng tín hiệu [PROPOSAL]
Điều kiện chung: `extraction.status === 'ok'`. Nếu là `partial` thì mọi tín hiệu chưa `present` là `unknown` (`extraction_incomplete`).

| Tín hiệu | present | missing | unknown (mã lý do) |
|---|---|---|---|
| name | `extractName` đọc được | **không bao giờ**: văn bản đã trích xuất không chứng minh được một CV không có tên | mọi trường hợp còn lại: `name_not_read` (reader từ chối hoặc không thấy ứng viên); `ambiguous_name_candidates` (nhiều ứng viên ngang nhau) |
| email | khớp email ở bất kỳ đâu trong văn bản | văn bản **không có ký tự `@`** | `email_like_text_not_parsed`: có `@` nhưng không ghép được thành email (ví dụ bị xuống dòng) |
| experience or education | có ít nhất một mục kinh nghiệm hoặc học vấn đọc được | không có mục nào, **không có tiêu đề kinh nghiệm/học vấn nào được nhận ra**, và **không có dòng khoảng ngày nào** trong văn bản | `section_found_no_entries` (nhận ra tiêu đề nhưng không tách được mục); `dates_without_section` (có dòng khoảng ngày nhưng không có mục nào) |
| skills | có kỹ năng đọc được từ tiêu đề đã nhận | không có tiêu đề kỹ năng nào được nhận ra và **không có dòng nào có hình dạng danh sách kỹ năng** dưới một dòng tiêu đề không nhận ra | `skills_shaped_list_under_unrecognised_heading`: một dòng ngắn đứng riêng, không nhận ra, theo sau là danh sách ≥3 mục ngắn ngăn cách bằng dấu phẩy/gạch đứng |

Ghi nhận trung thực về độ yếu: "hình dạng danh sách kỹ năng" và "dòng khoảng ngày" là heuristic. Chúng chỉ **hạ** `missing` xuống `unknown` (an toàn hơn), không bao giờ nâng lên `present`. Lý do được lưu dưới dạng mã + số đếm để điều tra, không lưu chữ.

## 5. Cách tính điểm [PROPOSAL, chủ sản phẩm đã chọn: loại unknown khỏi phép tính]
- `completeness` = `round(100 × present / (present + missing))` trên các tín hiệu **đã được đánh giá**. Nếu không tín hiệu nào được đánh giá, phần này `null`; vì là phần bắt buộc nên điểm tổng `null` (đúng hợp đồng hiện có, không đổi).
- Công thức tổng (trọng số 0.4 / 0.3 / 0.3 trên các phần đã tính) **không đổi**.
- **Hiển thị mức độ đầy đủ của đánh giá:** kết quả có `assessment = { assessed, total, not_assessed: [{ part, signal, reason }] }`. Giao diện hiện cạnh số điểm: "Dựa trên N / M kiểm tra" khi chưa đủ, và nêu rõ phần nào chưa được đọc ("Tên: chưa đọc được. Hãy kiểm tra."). Không có trần điểm hay ngưỡng do chúng ta tự đặt.
- Hệ quả cần biết: thay một `missing` thật bằng `unknown` làm điểm tăng. Chống lạm dụng bằng: điều kiện `unknown` ở mục 4 hẹp và ghi mã lý do; nhãn "Dựa trên N / M" luôn hiện; và dữ liệu thật ra có thể sửa dễ hơn bằng cách thêm một tiêu đề chuẩn.

## 6. Hợp đồng dữ liệu [PROPOSAL]
- Phần `completeness` thêm `signals: [{ id, state, reason|null, evidence: { source, count? } }]`. Giao diện và Builder **ngừng đọc chuỗi bằng regex**, chuyển sang đọc `signals` (`describeScorePart.js`, `codeFindings.js`). Chuỗi `evidence` giữ cho con người đọc.
- `scoreResult.js` (contract): cho phép `signals` và `assessment`; kiểm tra `state` ∈ {present, missing, unknown}; `unknown` bắt buộc có `reason`; `missing` không được có `reason`; `not_assessed` khớp với các `unknown`.
- **`SCORE_VERSION` 1.0.0 → 2.0.0.** Điểm cũ giữ nguyên trong `resume_scans.score_version` (hiện **không có nơi ghi** điểm này, chỉ có 5 dòng cũ, theo `docs/database/README.md`); không tính lại, không so sánh khác phiên bản. Không cần SQL.

## 7. Bộ test (viết trước, đang là `it.fails`)
`src/scoring/completenessStates.test.js`. Mỗi ca dưới đây phải đúng khi triển khai; hiện đều thất bại vì chưa có `signals`:
1. CV đầy đủ: 4 `present`, 100, không có `not_assessed`.
2. **Thiếu thật:** không có `@` nào: `email: missing`, điểm giảm.
3. **Thiếu thật:** không tiêu đề kỹ năng, không danh sách kỹ năng: `skills: missing`.
4. **Thiếu thật:** CV chỉ có tên, email, kỹ năng (không công việc, học vấn, ngày): `experience or education: missing`.
5. Sinh viên chỉ có học vấn: `present`.
6. **Không đọc được:** kỹ năng dưới tiêu đề lạ: `unknown` (`skills_shaped_list_under_unrecognised_heading`), điểm tính trên 3 tín hiệu, `assessment` 3/4.
7. **Không đọc được:** công việc có ngày dưới tiêu đề lạ: `unknown` (`dates_without_section`).
8. **Cấu trúc không hỗ trợ:** tiêu đề Experience nhưng chỉ có đoạn văn: `unknown` (`section_found_no_entries`).
9. Email bị xuống dòng: `unknown` (`email_like_text_not_parsed`), không phải `missing`.
10. Tên mơ hồ: `unknown`, **không bao giờ `missing`**.
11. **Trích xuất thất bại** (mất xuống dòng): điểm tổng `null` như hiện nay, không có `signals` giả.
12. Tất cả `unknown`: phần `null` và điểm tổng `null`, không phải 0.
13. Giao diện không còn phân tích chuỗi: đổi chuỗi bằng chứng không làm hỏng `describePart` và `codeFindings`.
14. Hợp đồng: `unknown` thiếu `reason`, hoặc `missing` có `reason`, bị `validateScoreResult` từ chối.
15. Chống lạm dụng: CV thiếu email thật nhưng có ký tự `@` ở chỗ khác (ví dụ trong URL) không được coi là có email, và kết quả ghi rõ lý do.
16. Phiên bản: kết quả mang `version: 2.0.0`; kết quả `1.x` không được dùng làm so sánh.

## 8. Rủi ro
- Heuristic `unknown` sai theo hướng nâng điểm cho CV thật sự thiếu. Giảm bằng điều kiện hẹp, nhãn "N / M", và theo dõi sau triển khai.
- Đổi ý nghĩa điểm: người dùng đã thấy 90 có thể thấy 100 hoặc ngược lại khi quét lại. Cần dòng giải thích trên giao diện; không so sánh điểm khác phiên bản.
- Phụ thuộc chất lượng reader (nhánh bộ đọc đã nêu giới hạn). Thiết kế này không thay việc cải thiện reader; nó chỉ ngừng biến "reader không đọc được" thành "CV thiếu".
- Thông điệp: "chưa đọc được" phải đi kèm hướng dẫn cụ thể cho người dùng (kiểm tra tiêu đề, định dạng). Câu chữ nằm trong một file duy nhất để duyệt.

## 9. Quyết định cần chủ sản phẩm
| # | Câu hỏi | Đề xuất |
|---|---|---|
| C1 | Tên không bao giờ là `missing` (chỉ `present` hoặc `unknown`)? | Có: văn bản đã trích xuất không chứng minh được sự vắng mặt của tên |
| C2 | Chấp nhận heuristic "hình dạng danh sách kỹ năng" và "dòng khoảng ngày" làm căn cứ hạ `missing` xuống `unknown`? | Có, vì chúng chỉ làm kết luận thận trọng hơn; ghi mã lý do |
| C3 | Câu chữ hiển thị khi chưa đủ: "Dựa trên N / M kiểm tra" và "Tên: chưa đọc được. Hãy kiểm tra." | Duyệt câu chữ trước khi code |
| C4 | Tăng `SCORE_VERSION` lên 2.0.0 và coi điểm 1.x là không so sánh được | Có |
| C5 | Có hiển thị điểm khi chỉ 1 trên 4 tín hiệu được đánh giá, hay hiện "chưa đủ dữ liệu"? | Hiện "chưa đủ dữ liệu" khi < 2 trên 4 tín hiệu được đánh giá. [Đây là một ngưỡng do chúng ta đặt: cần chủ sản phẩm duyệt hoặc bỏ] |
