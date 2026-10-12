# Audit: STAR Builder (nguồn điểm, công thức, nơi lưu, nơi dùng)

Trạng thái: **chỉ đọc và kiểm chứng. Không đổi hành vi nào của STAR Builder, không đổi công thức điểm, không SQL.** Viết 2026-10-12 cho chủ sản phẩm (Ivy). Thuật ngữ kỹ thuật giữ tiếng Anh.
Nhãn: **[CODE]** đọc trong mã · **[REPRODUCED]** tái hiện bằng test (ban đầu `STARBuilder.audit.test.jsx`, nay là `STARBuilder.integrity.test.jsx`) · **[STAGING]** đọc trong script bản sao staging, không phải mã production · **[UNKNOWN]**.

## 1. Luồng dữ liệu [CODE]
1. Người dùng điền bốn ô Situation, Task, Action, Result (mỗi ô 15 đến 2000 ký tự).
2. **Review:** (khi bật server scoring) `score-star` gọi mô hình AI với prompt coi bốn khối là dữ liệu không tin cậy.
3. AI trả: **điểm 0–100 cho từng phần**, bản viết lại từng phần, một câu tóm tắt, 3–5 nhận xét, 0–4 câu hỏi thiếu chi tiết, 1–4 chủ đề năng lực.
4. **Mã** làm tròn và kẹp điểm từng phần, rồi tính **điểm tổng = trung bình có trọng số** 0.15 Situation, 0.15 Task, 0.40 Action, 0.30 Result. Server ký một biên nhận HMAC trên (người dùng, thời gian, câu chuyện, điểm từng phần, bản viết lại, câu tóm tắt).
5. **Save:** người dùng bấm lưu; server kiểm biên nhận, **tính lại điểm tổng từ điểm từng phần đã ký**, chống trùng (cùng `one_liner` và `situation` thì trả lại hàng cũ), tối đa 30 lần lưu mỗi 24 giờ, rồi chèn hàng `star_stories` bằng service role.
6. Trigger cơ sở dữ liệu tính lại `candidate_trust_profiles`. Trong script staging: `star_score` = **trung bình điểm của 5 câu chuyện mới nhất**; `trust_score` = 0.40 ATS + 0.35 phỏng vấn + 0.25 STAR [STAGING; phần thân hàm trên production chưa đọc: UNKNOWN, nhưng README ghi nhận kết quả khớp: một câu chuyện cho `star_score` 31, `trust_score` 8].
7. Bộ nhớ trên màn hình giữ 30 câu chuyện mới nhất.

## 2. Cái gì do mã, cái gì do AI
| Phần | Nguồn | Ghi chú |
|---|---|---|
| Điểm từng phần (4 số) | **AI** | Chấm bản **gốc** của người dùng, theo thang trong prompt (0–39 yếu, 40–69 dùng được nhưng mơ hồ, 70–89 mạnh, 90–100 xuất sắc). Prompt có câu "Most real first drafts score 40-75": một mỏ neo cho mô hình |
| Điểm tổng | **Mã** (trung bình có trọng số) | Nhất quán với điểm từng phần, nhưng đầu vào là ước lượng của AI |
| Bản viết lại, tóm tắt, nhận xét, câu hỏi, chủ đề | **AI** | Văn bản; có cảnh báo số liệu bịa phía client |
| Giới hạn độ dài, giới hạn lưu, chống trùng, biên nhận, ghi bằng service role | **Mã** | |
| Cảnh báo con số AI thêm vào (`findInventedNumbers`) | **Mã, phía client, chỉ cảnh báo** | Không chặn, không lưu, server không kiểm |
| Kiểm tra "we" bị biến thành "I", mở rộng phạm vi | **Chỉ là câu dặn trong prompt** | Không có kiểm tra bằng mã |
**Kết luận về điểm:** số hiển thị và lưu là **ước lượng của AI về hình thức viết**, được cộng bằng một công thức xác định. Đó không phải điểm tất định theo ADR-011. Bộ chấm cấu trúc bằng mã (`supabase/functions/_shared/structure/starStructure.js`) đã có nhưng **chưa được nối** vào đâu (`ENABLED_LANGUAGES` rỗng).

## 3. Nơi dùng điểm và số lượng câu chuyện [CODE]
| Nơi | Dùng gì |
|---|---|
| Career Roadmap, bước 2 | **số lượng** ≥ 5 (không xét chất lượng) |
| Overview của Interview Coach, AI Coach | số lượng và câu tóm tắt gần nhất |
| `MemoryDashboard.jsx` | **điểm trung bình** hiển thị "avg score N/100" (không ghi nhãn là ước lượng của AI) |
| `TrustMatch.jsx` (người dùng thấy) | `star_score` trong "Score breakdown", trọng số 25%; trust score có nhãn "Strong practice / Growing" |
| `EmployerPortal.jsx` (nhà tuyển dụng) | ở đường đọc cũ: `trust`, `ats`, `interview` và **nhãn "Strong / Good / Developing" suy từ `star_score`** (>70, >40). Đường mới `employer_view_candidates` ghi chú rằng không có điểm luyện tập. Đường nào đang chạy phụ thuộc cờ: **UNKNOWN**. Việc ẩn đường cũ là mục G1 đã nêu trong kế hoạch ADR-013 |
| `WeaknessRadar.jsx` | đọc 5 câu chuyện mới nhất; chưa đọc kỹ cách dùng |
| `Dashboard.jsx` | số lượng và hai câu mới nhất |

## 4. Phát hiện
| # | Phát hiện | Bằng chứng | Mức |
|---|---|---|---|
| F1 | **Điểm STAR là ước lượng của AI nhưng được trình bày như điểm /100, tô màu theo ngưỡng (≥75 xanh, ≥50 vàng), và đi vào trust score (25%).** Cùng một câu chuyện review hai lần có thể ra điểm khác nhau; độ lệch **chưa đo** (cần mô hình) | `starScoring.js`, `STARBuilder.jsx` (`scoreColorKey`), README cơ sở dữ liệu | Cao (trung thực), độ lớn UNKNOWN |
| F2 | **Server không phân biệt lần review.** Người dùng có thể review lại cùng câu chuyện hoặc bản sửa nhẹ nhiều lần rồi lưu lần được điểm cao nhất (best-of-N). Thêm câu chuyện mới và xóa câu thấp cũng đổi trung bình "5 câu mới nhất". Cùng loại vấn đề với D8 của Mock Interview | `score-star/handler.js` (mỗi `review` độc lập, chỉ chống trùng đúng `one_liner`+`situation`) | Trung bình |
| F3 | **Khi server báo trùng (`duplicate: true`), giao diện vẫn thêm một bản nữa vào danh sách trên màn hình.** Số đếm (Roadmap, Overview, Coach) tăng giả cho đến khi tải lại; cơ sở dữ liệu vẫn chỉ có một hàng | [REPRODUCED] danh sách có 2 thay vì 1; `duplicate` không được đọc ở `STARBuilder.jsx` hay `serverScoring.js` | Trung bình |
| F4 | **Xóa theo `one_liner` có thể xóa nhầm câu chuyện khác** có cùng câu tóm tắt nhưng khác tình huống. Bản ghi trên màn hình không lưu id của hàng cơ sở dữ liệu nên không xóa theo id được | [REPRODUCED] bộ lọc chỉ có `user_id` và `one_liner`; test hiện có còn ghim đúng hành vi này | Trung bình (mất dữ liệu) |
| F5 | **Không kiểm tra bằng mã việc "we" thành "I" hay mở rộng quyền sở hữu/phạm vi** trong bản viết lại; chỉ có số liệu bịa được cảnh báo, và chỉ phía client. Server lưu bản viết lại không kiểm. `claimGuard` (đã có cho Builder) chưa dùng ở đây | `star.js`, `STARBuilder.jsx` | Trung bình |
| F6 | **Không có gợi ý bước tiếp theo sau khi lưu** (chỉ có thanh điều hướng chung) | `STARBuilder.jsx` | Thấp |
| F7 | Nhãn "STAR structure" trong Overview cũ và trust score STAR 25% dùng cùng ước lượng AI; `MemoryDashboard` hiện điểm trung bình không ghi nhãn | Mục 3 | Trung bình |
| F8 | Nhà tuyển dụng có thể thấy nhãn xếp loại suy từ điểm AI ở đường đọc cũ | `EmployerPortal.jsx` | Cao nếu đường này đang bật; **UNKNOWN** |
| F9 | Đường `star_review_legacy` (khi tắt server scoring) ghi hàng `star_stories` từ trình duyệt kèm điểm do client gửi. Production đã thu hồi quyền INSERT của trình duyệt (bước S4), nên đường này không lưu được vào cơ sở dữ liệu | `STARBuilder.jsx`, ghi nhận trong `docs/database/README.md` | Thấp (chỉ khi cờ tắt) |
| F10 | Trường `bankAs` được Dashboard và Coach đọc nhưng không bao giờ được ghi cho câu chuyện mới (chỉ còn ở dữ liệu cũ) | `STARBuilder.jsx` | Thấp |

**Cập nhật sau khi viết:** F3 (lưu trùng làm số đếm tăng giả) và F4 (xóa nhầm câu chuyện cùng câu tóm tắt) đã được sửa ở PR riêng (P1): `STARBuilder.integrity.test.jsx` thay cho hai ca `it.fails`. Các phát hiện còn lại chưa đổi.

## 5. Giới hạn của audit này
- **Không chạy mô hình.** Không đo được độ biến thiên của điểm (F1), không hiệu chỉnh gì. Cần khóa mô hình và bộ câu chuyện tổng hợp (xem mục 6, P5).
- Không đọc thân hàm trigger trên production (chỉ bản staging và README).
- `WeaknessRadar` chưa đọc kỹ; cờ đường nhà tuyển dụng chưa xác định.
- Lúc viết, hai test đặc tả (F3, F4) là `it.fails`; xem cập nhật ở mục 4.

## 6. Đề xuất [PROPOSAL; chưa làm gì]
| # | Đề xuất | Kiểm chứng |
|---|---|---|
| P1 | **Sửa lỗi nhỏ F3 và F4:** đọc `duplicate` (không thêm bản trên màn hình); lưu id hàng cơ sở dữ liệu từ phản hồi lưu và xóa theo id (hoặc ít nhất thêm `situation`) | hai `it.fails` ở `STARBuilder.audit.test.jsx` đổi thành `it`; kiểm tra xóa không động tới câu khác |
| P2 | **Ghi nhãn điểm là ước lượng của AI** ở mọi nơi hiển thị: kết quả STAR, danh sách, `MemoryDashboard`, `TrustMatch` (như đã làm cho điểm phỏng vấn); bỏ màu xếp loại | test nội dung hiển thị cho từng nơi |
| P3 | **Quyết định điều gì được tính vào trust score khi review lại** (D-S1): mọi câu đã lưu như hiện nay, hay chỉ lần review đầu của mỗi câu chuyện. Chặn ở server cần định danh câu chuyện và sổ cái (SQL được duyệt), như D8 | quyết định sản phẩm trước; sau đó thiết kế |
| P4 | **Gợi ý bước tiếp theo sau khi lưu**, từ trạng thái thật (ví dụ "bạn có n trên 5 câu chuyện"), dùng chung `nextActions()` | test theo trạng thái |
| P5 | **Đo độ biến thiên:** bộ ~10 câu chuyện tổng hợp, mỗi câu review 5 lần bằng mô hình thật; ghi độ lệch của từng phần và điểm tổng; chỉ sau đó mới nói về hiệu chỉnh | cần khóa mô hình; quy trình sẽ viết khi chị sẵn sàng |
| P6 | Nối bộ chấm cấu trúc bằng mã theo cổng đã duyệt (`ACCEPTANCE-deterministic-practice-scores.md`); không hiển thị trước cổng | theo tài liệu đó |
| P7 | Ẩn nhãn xếp loại suy từ điểm luyện tập ở đường nhà tuyển dụng cũ (G1 của ADR-013) | kiểm tra bằng mã và cờ |
| P8 | Áp dụng kiểm tra "we" và phạm vi (kiểu `claimGuard`) cho bản viết lại STAR; chỉ cảnh báo | test như ở Builder |

## 7. Tiêu chí nghiệm thu cho các thay đổi sau này
- **Truy vết điểm:** từ số hiển thị đến nguồn (AI hay mã), công thức, nơi lưu, nơi dùng được ghi lại và có test.
- **Số đếm đúng:** bản trên màn hình khớp cơ sở dữ liệu sau lưu trùng, xóa và tải lại.
- **Trung thực:** không nơi nào trình bày điểm AI như điểm xác thực; không nhãn xếp loại suy từ điểm AI ở nơi nhà tuyển dụng thấy.
- **Không thưởng cho việc thử lại:** quy tắc điều gì được tính được chủ sản phẩm quyết và test chứng minh.

## 8. Quyết định cần chủ sản phẩm
| # | Câu hỏi | Đề xuất |
|---|---|---|
| D-S1 | Khi review lại một câu chuyện, điều gì được tính vào trust score? | Quyết định sản phẩm tương tự D8; em nghiêng về "mỗi câu chuyện chỉ tính điểm của lần review đầu tiên của nó" nhưng chặn ở server cần SQL |
| D-S2 | Có làm P1 (sửa F3, F4) và P2 (ghi nhãn ước lượng) ngay, như hai PR nhỏ? | Có, không phụ thuộc quyết định nào khác |
| D-S3 | Có thu bộ đo biến thiên (P5) trước khi bàn về hiệu chỉnh? | Có |
