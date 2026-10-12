# Thiết kế: trạng thái dữ liệu của Completeness ("không đọc được" khác "thiếu")

Trạng thái: **DESIGN + bộ test ghi trước (`it.fails`). Chưa triển khai, chưa đổi `SCORE_VERSION`, chưa đổi điểm đang chạy.** Quyết định của chủ sản phẩm (2026-10-12) ở mục 10: C1 và C4 duyệt, C2 duyệt có điều kiện, C3 chờ chỉnh câu chữ, C5 bỏ ngưỡng 2/4.
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

### Nơi đọc Completeness [CODE, tìm bằng tìm kiếm toàn bộ `src/`, 2026-10-12]
Phải cùng chuyển sang một hợp đồng dữ liệu; không được để một nơi đọc `signals` còn nơi khác vẫn đọc chuỗi cũ rồi hiển thị mâu thuẫn.

| Nơi | Đọc gì | Việc cần làm |
|---|---|---|
| `src/scoring/resumeScore.js` (`scoreCompleteness`, `scoreResume`) | Tạo điểm và chuỗi bằng chứng | Sinh `signals` và `assessment`; `SCORE_VERSION` 2.0.0 |
| `src/scoring/computeDeterministicScore.js` | Gọi `scoreResume` | Không đổi logic; kiểm tra truyền qua đủ trường |
| `src/contracts/scoreResult.js` | Kiểm tra hợp đồng (từ chối khóa lạ trong `part`) | Cho phép `signals`/`assessment`, thêm các luật ở mục 6 |
| `src/lib/describeScorePart.js` | **Regex** trên `"<tên>: present\|missing"`; nhãn "✗ … not found" | Đọc `signals`; nhãn "not read" cho `unknown`, "not found" chỉ cho `missing` |
| `src/features/ATSBuilder/ATSBuilder.jsx` (`UploadAndParseTab`) | Ô "ATS readiness" (dòng ~302), câu "Score below 80 / Strong resume" (~325), vòng điểm và nhãn "Strong Resume / Needs…" (~391), bảng Score Breakdown qua `describePart` (~451) | Hiện phạm vi đánh giá cạnh số; không gọi "Strong Resume" khi điểm dựa trên ít tín hiệu; ô và vòng điểm không dùng riêng một con số |
| `src/features/ATSBuilder/builderText.js` (`scoreBuilderData`) | Trả nguyên `ScoreResult` | Không đổi; kiểm tra đủ trường |
| `src/features/ATSBuilder/components/BuilderScorePanel.jsx` | In **thẳng chuỗi bằng chứng** của từng phần; số điểm | Hiện phạm vi đánh giá; ngừng in chuỗi thô cho Completeness |
| `src/features/ATSBuilder/codeFindings.js` | **Regex** trên chuỗi để ra "Add an email address", v.v. | Đọc `signals`: chỉ `missing` sinh gợi ý "thêm …"; `unknown` sinh "kiểm tra …" (không bảo người dùng thêm thứ có thể đã có) |
| Test khóa hành vi cũ | `resumeScore.test.js`, `computeDeterministicScore.test.js`, `describeScorePart.test.js`, `codeFindings.test.js`, `builderText.test.js`, `builderEquivalence.test.js`, `ATSBuilder.gate3.test.jsx`, `ATSBuilder.gate4.upload.test.jsx` (kỳ vọng điểm và chuỗi `…: missing` trên PDF mẫu), `readerParity.test.js` | Cập nhật có chủ ý, kèm lý do từng thay đổi kỳ vọng |
| Nơi ghi điểm vào cơ sở dữ liệu | **Không có** (`resume_scans` không có nơi ghi) | Không cần SQL |


## 3. Trạng thái của từng tín hiệu [PROPOSAL]
Mỗi tín hiệu là `{ id, state, reason, evidence }`. `state` ∈ `present | missing | unknown`:

| state | Nghĩa | `reason` | `evidence` (có cấu trúc, **không chứa nội dung CV**) |
|---|---|---|---|
| `present` | Có bằng chứng: có giá trị đọc được | luôn `null` | `{ source }` |
| `missing` | Có cơ sở khẳng định không có trong văn bản đã đọc | luôn `null` | `{ checked: [...], counts }` (đã kiểm tra những gì) |
| `unknown` | Chưa đủ bằng chứng để xác định | **bắt buộc**, một mã trong danh sách đóng | `{ counts }` |

- `present` và `missing` **không được** mang lý do liên quan đến lỗi trích xuất. Chỉ `unknown` có `reason`.
- `not_applicable`: **chưa dùng.** Không có tín hiệu nào mà "không áp dụng" là một câu trả lời đúng ("kinh nghiệm hoặc học vấn" đã cho phép sinh viên chỉ có học vấn). Chỉ thêm khi có trường hợp thật và định nghĩa rõ.
- Mã lý do (danh sách đóng): `name_not_read`, `ambiguous_name_candidates`, `email_like_text_not_parsed`, `section_found_no_entries`, `dates_without_section`, `skills_shaped_list_under_unrecognised_heading`, `extraction_incomplete`.

## 4. Quy tắc cho từng tín hiệu [PROPOSAL; C2 duyệt có điều kiện, xem mục 10]
**Nguyên tắc chung:** `missing` chỉ khi có đủ cơ sở **và** không có dấu hiệu nào cho thấy cấu trúc bị bỏ sót. Mỗi tín hiệu được xét **riêng**.

**Khi `extraction.status === 'partial'`:** không biến cả bảng thành `unknown`. Tín hiệu **đã có bằng chứng hợp lệ vẫn là `present`**. Chỉ tín hiệu mà việc đọc chưa hoàn tất khiến không thể kết luận `missing` mới thành `unknown` (`extraction_incomplete`). (Cách xác định tín hiệu nào bị ảnh hưởng: chỉ những tín hiệu mà `facts.extraction.notes` hoặc phần bị lỗi hợp đồng liên quan; nếu notes không chỉ rõ, quy tắc `missing` của mục này vẫn phải được thoả, nên mặc định là `unknown` cho tín hiệu chưa `present`. Tiêu chí cụ thể sẽ được ghi vào đặc tả trước khi code.) `failed` vẫn làm cả điểm `null`, không đổi.

| Tín hiệu | present | missing | unknown |
|---|---|---|---|
| name | `extractName` đọc được | **không bao giờ** (C1) | `name_not_read` (reader từ chối hoặc không thấy ứng viên); `ambiguous_name_candidates` (nhiều ứng viên ngang nhau) |
| email | khớp email ở bất kỳ đâu | văn bản **không có `@` nào ngoài URL hoặc tên tài khoản dạng `@jordan`**, và không có dòng nào kết thúc/bắt đầu bằng mảnh giống email | `email_like_text_not_parsed`: có `@` bên cạnh chữ-số nhưng không ghép được thành email (ví dụ bị xuống dòng) |
| experience or education | có ít nhất **một mục** kinh nghiệm hoặc học vấn đọc được | không có mục nào, **không tiêu đề kinh nghiệm/học vấn nào được nhận ra**, và **không có dòng khoảng ngày nào** | `section_found_no_entries` (nhận ra tiêu đề nhưng không tách được mục); `dates_without_section` (có dòng khoảng ngày nhưng không có mục nào) |
| skills | có kỹ năng đọc được từ tiêu đề đã nhận | không có tiêu đề kỹ năng được nhận ra và **không có dòng giống tiêu đề + danh sách kỹ năng** | `skills_shaped_list_under_unrecognised_heading` (một dòng ngắn đứng riêng, không nhận ra, theo sau là danh sách ≥3 mục ngắn ngăn cách bằng dấu phẩy/gạch đứng) |

Làm rõ hai điểm dễ nhầm:
- **Một dòng ngày tháng là dấu hiệu cần điều tra, không chứng minh có kinh nghiệm.** Dòng khoảng ngày không có mục nào đi kèm (ví dụ ngày của một chứng chỉ) làm tín hiệu `unknown`, **không** `present`. `present` cần một mục thật.
- **Email:** `@` trong URL (`medium.com/@jordan`) hay tên tài khoản (`@jordan`) **không** làm tín hiệu thành `unknown` và cũng **không** tính là có email.

Ghi nhận trung thực về độ yếu: "hình dạng danh sách kỹ năng" và "dòng khoảng ngày" là heuristic. Chúng chỉ **hạ** `missing` xuống `unknown`, không bao giờ nâng lên `present`. Lý do lưu dưới dạng mã + số đếm, không lưu chữ.

## 5. Cách tính điểm và hiển thị [PROPOSAL; C5 đã quyết]
**Ba trường hợp (C5, không có ngưỡng cứng):**

| Trường hợp | Hành vi |
|---|---|
| Không tín hiệu nào được đánh giá (cả 4 là `unknown`) | `completeness` là `null` và điểm tổng là `null` (đúng hợp đồng hiện có: phần bắt buộc `null` thì điểm `null`), không phải 0 |
| Có ít nhất một tín hiệu được đánh giá (`present` hoặc `missing`) | Tính theo công thức; **luôn hiển thị số tín hiệu được đánh giá** |
| Có tín hiệu `unknown` | Nêu cụ thể phần chưa đọc được; không bao giờ tính là `missing` |

- `completeness` = `round(100 × present / (present + missing))` trên các tín hiệu đã được đánh giá. Công thức tổng (0.4 / 0.3 / 0.3 trên các phần đã tính) **không đổi**.
- **Không đặt ngưỡng "tối thiểu 2/4".** Nhưng một điểm dựa trên 1 tín hiệu **không được trông tương đương** điểm dựa trên cả 4. Ví dụ: chỉ email được đánh giá và có mặt thì phần Completeness theo công thức là 100; số học đúng, nhưng rất dễ bị hiểu là "CV hoàn chỉnh 100%". Vì vậy:
  - Số điểm **luôn** đi kèm phạm vi ngay bên cạnh ("Dựa trên 1 / 4 kiểm tra"); khi đủ 4 / 4 thì không cần nhãn.
  - Không gọi "Strong Resume", "Needs Improvement" hay hiện câu hướng dẫn kiểu "Score below 80" khi điểm chưa dựa trên đủ tín hiệu; nhãn đó chỉ dành cho điểm đủ phạm vi. (Nhãn hiện có ở `ATSBuilder.jsx` ~dòng 391.)
  - Vòng điểm và ô "ATS readiness" không hiện số trần trụi khi phạm vi chưa đủ.
- Nếu muốn ẩn điểm khi đánh giá quá ít, quay lại quyết định đó khi có dữ liệu hoặc nguyên tắc sản phẩm cụ thể, không tự chọn ngưỡng.
- Hệ quả cần biết: thay một `missing` thật bằng `unknown` làm điểm tăng. Chống lạm dụng bằng: điều kiện `unknown` hẹp và ghi mã lý do; nhãn phạm vi luôn hiện.

## 6. Hợp đồng dữ liệu [PROPOSAL]
- `part.signals` (chỉ cho `completeness`): `[{ id, state, reason, evidence }]` như mục 3.
- `assessment` (cấp kết quả): `{ assessed, total, not_assessed }`. **`not_assessed` được sinh từ `signals`, không lưu như dữ liệu độc lập:** `assessed` = số tín hiệu `present` + `missing`; `total` = số tín hiệu của Completeness; `not_assessed` = đúng các `unknown`, mỗi mục `{ part, signal, reason }`. `assessment` cũng ghi các phần khác (`measurable_impact`, `chronology_health`) là `null`, theo cùng cách. Không thể có tín hiệu bị loại khỏi phép tính mà không có trong `not_assessed`.
- `scoreResult.js` (validator) từ chối: `unknown` thiếu `reason`; `present` hoặc `missing` có `reason`; `state` ngoài tập; mã lý do ngoài danh sách đóng; `not_assessed` không khớp chính xác tập `unknown`; `assessed + |not_assessed| ≠ total`.
- Giao diện và Builder **ngừng đọc chuỗi bằng regex**, chuyển sang đọc `signals`/`assessment` ở **mọi nơi trong bảng mục 2**. Chuỗi `evidence` chỉ để người đọc.
- **`SCORE_VERSION` 1.0.0 → 2.0.0.** Điểm cũ giữ nguyên với `score_version` của nó; không tính lại; không so sánh khác phiên bản. Không cần SQL (không nơi nào ghi điểm này).

## 7. Câu chữ hiển thị [PROPOSAL, chờ duyệt, C3]
Mọi câu nằm trong một file duy nhất để duyệt (kiểu `consentCopy.js`). Bản nháp:
- Phạm vi: **"Dựa trên {n} / {m} kiểm tra."**
- `unknown`: **"{Tên mục}: chưa đọc được. Đây là giới hạn của cách chúng tôi đọc tệp của bạn, không phải nhận xét về CV. Hãy kiểm tra {gợi ý cụ thể}."** Gợi ý: tên → "dòng đầu tiên của tệp"; email → "địa chỉ email có nằm trên một dòng không"; kinh nghiệm → "tiêu đề mục có phải dạng thông dụng (Experience, Work History) không"; kỹ năng → "tiêu đề mục kỹ năng có phải dạng thông dụng (Skills) không".
- `missing`: **"{Tên mục}: không tìm thấy trong văn bản đã đọc."** (không nói "CV thiếu").
- Không dùng "Strong Resume" / "Needs Improvement" khi `assessed < total`.

## 8. Bộ test (viết trước)
`src/scoring/completenessStates.test.js`. `it.fails` = chưa đạt, phải đổi thành `it` khi triển khai; `it` thường = đang đúng và phải giữ đúng; `it.todo` = cần viết khi giao diện đổi.
1. CV đầy đủ: 4 `present`, 100, không `not_assessed`.
2. Thiếu thật: không `@` nào: `email: missing`, điểm giảm.
3. Thiếu thật: không tiêu đề kỹ năng, không danh sách kỹ năng: `skills: missing`.
4. Thiếu thật: CV chỉ có tên, email, kỹ năng: `experience or education: missing`.
5. Sinh viên chỉ có học vấn: `present`.
6. Không đọc được: kỹ năng dưới tiêu đề lạ: `unknown`, điểm tính trên 3, phạm vi 3 / 4.
7. Không đọc được: công việc có ngày dưới tiêu đề lạ: `unknown` (`dates_without_section`).
8. Cấu trúc không hỗ trợ: tiêu đề Experience nhưng chỉ có đoạn văn: `unknown` (`section_found_no_entries`).
9. Email bị xuống dòng: `unknown`, không `missing`.
10. Tên mơ hồ / không thấy: `unknown`, **không bao giờ `missing`**.
11. Trích xuất thất bại (mất xuống dòng): điểm tổng `null`, không có `signals` giả.
12. **Tất cả `unknown`:** `completeness` `null`, điểm tổng `null`, không phải 0; `assessment` 0 / 4 với đủ 4 mục `not_assessed`.
13. **Chỉ một tín hiệu được đánh giá (email có mặt, ba cái còn lại `unknown`):** Completeness 100 theo công thức, `assessment` 1 / 4, ba mục `not_assessed`; điểm không được trình bày như điểm đủ phạm vi.
14. **`partial`:** tín hiệu đã có bằng chứng (tên, email) vẫn `present`; tín hiệu chưa đọc được thành `unknown` (`extraction_incomplete`), không phải cả bảng.
15. **`@` trong URL hoặc tên tài khoản:** không có email thật thì `email: missing` (không `unknown`, không `present`), và `evidence` ghi số `@` đã bỏ qua.
16. **Một dòng ngày không chứng minh kinh nghiệm:** dòng khoảng ngày của một chứng chỉ, không có mục kinh nghiệm hay học vấn: `unknown` (`dates_without_section`), không `present`.
17. **Bất biến:** với mọi CV mẫu, `not_assessed` đúng bằng tập các `unknown` và `assessed + |not_assessed| = total`.
18. Hợp đồng: chấp nhận `signals` đúng dạng; từ chối `unknown` thiếu `reason`, `missing`/`present` có `reason`, mã ngoài danh sách đóng, `assessment` lệch với `signals`.
19. Phiên bản: kết quả mang `2.0.0`.
20. (`it.todo`) Từng nơi đọc ở mục 2 dùng `signals`: `describePart`, `codeFindings`, `BuilderScorePanel`, bảng Score Breakdown, ô "ATS readiness" và vòng điểm (không nhãn "Strong Resume" khi phạm vi chưa đủ); đổi chuỗi `evidence` không làm vỡ chúng.

## 9. Rủi ro
- Heuristic `unknown` sai theo hướng nâng điểm cho CV thật sự thiếu. Giảm bằng điều kiện hẹp, nhãn phạm vi, mã lý do để điều tra.
- Đổi ý nghĩa điểm: người dùng có thể thấy điểm khác khi quét lại. Cần dòng giải thích; không so sánh điểm khác phiên bản.
- Điểm dựa trên ít tín hiệu bị đọc như điểm đầy đủ. Chỉ chặn được bằng hiển thị (mục 5), nên phần này phải được kiểm tra trên giao diện, không chỉ bằng test đơn vị.
- Phụ thuộc chất lượng reader. Thiết kế này không thay việc cải thiện reader; nó chỉ ngừng biến "reader không đọc được" thành "CV thiếu".
- Quy tắc `partial` chưa chỉ rõ cách xác định tín hiệu nào bị ảnh hưởng (xem mục 4). Cần chốt tiêu chí trước khi code.

## 10. Quyết định của chủ sản phẩm (2026-10-12)
| # | Quyết định | Ghi chú |
|---|---|---|
| C1 | **Duyệt:** tên chỉ `present` hoặc `unknown`, không bao giờ `missing` | |
| C2 | **Duyệt có điều kiện** | Điều kiện: `unknown` phải có căn cứ, mã lý do và số đếm; không suy ra từ một dấu hiệu mơ hồ; `missing` chỉ khi đủ cơ sở **và** không có dấu hiệu cấu trúc bị bỏ sót; một dòng ngày không tự chứng minh có kinh nghiệm; `partial` xử lý theo từng tín hiệu |
| C3 | **Duyệt sau khi chỉnh câu chữ** | Bản nháp ở mục 7, cần chủ sản phẩm duyệt từng câu |
| C4 | **Duyệt:** `SCORE_VERSION` 2.0.0, điểm 1.x không so sánh được | |
| C5 | **Bỏ ngưỡng 2/4** | Ba trường hợp ở mục 5; điểm luôn đi kèm phạm vi đánh giá; không ẩn điểm bằng ngưỡng tự chọn |

## 11. Trình tự (chủ sản phẩm duyệt)
1. Cập nhật tài liệu theo C1 đến C5 (**xong** ở bản này).
2. Hoàn thiện test đặc tả (**xong** ở bản này, mục 8).
3. Triển khai trên nhánh riêng, không sửa trực tiếp `main`.
4. Đổi `SCORE_VERSION` sang 2.0.0; xác minh toàn bộ đường đi của điểm và nhãn hiển thị (mục 2).
5. Chạy regression, build, và kiểm tra giao diện với CV đầy đủ, CV thiếu thật, CV trích xuất không đầy đủ và CV có cấu trúc không được hỗ trợ.
