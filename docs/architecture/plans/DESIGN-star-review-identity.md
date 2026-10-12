# Thiết kế D-S1: một câu chuyện STAR, một kết quả được tính

Trạng thái: **DESIGN. Chưa code, chưa SQL, chưa đổi cách tính điểm hay trust score.** Viết 2026-10-12 cho chủ sản phẩm (Ivy). Thuật ngữ kỹ thuật giữ tiếng Anh.
Nhãn: **[CODE]** đọc trong mã · **[DB]** theo `docs/audits/TRUST-SCORE-TRACE.md` (hàm production đọc 2026-10-09 và 2026-10-11) · **[OWNER]** quyết định của chủ sản phẩm · **[PROPOSAL]** · **[UNKNOWN]**.
Đối chiếu: D8 (Mock Interview), ADR-011, ADR-012, ADR-013, `STAR-BUILDER-AUDIT-2026-10-12.md` (F2).

## 1. Nguyên tắc đã chốt [OWNER, 2026-10-12]
- Mỗi câu chuyện chỉ nên đóng góp **một kết quả review**, được chọn theo **quy tắc cố định**; người dùng không được tăng điểm chỉ vì thử lại nhiều lần.
- Chưa chốt "dùng điểm lần review đầu tiên". Trước hết phải xác định cách nhận diện một câu chuyện qua các lần chỉnh sửa, cách xử lý bản sửa thực sự có ý nghĩa, cách bảo toàn lịch sử.
- **Không viết SQL trước khi có thiết kế và test.** Thiết kế này không đổi trọng số, công thức hay trust score.

## 2. Hiện trạng
**Dòng chảy** [CODE]: review (`score-star`, mỗi lần gọi độc lập, không biết câu chuyện nào) → điểm AI từng phần + tổng do mã tính → biên nhận ký → người dùng bấm lưu → server tính lại điểm tổng từ điểm phần đã ký, chống trùng khi **đúng** `one_liner` và `situation`, tối đa 30 lần lưu mỗi 24 giờ, chèn hàng `star_stories` (`user_id, one_liner, score, situation, task, action, result, refined`).
**Không có:** mã định danh câu chuyện, số thứ tự lần review, nhật ký review, đường sửa một câu đã lưu (muốn sửa phải xóa và thêm lại), cách phân biệt "lần review đầu" với các lần sau.
**Trigger** [DB]: `STAR = AVG(score)` của **5 câu chuyện mới nhất**; **thiếu dữ liệu = 0**; `Trust = ROUND(ATS×0.40 + Interview×0.35 + STAR×0.25)`.
**Số đếm** [CODE]: Roadmap bước 2 cần ≥ 5 câu chuyện; Interview Coach hiển thị số lượng.

## 3. Người dùng có thể làm lợi bằng cách nào, và đâu là mục đích hợp lệ
| # | Hành vi | Hợp lệ? | Hiện nay |
|---|---|---|---|
| a | Review lại **cùng văn bản** đến khi được điểm cao, rồi lưu | Không (chỉ là tung xúc xắc) | Làm được |
| b | Sửa nhẹ vài chữ để "tung lại", lưu lần cao nhất | Không | Làm được |
| c | **Sửa thật sự** theo nhận xét, review lại để học | **Có, đó là mục đích của công cụ** | Làm được; không phân biệt được với (b) |
| d | Thêm nhiều câu, xóa câu điểm thấp để nâng trung bình "5 mới nhất" | Không | Làm được |
| e | Lưu nhiều phiên bản gần giống của cùng một câu chuyện, mỗi bản chiếm một chỗ trong 5 câu mới nhất | Không | Làm được (chỉ chặn bản trùng tuyệt đối) |
| f | Gọi API trực tiếp, chọn biên nhận điểm cao nhất | Không | Làm được (cùng loại giới hạn đã biết ở Mock Interview) |
**Hệ quả thiết kế:** không nên chặn việc **thực hành** (c); chỉ cần tách **điều được tính** khỏi **điều thực hành**. Đó cũng là cách D8 làm ở Mock Interview.

## 4. Tách luyện tập khỏi bản ghi [PROPOSAL]
- **Luyện tập:** số lần review không giới hạn (chỉ có giới hạn tần suất hiện có); hiển thị cho người dùng như thực hành, ghi nhãn ước lượng của AI (P2).
- **Bản ghi:** mỗi câu chuyện có **một** kết quả được tính, chọn theo quy tắc cố định (mục 6), bất biến sau khi được chọn.

## 5. Nhận diện "cùng một câu chuyện" [PROPOSAL, cần chủ sản phẩm chọn: D-S1a]
| Phương án | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **I1 (đề xuất)** | **Mã câu chuyện do server cấp** ở lần review đầu; sửa và review lại **kèm mã đó** ("Revise this story"); câu mới ("New story") nhận mã mới | Chính xác, không đoán, bảo toàn lịch sử | Cần một cột hoặc bảng mới (SQL), thay đổi luồng giao diện; người dùng có thể cố tình khai là "câu mới" |
| I2 | Nhận diện bằng **độ giống nội dung** (so khớp văn bản) | Không cần người dùng khai | Cần một ngưỡng tự đặt, không có dữ liệu; dễ lách bằng cách viết lại nhẹ; dễ gộp nhầm hai câu chuyện thật sự khác |
| I3 | Coi mỗi hàng đã lưu là một câu chuyện (hiện nay) | Không đổi gì | Không giải quyết (a, b, d, e) |
**Đề xuất:** I1 làm cơ sở, kèm một **nhắc nhở mềm** dựa trên độ giống (không ép buộc, ghi rõ là suy đoán): "Câu chuyện này giống câu X của bạn. Bạn muốn sửa câu đó?". Độ giống chỉ gợi ý, **không bao giờ** quyết định điều được tính.
**Chống lách "khai là câu mới":** I1 không ngăn người dùng bỏ mã cũ và tạo câu mới có nội dung gần y hệt; chỉ ngăn được nếu có nhắc nhở mềm và giới hạn số câu được tính. Đây là giới hạn đã biết, không giải quyết hoàn toàn bằng thiết kế.

## 6. Điều gì được tính cho mỗi câu chuyện [PROPOSAL, D-S1b]
| Quy tắc | Nội dung | Nhận xét |
|---|---|---|
| **W1 (đề xuất tạm thời)** | Điểm của **lần review đầu tiên** của câu chuyện đó | Nhất quán với D8; người dùng sửa thật vẫn thấy điểm luyện tập của bản sửa, nhưng không đổi điều được tính; **không thưởng cho người cải thiện thật**, phải nói rõ |
| W2 | Điểm của **phiên bản được lưu mới nhất** | Thưởng cải thiện thật, nhưng đúng là best-of-N nếu người dùng tung đến khi cao rồi lưu |
| W3 | Lần đầu, nhưng cho phép khai "viết lại hoàn toàn" để thành câu mới | Mở lại đường lách (b) |
| **W4 (đích đến)** | **Không đưa điểm AI vào trust score**; chỉ tính trên điểm xác định bằng mã (Structure Score sau cổng) | Phù hợp ADR-011 và ADR-013 (Q-B tiền điều kiện); làm cho D-S1 gần như hết ý nghĩa với trust score |
**Đề xuất:** W1 là quy tắc tạm thời **nếu** điểm STAR còn đi vào trust score; W4 là đích đến. Điều này liên quan trực tiếp mục sau.

## 7. Phụ thuộc vào quyết định trust score (ADR-013, bước G4) [quan trọng]
ADR-013 đã quyết **về nguyên tắc** (chưa triển khai): bỏ trust score tổng hợp khỏi mọi màn nhà tuyển dụng thấy (Q-A); điểm luyện tập chỉ chia sẻ nếu ứng viên cho phép và chỉ ở mức điểm cấu trúc kèm checklist (Q-B); bốn trạng thái điểm, **thiếu dữ liệu không bao giờ thành 0** (Q-C, trong khi trigger hiện nay thiếu dữ liệu = 0); điểm cũ giữ nguyên với nhãn "Earlier AI estimate" và không vào tổng hợp mới (Q-D); bảng điều khiển hiển thị số lượng hoạt động thay điểm (Q-E).
Hệ quả: **trước khi tối ưu cách tính điểm STAR cho trust score, cần chốt tương lai của trigger và `candidate_trust_profiles` (G4).** Nếu trust score tổng hợp được thay hoặc bỏ, D-S1 thu hẹp lại thành: "điểm STAR nào được hiển thị cho chính người dùng như tiến bộ luyện tập, và cách bảo toàn lịch sử". Thứ tự đề xuất: **G4 trước, rồi D-S1.**

## 8. Bảo toàn lịch sử và dữ liệu cũ [PROPOSAL; mô tả hình dạng, KHÔNG phải SQL để áp dụng]
- **Nhật ký review chỉ thêm, không sửa** (append-only): mỗi lần review ghi (mã câu chuyện, số thứ tự lần review, điểm từng phần, điểm tổng, thời điểm, mã biên nhận), do server ghi bằng service role; người dùng chỉ đọc của mình. Lần review đầu là dòng số 1, **không thể bị ghi đè**.
- Bản ghi `star_stories` có mã câu chuyện (duy nhất cho mỗi người dùng) và trỏ tới review được tính.
- **Hàng cũ** (chưa có mã câu chuyện, chưa có nhật ký): mỗi hàng là một câu chuyện riêng; điểm của nó được coi là điểm của "một lần review" mà **không biết có phải lần đầu hay không [UNKNOWN]**; hiển thị "Earlier AI estimate" và loại khỏi tổng hợp mới (Q-D). Chỉ chấm lại từ văn bản đã lưu khi **ứng viên yêu cầu**, thành một bản ghi mới, không ghi đè.
- Ràng buộc: bất kỳ SQL nào phải **cộng thêm, đảo ngược được**, thử trên bản sao trước, và cần chủ sản phẩm duyệt riêng (ADR-010, ADR-013 Q-D).

## 9. Yêu cầu phía server [PROPOSAL]
Quy tắc phải được **ép ở server**, không chỉ ở giao diện (cùng bài học ở Mock Interview):
- `review` nhận mã câu chuyện (hoặc cấp mã mới), tăng số thứ tự, ghi nhật ký; không nhận điểm từ client.
- `save` chỉ chấp nhận biên nhận do chính server cấp cho đúng mã câu chuyện đó, và gắn vào review **được tính** theo quy tắc đã chốt, không do client chọn.
- Giới hạn tần suất hiện có giữ nguyên; **không đặt giới hạn số lần review khi chưa có dữ liệu sử dụng thật** (ADR-012).

## 10. Bộ test cần có trước khi code
(đặc tả; viết thành test khi bắt đầu triển khai) review lần hai cùng mã không đổi điểm được tính; sửa nhẹ rồi review lại không đổi điều được tính; câu mới nhận mã mới; xóa câu thấp rồi thêm câu mới không tăng điểm bằng cách né; nhật ký không thể bị ghi đè; hàng cũ vẫn hiển thị và không vào tổng hợp mới; client không thể chọn review được tính; thiếu dữ liệu không thành 0; hai phiên bản gần giống nhau chỉ nhận nhắc nhở mềm.

## 11. Rủi ro
- W1 không thưởng cải thiện thật: có thể làm người dùng nản; cần nói rõ trên giao diện và vẫn cho thấy điểm luyện tập của bản sửa.
- I1 đổi luồng giao diện (Revise và New story) và cần SQL: chi phí cao cho một điểm AI mà đích đến (W4) có thể làm nó không còn dùng.
- Mọi phương án vẫn dựa trên một điểm là ước lượng của AI có độ biến thiên chưa đo (xem P5); quy tắc "chỉ một kết quả" không làm điểm đó chính xác hơn.

## 12. Quyết định cần chủ sản phẩm
| # | Câu hỏi | Đề xuất |
|---|---|---|
| D-S1a | Cách nhận diện cùng một câu chuyện | I1 (mã do server cấp) cộng nhắc nhở mềm |
| D-S1b | Điều được tính cho mỗi câu chuyện | W1 là tạm thời; W4 là đích đến |
| D-S1c | Giao diện "Revise this story" và "New story" | thiết kế riêng sau khi chốt D-S1a |
| D-S1d | Hàng cũ | mỗi hàng một câu chuyện, nhãn "Earlier AI estimate", loại khỏi tổng hợp mới |
| D-S1e | Thứ tự với G4 (tương lai của trigger và `candidate_trust_profiles`) | G4 trước |
