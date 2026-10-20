# Phản hồi từ lần tự thử sản phẩm (2026-10-11) và bằng chứng trong mã

Trạng thái: **chỉ ghi nhận và phân loại. Chưa sửa code, SQL hay cấu hình. Chưa commit.** Nguồn: phản hồi của chủ sản phẩm sau khi thử bản chạy cục bộ (`main` @ `2f11e29`, nối dự án thật).
Nhãn: **VERIFIED** (đọc mã hoặc tái hiện bằng chạy thử cục bộ) · **PROPOSAL** (đề xuất, chưa duyệt) · **UNKNOWN**.

## 1. Lỗi và sai lệch đã xác minh (xếp theo mức nghiêm trọng)

| # | Phát hiện | Bằng chứng | Mức |
|---|---|---|---|
| B1 | **Career Roadmap hiện mức lương tự đặt cứng, ghi như "giá trị thị trường hiện tại".** "Current market value ... mid-market" là chuỗi cố định theo thị trường (`SGD 6–9K/mo` hoặc `$60–90K/yr`), mục tiêu cũng cố định (`SGD 10–14K/mo`, `$90–130K/yr`), **không phụ thuộc vai trò, cấp độ hay dữ liệu nào** | `CareerRoadmap.jsx` dòng 98–99 và 176–195 [VERIFIED] | **Cao**: tuyên bố số liệu thị trường không có nguồn (trái ADR đã có: không hiển thị lương không có nguồn; Salary Prep đã gỡ bảng lương vì lý do này) |
| B2 | **Career Roadmap: bước 1 không thể hoàn thành.** `s1Done = hasResume && atsScore >= 75` với `atsScore` lấy từ `memory.scanHistory[0].score`, mà **không có nơi nào ghi `scanHistory`** | `CareerRoadmap.jsx:77-85`; kết quả truy vết Trust Score [VERIFIED] | Cao |
| B3 | **Weakness Radar, ô Resume luôn "Not enough evidence"** dù đã quét: nó đọc `scanHistory`/`scanResult`, không có nơi ghi | `WeaknessRadar.jsx:20`; `setScanResult` không có chỗ gọi [VERIFIED] | Cao |
| B4 | **Weakness Radar, ô Interview ghi "Answer at least 2 practice questions (you have 1)" nhưng đếm số phiên, không phải số câu.** Làm 1 phiên 2 câu vẫn thấy "you have 1" | `WeaknessRadar.jsx:26,103`: `count: sessions.length` [VERIFIED] | Trung bình (sai lời hoặc sai logic) |
| B5 | **"Fix in Builder →" chỉ mở màn Builder, không mang theo vấn đề nào.** `goToBuilder` chỉ đẩy hồ sơ đã phân tích rồi chuyển tab; trường `issue.builderStep` được mô tả trong prompt nhưng **không được dùng** để đưa người dùng đến đúng bước | `ATSBuilder.jsx:392,527` [VERIFIED] | Cao (UX gây bối rối đúng như phản hồi) |
| B6 | **Đọc tên và kỹ năng sai ở nhiều dạng CV hợp lệ.** Tái hiện bằng CV mẫu tổng hợp: tên bị báo "not found" khi dòng đầu là `Tên \| Chức danh`, khi có tên đệm kèm bằng cấp (`Jordan A. Lee, MBA`), khi dòng liên hệ đứng trước tên, khi có nhãn `Name:`; **kỹ năng** bị báo thiếu khi tiêu đề là `Technical Skills & Tools`; **mọi mục** bị báo thiếu khi văn bản dán mất xuống dòng (`Name`, `Experience`, `Skills` đều ✗, điểm 25 thay vì 85) | Chạy `computeDeterministicScore` trên CV mẫu và các biến thể [VERIFIED] | Cao: điểm do code tính sai vì **bộ đọc** sai |
| B7 | **Cùng một CV ra điểm khác nhau giữa dán chữ và tải PDF** (68 so với 71 trong thử của bạn; "5 vấn đề" so với "3"). Nguyên nhân khả dĩ: văn bản trích từ PDF khác văn bản dán (xuống dòng, ký tự). Chưa tái hiện được với CV của bạn | Suy luận từ B6 [INFERENCE] | Trung bình |
| B8 | **Skills Gap "Refresh analysis"** gọi lại mô hình mỗi lần bấm và **ghi đè** kết quả; mỗi lần có thể khác, đúng như bạn đã thử | `SkillsGap.jsx:72-123` [VERIFIED] | Cao (không nhất quán + tốn token) |
| B9 | **Verify Credentials chỉ kiểm tra liên kết, không kiểm tra tệp tải lên.** Chỉ chấp nhận Coursera, Udemy, Accredible (`credential.net`), edX, freeCodeCamp. Chứng chỉ HBS Online không nằm trong danh sách, và không có đường nào đọc PDF | `verify-cert/handler.js:15-22` [VERIFIED] | Trung bình (kỳ vọng của người dùng khác với tính năng; cần nói rõ trên giao diện) |

## 2. Trả lời các câu hỏi "dựa vào đâu, ai quyết định"

| Câu hỏi | Trả lời (có bằng chứng) |
|---|---|
| ATS Scanner/Builder: output dựa vào yếu tố nào, ai quyết định? | **Điểm ATS Readiness** do **code**: ba kiểm tra cố định (đủ mục: tên, email, kinh nghiệm/học vấn, kỹ năng; bullet có số liệu; ngày nhất quán). **Danh sách vấn đề và gợi ý sửa** do **AI** viết, có chốt chặn con số bịa. Vì vậy lỗi B6 là lỗi của code đọc CV, không phải của AI |
| Cover Letter: có ràng buộc không hay AI tự quyết? | Có **luật cứng trong prompt**: chỉ dùng sự kiện có trong CV, không bịa số, không nhận kinh nghiệm CV không có, lấy tên công ty từ JD, ký tên đúng, văn bản thuần; có giới hạn độ dài theo từng giọng; đầu ra phải đúng khuôn JSON và có `sellingPoints`, `missingInfo` để người dùng kiểm. **Không có chốt chặn bằng code** sau khi sinh để phát hiện sự kiện bịa. AI vẫn tự quyết nội dung cụ thể |
| Mock Interview: câu hỏi phụ thuộc gì, đánh giá thế nào? | Câu hỏi: AI sinh 5 câu từ **loại người phỏng vấn (4 persona)**, vai trò, và CV. Đánh giá: AI cho điểm 0–100 theo lời nhắc, code kẹp điểm; không nhất quán chưa đo (xem audit) |
| Career Roadmap: tiến trình có cập nhật thật không? | **Một phần.** Bước 2 (điểm phỏng vấn trung bình ≥75 và ≥5 câu chuyện STAR), bước 3 (có kết quả Skills Gap), 4 (điểm tổng ≥65), 5 (hồ sơ hiển thị) cập nhật theo dữ liệu. **Bước 1 không bao giờ xong** (B2). Phần "Salary trajectory" **không** dựa vào dữ liệu nào (B1) |
| AI Career Coach hoạt động thế nào? | Mỗi tin nhắn gửi **toàn bộ lịch sử trò chuyện** (tối đa 60 tin được lưu) cộng một khối bối cảnh dựng từ memory (vai trò mục tiêu, cấp độ, điểm quét gần nhất, số STAR, số phiên phỏng vấn, các JD gần đây), trần trả lời 600 token. Chi phí mỗi tin **tăng theo độ dài hội thoại** |

## 3. Ý tưởng sản phẩm của chủ sản phẩm, kèm đánh giá (PROPOSAL, chưa duyệt)

| Ý tưởng | Đánh giá |
|---|---|
| Mỗi gợi ý sửa kèm cách cải thiện cụ thể | Hợp lý và khả thi: dựa trên danh sách kiểm tra của code; AI chỉ viết lại **đúng mục chưa đạt** |
| Vòng sửa → tải → quét lại là điểm có thể tính phí | Hợp lý. Đề xuất: **quét lại bằng code miễn phí** (không tốn token), tính phí cho **viết lại bằng AI** và **xuất file**. Gắn với kế hoạch credits (C2 đến C6), cần quyết định giá và nội dung gói riêng |
| Thang "chưa nên nộp / nên nộp / xuất sắc" kèm ràng buộc, tiêu chí chấp nhận, guardrail để AI không liên tục tìm lỗi mới | **Ý hay, và nên tránh chữ "sẵn sàng nộp"**: nghiên cứu trước đó cho thấy không hệ ATS nào có điểm chuẩn, nên tuyên bố đó khó chứng minh. Đề xuất đặt tên trung tính theo **mức hoàn thiện của CV** (ví dụ "Cần bổ sung phần cơ bản / Đã vững / Đã trau chuốt") với **tiêu chí chấp nhận rõ ràng** từ chính các kiểm tra của code. **Guardrail:** danh sách việc cần sửa là **hữu hạn** và do code sinh; AI chỉ viết lại các mục trong danh sách đó, **không được thêm vấn đề mới**; khi mọi kiểm tra đạt thì trạng thái "xong" và AI ngừng đề xuất |
| "Edit & export resume": dùng hệ thống hay AI? | **Hệ thống (code) nên là mặc định**: xuất từ dữ liệu có cấu trúc do code đọc và người dùng đã xác nhận, với mẫu cố định. AI chỉ đề xuất câu chữ để người dùng chấp nhận. Hiện bước "tách dữ liệu cho mẫu PDF" do AI làm (đã nêu ở audit #6), nên rủi ro nội dung bị đổi. **Cần quyết định** |
| Cover letter: đổi giọng không cần tạo lại nhiều lần | Khả thi: lần đầu tạo "bản nháp cố định sự kiện" (đoạn văn có cấu trúc + `sellingPoints`), đổi giọng chỉ gửi **bản nháp** (không gửi lại CV và JD) nên rẻ hơn nhiều; hoặc lưu theo từng giọng đã tạo để không gọi lại. Cần đo chi phí thực bằng số liệu C1 |
| Cover letter: dẫn người dùng sang bước kế tiếp | Hợp lý: ví dụ chuẩn bị phỏng vấn cho đúng vai trò, quét CV với JD, lưu vào danh sách ứng tuyển |
| Hiring Manager Simulator: có cần 4 lựa chọn quy mô công ty, có đủ không? | **Không cần thiết** và **chưa đủ**: nó trộn hai chiều khác nhau (giai đoạn công ty: Seed, Series B, Fortune 500; và loại người phỏng vấn: Tech Lead). Không phủ công ty tư vấn, nhà nước, phi lợi nhuận, SME, y tế, v.v. Đề xuất: mặc định "hiring manager" chung, tùy chọn bối cảnh (ít lựa chọn, có thể bỏ qua) |
| Chế độ "coach" cho phiên luyện: thử lại, cải thiện từng bước, về sau có giới hạn thời gian và giọng nói | Rất hợp với thiết kế Tầng 0: mỗi lần trả lời lại, **kiểm tra cấu trúc bằng code (miễn phí, tức thì)** cho thấy mục nào đã đạt thêm; AI chỉ giải thích khi người dùng yêu cầu. Cần thiết kế riêng, dựa vào `DESIGN-mock-interview-tier0.md` |
| Study Modules nên đến sau Skills Gap, đang chung giao diện với Live Session | Hợp lý về luồng; cần đọc cấu trúc `InterviewCoach.jsx` để đề xuất tách |
| Nút Refresh nguy hiểm | Xem B8. Đề xuất: bỏ nút; chạy lại **chỉ khi đầu vào đổi** (vai trò, cấp độ, CV), có nhãn "dựa trên CV ngày ..." |
| AI Career Coach: giảm chi phí, tăng hiệu quả | (1) Giới hạn cửa sổ hội thoại (vài lượt gần nhất kèm bản tóm tắt cũ); (2) đưa bối cảnh cố định lên đầu để nhà cung cấp dùng bộ nhớ đệm prompt nếu hỗ trợ (chưa xác minh với các nhà cung cấp đang dùng); (3) câu hỏi sự kiện ("điểm của tôi là bao nhiêu?") **trả lời bằng code** không gọi AI; (4) gợi ý nhanh bằng nút thay vì gõ |
| STAR: thích kết quả, cần audit, thiếu bước tiếp theo | Đã có trong audit AI (điểm từng phần do AI); thêm bước tiếp theo vào danh sách việc |

## 4. Thứ tự đề xuất

1. **Sự trung thực và đúng sai** (nên làm trước): B1 (lương cứng), B2, B3, B4 (dữ liệu chết và lời sai), B5 (Fix in Builder), B6 (bộ đọc CV sai tên, kỹ năng, mất xuống dòng).
2. **Nhất quán và chi phí:** B8 (Refresh), B7 (khác biệt dán và PDF), AI Coach, Cover Letter đổi giọng.
3. **Tính năng lớn (cần thiết kế riêng):** mức hoàn thiện CV với tiêu chí, chế độ coach cho Mock Interview, điều hướng bước kế tiếp, Study Modules sau Skills Gap, xuất CV bằng code.

Mỗi mục là một PR nhỏ có test; không sửa gì cho đến khi chủ sản phẩm chọn thứ tự.
