# Phase 0 audit: Interview Coach / Mock Interview, ràng buộc phía server

Trạng thái: **báo cáo audit, chỉ đọc; quyết định đã duyệt ngày 2026-10-11 được ghi ở mục 11 và ADR-012. Chưa sửa code, chưa chạy SQL, chưa đổi cấu hình production.**
Viết ngày 2026-10-11 cho chủ sản phẩm (Ivy). Thuật ngữ kỹ thuật giữ tiếng Anh.

Nhãn bằng chứng (cùng cách dùng với `docs/architecture/PLATFORM_ARCHITECTURE.md`):
**[CODE]** đọc trong mã nguồn · **[TEST]** đã chạy · **[DB]** đọc từ catalog Supabase live ngày 2026-10-09 (do Ivy lấy, không phải tôi) · **[ESTIMATE]** ước tính, không phải số đo · **[UNKNOWN]** không xác định được từ repo.

---

## 1. Tóm tắt (đọc phần này nếu chỉ có 2 phút)

1. **Mock Interview hiện chỉ có 3 lời gọi AI đến được từ giao diện** và 1 lời gọi bổ trợ trong cùng khu vực (AI Memory). Hai trong số đó (chấm điểm từng câu, lưu phiên) đã đi qua Edge Function `score-interview` có chữ ký HMAC. Còn **tạo câu hỏi** và **AI Memory** đi qua Edge Function `ai`, là một proxy mở cho mọi người dùng đã đăng nhập.
2. **Không có "session" ở server.** Phiên chỉ là state trong React cho đến lúc bấm lưu. Bảng `mock_sessions` chỉ có 4 cột có nghĩa: `user_id`, `mode`, `questions_count`, `avg_score`. Nó không đủ cho khóa bình đẳng (idempotency), quota theo phiên hay theo dõi phiên đang chạy.
3. **Không có quota, không có entitlement, không có sổ cái chi phí trên `main`.** Giới hạn duy nhất là 20 request/phút/người **trên mỗi instance** của hàm (bộ nhớ trong, không chia sẻ giữa các instance) và trần token mỗi lần gọi. Code đo lường sử dụng (C1) có sẵn ở nhánh `feat/ai-usage-metering` nhưng **chưa merge**, và nó chỉ ghi log, không giữ chỗ (reservation).
4. **Hai lỗ hổng toàn vẹn dễ thấy nhất** (đọc từ code, chưa khai thác thử): người dùng có thể gọi `evaluate` nhiều lần cho cùng một câu hỏi rồi chọn điểm cao nhất để lưu; và câu hỏi không được ký nên người dùng có thể tự chọn câu dễ.
5. **Một xung đột với bản brief** cần Ivy quyết: điểm Interview của `mock_sessions` đang được trigger đưa vào `trust_score` (trọng số 35%) [DB]. Theo chính sách đã đọc, nhà tuyển dụng đã xác minh có thể đọc `candidate_trust_profiles`. Brief (mục 7.2) nói Practice không được tự động trở thành bằng chứng nhà tuyển dụng nhìn thấy. Hiện tại điều đó **chưa đúng** cho điểm trung bình phiên.
6. **Baseline test:** 134 test của 6 file liên quan đều qua; toàn bộ 1215 test (86 file) qua. Xem mục 9.

---

## 2. Baseline kho mã

| Mục | Giá trị |
|---|---|
| Nhánh đang checkout | `feat/landing-sections-v2` @ `c55cf0d` [CODE] |
| Quan hệ với `main` | `main` @ `1112b0b`; nhánh này đi trước 13 commit, **tất cả chỉ là file landing** |
| Chứng minh code server/AI không đổi so với `main` | `git diff main --stat -- supabase src/lib src/features/HiringManagerSim src/features/InterviewCoach src/features/STARBuilder` không in ra gì [CODE] |
| Working tree | `package-lock.json` đã sửa (không liên quan), file White Paper HTML chưa theo dõi (không liên quan) |
| CI | `.github/workflows/test.yml` [CODE] |
| Nhánh có thêm đo lường | `feat/ai-usage-metering` @ `550e618`: thêm `_shared/usage.js`, `usageReport.js`, sửa `ai/handler.js`, `ai/providers.js`, `score-interview/handler.js`, `score-star/handler.js`, `src/lib/ai.jsx`. **Chưa merge.** |

Vì phần server không khác `main`, các kết luận dưới đây áp dụng cho `main`. Nơi nào khác với `feat/ai-usage-metering` tôi sẽ nói rõ.

**Deploy production:** container Docker đổi tên để rollback (`docs/DEPLOY_MAIN_ROLLOUT.md`). Edge Function deploy bằng Supabase CLI. **Phiên bản hàm đang chạy trên production có giống repo không: [UNKNOWN]** (đã ghi trong `AI_ENTRYPOINT_INVENTORY.md`).

**Quy ước feature flag hiện có [CODE]:** chỉ có `VITE_SERVER_SCORING` (đọc lúc **build** trình duyệt, mặc định bật). Không có flag phía server, không có flag theo người dùng. Khi tắt flag này, trình duyệt quay về đường ghi trực tiếp, và đường đó **đã bị chặn bởi SQL "server-only-score-writes"** đã áp dụng, nên tắt flag sẽ làm lưu phiên thất bại, không phải quay về hành vi cũ.

---

## 3. Kiến trúc chuẩn và các điều bất biến áp dụng

Tài liệu gốc: `docs/architecture/PLATFORM_ARCHITECTURE.md` (bản nháp, hướng đã được chủ sản phẩm chấp nhận có điều kiện ngày 2026-10-09, **chưa phải baseline v1.0**), `docs/AI_ARCHITECTURE_CONTRACT.md`, ADR-001, 002, 003, 007, 011 trong `docs/DECISIONS.md`.

Các điều bất biến liên quan:
- ADR-001: trình duyệt không bao giờ gọi nhà cung cấp AI. (Đã đúng cho phạm vi này.)
- ADR-002: đăng nhập được kiểm tra qua auth server. (Đúng ở `ai` và `score-interview`: hàm `authenticate`.)
- ADR-003: không tin điểm gửi từ trình duyệt. (Đã thực hiện cho Mock Interview bằng receipt HMAC.)
- ADR-011: điểm người dùng thấy do code tính, model giải thích. **Mock Interview chưa theo ADR-011**: điểm từng câu do model đặt rồi bị kẹp (clamp) trong code. Brief này không đòi thay công thức điểm, nên tôi để nguyên, nhưng cần Ivy biết.

### Sổ xung đột (code hoặc tài liệu mâu thuẫn với brief)

| # | Mâu thuẫn | Ghi chú |
|---|---|---|
| X1 | `docs/architecture/plans/PLAN-interview-integrity-signals.md` đề xuất tín hiệu dán chữ, chuyển tab, và `integrity jsonb`. Brief này **cấm** chúng. | Cần đánh dấu kế hoạch đó là "superseded" một phần. Phần vẫn dùng được: hành động `start` (server phát và ký câu hỏi, đo `time_to_answer` bằng giờ server). Tôi chưa sửa tài liệu đó. |
| X2 | Trigger tính `trust_score` từ `mock_sessions.avg_score` [DB] vs brief 7.2 | Xem rủi ro R6. |
| X3 | Brief 4.2 nói giới hạn phải lấy từ "mô hình subscription/entitlement hiện có". | **Không có.** Không có code hoặc tài liệu DB nào về tier/entitlement/credits ([CODE]: tìm `tier|entitle|subscription|credits|quota` trong `src` chỉ ra các chuỗi không liên quan). `docs/product/PRICING-AND-CREDITS-STRATEGY.md` nói rõ chưa có hệ thống credit. Hạn mức phải đến từ một mở rộng được duyệt, gắn với kế hoạch credits (C2–C6). |
| X4 | `AI_ENTRYPOINT_INVENTORY.md` (đọc 2026-10-09) đã **lỗi thời**: nói "không có fallback", "không có metering". | Hiện `main` có fallback (`callWithFallback`); metering ở nhánh riêng. |

---

## 4. Danh mục điểm vào AI trong phạm vi

Phạm vi = mọi thứ có thể chạm tới từ module `simulate` (Interview Coach). `InterviewCoach.jsx` chỉ là vỏ có tab, nó render `HiringManagerSim`, `STARBuilder`, `WeaknessRadar`, `ReadinessScore`, `MemoryDashboard` [CODE `InterviewCoach.jsx:1-7`]. Đã tìm lời gọi AI trong từng file đó.

| # | Điểm vào | Kích hoạt | Đường đi | Xác thực | Mô hình / nhà cung cấp | Giới hạn token | Timeout | Retry / fallback | Ghi dữ liệu | Chấm điểm | Chi phí |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `HiringManagerSim.jsx:52` tạo 5 câu hỏi | bấm persona | trình duyệt → `callLLM` → `ai` | JWT, kiểm tra qua auth server | do server chọn (secret), client không chọn được | `maxTokens` 2500 gửi từ client, server cắt ở 8192; có thể gửi cả PDF base64 (≤10 MB) | client 100 s; mỗi nhà cung cấp 80 s | client thử lại 1 lần (429, ≥500, timeout, mạng); server thử lần lượt các nhà cung cấp có key | không (trong state) | không | không có bản ghi |
| A2 | `HiringManagerSim.jsx:71` chấm 1 câu | bấm "Get AI Feedback" | `serverScoring.evaluateAnswerOnServer` → `score-interview` `evaluate` | như trên | như trên (qua `callWithFallback`) | 1800 | client 100 s, nhà cung cấp 80 s | server fallback; **client không retry** | không (trả receipt ký) | model chấm, code kẹp 0–100 và tính verdict | không có bản ghi (có trên nhánh metering: chỉ log) |
| A3 | `HiringManagerSim.jsx:98` lưu phiên | cuối phiên | `saveInterviewOnServer` → `score-interview` `save` | như trên | không gọi AI | – | client 100 s | – | ghi `mock_sessions` bằng service role | trung bình tính trong code từ điểm đã ký | – |
| A4 | `HiringManagerSim.jsx:74` (đường cũ) | chỉ khi `VITE_SERVER_SCORING=false` | `callLLM` → `ai` | – | – | 1800 | – | – | `mock_sessions` do trình duyệt ghi (đã bị chặn bởi SQL đã áp dụng) | – | **Còn sống trong code nhưng ghi sẽ thất bại.** |
| A5 | `STARBuilder.jsx:49,53,78` | chấm / lưu STAR | `score-star` (đường mới) hoặc `callLLM` (đường cũ) | như trên | như trên | 2500 | như trên | như trên | `star_stories` | model + code | – |
| A6 | `MemoryDashboard.jsx:59` kế hoạch cá nhân hóa | mở tab AI Memory | `callLLM` → `ai` | như trên | như trên | 1500 | như trên | như trên | state | **model tự đặt `overallProgress`** | – |
| A7 | `WeaknessRadar`, `ReadinessScore` | – | **không có** lời gọi AI hay `fetch` [CODE: grep] | – | – | – | – | – | – | – | – |

**Lối đi vòng (bypass) chính:** `ai` là proxy chung. Bất kỳ người dùng đăng nhập nào có thể gọi `functions/v1/ai` trực tiếp với prompt tự chọn (≤200 000 ký tự, ≤20 tin nhắn, ≤8192 token đầu ra, PDF ≤10 MB), **không qua bất kỳ cổng nào của Mock Interview**. Bất kỳ quota nào chỉ đặt trong `score-interview` sẽ không bảo vệ chi phí cho tới khi `ai` cũng chịu cùng sổ cái.

**Tiêu chí chấp nhận audit:** mọi lời gọi nhà cung cấp AI đến được trong phạm vi đã được tính (A1–A6; A7 không có). Chưa xác minh được: phiên bản hàm đang chạy ở production (**[UNKNOWN]**), và prompt cụ thể của `buildMemoryContext` gửi những dữ liệu cá nhân nào (đã ghi UNKNOWN trong tài liệu trước, tôi không đọc lại ở đây).

---

## 5. Cơ sở dữ liệu, quota, entitlement hiện có

- Bảng liên quan: `mock_sessions` (ghi bằng service role từ `score-interview`; trình duyệt chỉ còn SELECT/DELETE) [DB 2026-10-09, `docs/database/README.md`]. Các cột đã biết từ code ghi: `user_id`, `mode`, `questions_count`, `avg_score` (+ `id`, `created_at` có mặt vì code đọc chúng). **Danh sách cột đầy đủ, khóa ngoại, chỉ mục, chính sách RLS đầy đủ: [UNKNOWN] từ repo** (repo không có migration; bằng chứng DB trong `docs/architecture/EVIDENCE_RESULTS_2026-10-09.md` là ảnh chụp một thời điểm).
- Sổ cái / usage / entitlement: **không tồn tại** [CODE, X3]. Không có chỗ nào để "mở rộng an toàn", nên đề xuất tạo mới sẽ khớp yêu cầu "đừng tạo sổ cái thứ hai".
- Giới hạn có sẵn:
  - `ai`: 20 yêu cầu/phút/người/**instance**, bộ nhớ trong [CODE `handler.js:createRateLimiter`]. Số instance chạy thật: [UNKNOWN], nên giới hạn toàn cục thật sự: [UNKNOWN].
  - `score-interview`: cũng 20/phút/người/instance; 10 phiên đã lưu mỗi 24 giờ, kiểm tra bằng đếm hàng rồi mới chèn (**không nguyên tử**: hai lần lưu đồng thời cùng thấy 9 có thể cùng qua).
- Cập nhật quota đồng thời: **không có cập nhật quota nào**, nên chưa có tranh chấp, nhưng cũng chưa có bất biến để kiểm thử.
- Dữ liệu lịch sử có thể chuyển không mất nghĩa: `mock_sessions` hiện có giữ nguyên; sổ cái mới sẽ bắt đầu trống (không có số liệu lịch sử về chi phí).

---

## 6. Mô hình chi phí và timeout

**Đã xác minh [CODE]:**
- Mỗi lần gọi nhà cung cấp có `AbortController` 80 giây; lỗi mạng/timeout được coi là `status: 0` và **cho phép fallback** (`shouldFallBack`).
- Fallback chạy **tuần tự**. Không có hạn chót tổng. Trường hợp xấu nhất về thời gian = số nhà cung cấp có key × 80 giây. Client hủy sau 100 giây, nhưng việc client hủy **không dừng** hàm Edge: nó vẫn có thể gọi nhà cung cấp kế tiếp. Có tối đa 7 nhà cung cấp trong chuỗi (`DEFAULT_MODELS`); số có key ở production: [UNKNOWN].
- Hủy `fetch` đóng kết nối nhưng **không chứng minh nhà cung cấp ngừng xử lý hay không tính tiền**: [UNKNOWN] theo từng nhà cung cấp.
- Trần đầu ra mỗi lần chấm: 1800 token. Đầu vào mỗi lần chấm: câu trả lời ≤3000 ký tự, câu hỏi ≤500, CV ≤6000, cộng phần prompt cố định. Đây là **giới hạn kích thước**, không phải số tiền.
- Số liệu sử dụng nhà cung cấp trả về: có đọc được ở nhánh `feat/ai-usage-metering` (`extractUsage`), **không có trên `main`**. `PRICE_TABLE` ở nhánh đó **cố tình để trống**; không có đơn giá thật trong repo.

**[ESTIMATE] chưa dùng được làm quyết định:** chi phí tối đa của một lần chấm = (đầu vào + 1800 token đầu ra) × đơn giá × số lần thử (tối đa số nhà cung cấp có key). Đơn giá và số thử đều chưa biết, nên **tôi không đưa ra con số tiền hay hạn mức mặc định**, đúng như brief yêu cầu.

### So sánh hai cách xử lý timeout (theo mục 5.3 của brief)

| | Cách A: nhả tất cả khi timeout ứng dụng | Cách B: nhả "chỗ chạy đồng thời" khi an toàn, giữ riêng "dự trữ chi phí" tới khi biết kết quả |
|---|---|---|
| Đúng đắn | Có thể sai: nhà cung cấp vẫn xử lý và tính tiền sau khi ta đã nhả | Đúng: tiền chỉ được nhả khi biết đã dùng bao nhiêu hoặc đã hết hạn chặn trên |
| Trải nghiệm | Người dùng thử lại ngay | Người dùng thử lại ngay (chỗ chạy được nhả), vẫn có thể bị từ chối nếu dự trữ chi phí đang đầy |
| Sức chứa đồng thời | Tối đa | Gần tối đa (hai tài nguyên tách rời) |
| Chi phí xấu nhất | **Không bị chặn**: nhiều lần thử lại có thể cùng đang chạy ở nhà cung cấp | **Bị chặn** = (số dự trữ chưa giải quyết × chi phí tối đa mỗi lần) |
| Độ phức tạp | Thấp | Trung bình: cần trạng thái "kết quả chưa rõ" và bước đối soát |

**Khuyến nghị: Cách B.** Nhả ngay chỗ chạy đồng thời **chỉ khi** server biết chắc nó đã ngừng giữ yêu cầu (hạn chót cứng phía server), còn dự trữ chi phí được giữ tới khi nhận được usage hoặc hết hạn chặn trên. Cách A **không được làm** nếu nó cho phép vượt ngân sách đã duyệt (đúng điều brief cảnh báo). Cần Ivy duyệt trước khi cài. Trước đó cần một hạn chót tổng cho chuỗi fallback (hiện không có).

---

## 7. Lỗ hổng bảo mật, đồng thời và toàn vẹn (xếp theo mức độ)

Mức độ là tạm thời. Chưa khai thác thử cái nào; mọi mục là "đọc từ code cho thấy cho phép".

| Id | Mức | Phát hiện | Bằng chứng |
|---|---|---|---|
| R1 | Cao | `ai` là proxy mở cho mọi người dùng đăng nhập; không có hạn mức theo ngày/ngân sách, chỉ có 20/phút/instance. Quota đặt ở `score-interview` sẽ bị đi vòng. | `ai/handler.js` `validate`, `LIMITS`, `createRateLimiter` |
| R2 | Cao | `evaluate` không gắn với phiên, không có khóa bình đẳng, không giới hạn số lần cho cùng câu hỏi. Người dùng có thể chấm lại nhiều lần và chọn điểm tốt nhất, và mỗi lần là một lời gọi AI tính tiền. | `score-interview/handler.js` `evaluate` (không trạng thái); `save` chỉ nhận danh sách receipt |
| R3 | Trung bình | Câu hỏi do model tạo ở `ai`, **không được ký**; người dùng có thể tự chọn câu dễ rồi vẫn nhận receipt hợp lệ. Đã được ghi nhận trong đầu file `score-interview/handler.js`. | `handler.js` đầu file |
| R4 | Trung bình | Cùng một câu trả lời có thể được `evaluate` lại (ts mới, chữ ký mới) và lưu ở nhiều phiên khác nhau; chỉ bị chặn bởi 10 phiên/24 giờ, và phép đếm này không nguyên tử. | `save`: `seen` chỉ trong một yêu cầu; `countLastDay` rồi `insert` |
| R5 | Trung bình | Timeout: chuỗi fallback không có hạn chót tổng, client hủy không dừng server; chi phí cho yêu cầu đã bị client bỏ là không biết. | `callWithFallback`, `serverScoring.js` `TIMEOUT_MS` |
| R6 | Trung bình | `mock_sessions.avg_score` → `trust_score` (35%) → `candidate_trust_profiles`. Theo chính sách đọc được, nhà tuyển dụng đã xác minh có thể đọc bảng này. Màn consent đã ghi "Not shared: ... practice scores". Chính sách "chỉ đọc khi có consent" mới **đề xuất, chưa áp dụng**. | `EVIDENCE_RESULTS_2026-10-09.md` mục 3 và F-4; `docs/database/README.md` "Proposed, NOT applied" |
| R7 | Thấp–Trung bình | Bộ giới hạn tốc độ nằm trong bộ nhớ từng instance. | `createRateLimiter` |
| R8 | Thấp | Đường cũ A4 và A5 vẫn còn trong code với cờ build; khi cờ tắt nó hỏng ngầm thay vì quay lại hành vi cũ. | `HiringManagerSim.jsx:74`, SQL đã áp dụng |
| R9 | Thấp | `MemoryDashboard` để model đặt `overallProgress`, nằm trong khu vực Interview Coach. | `MemoryDashboard.jsx:59`; đã nằm trong danh mục class A |
| R10 | Thông tin | Lời gọi tạo câu hỏi có thể gửi cả PDF; đây là lời gọi tốn nhất trong luồng. | `HiringManagerSim.jsx:52` |

Lưu ý quyền riêng tư: log hiện chỉ ghi tên nhà cung cấp, không ghi nội dung (`console.log` trong `callWithFallback` và `console.error` ở các hàm). Chưa thấy chỗ nào ghi CV hay câu trả lời vào log [CODE, đã đọc các hàm trên]; chưa rà toàn bộ phần còn lại.

---

## 8. Rủi ro hồi quy

- `HiringManagerSim.test.jsx` và `sessionRoundTrip.test.js` ghim hành vi hiện tại của luồng 5 câu: thêm bước `start` sẽ làm đổi thứ tự lời gọi, cần cập nhật có chủ đích.
- Bản sao logic chấm điểm giữa `src/features/HiringManagerSim/interview.js` và `supabase/functions/_shared/interviewScoring.js` (hằng số `MIN/MAX_ANSWER_CHARS` đã trùng): đổi một nơi mà quên nơi kia sẽ làm lệch giới hạn.
- Trigger `recompute_trust_score` chạy sau INSERT/UPDATE trên `mock_sessions`; chưa có trigger DELETE (đã ghi ở bằng chứng DB, đề xuất SQL "recompute-score-on-delete" chưa áp dụng). Mọi thay đổi cách ghi `mock_sessions` phải giữ nguyên hành vi này.
- Hiện không có ghi nhận nào về người dùng đang trong phiên khi triển khai: thay đổi hợp đồng `evaluate` mà không tương thích ngược sẽ làm hỏng phiên đang mở (receipt TTL là 2 giờ).

---

## 9. Baseline test (đã chạy, không phỏng đoán)

| Lệnh | Kết quả |
|---|---|
| `npx vitest run supabase/functions/score-interview supabase/functions/ai src/features/HiringManagerSim src/lib/serverScoring` | 6 file, **134 test qua** |
| `npm test` (toàn bộ, trên `feat/landing-sections-v2` @ `c55cf0d`) | 86 file, **1215 qua**, 1 expected-fail, 4 skipped |
| `npm test` (toàn bộ, trên `main` @ `1112b0b` cộng các file tài liệu của PR 1, chạy 2026-10-11) | 83 file, **1128 qua**, 1 expected-fail, 4 skipped. Chênh lệch với dòng trên chỉ do các test landing mới nằm ở nhánh landing. |

Hạn chế: không có test nào gọi nhà cung cấp AI thật, nên chất lượng câu trả lời không được đo. Không có test đồng thời thật (nhiều yêu cầu cùng lúc tới cùng một hạn mức), vì chưa có hạn mức nào.

---

## 10. Kiến trúc đề xuất (nhỏ nhất đủ dùng)

Nguyên tắc: tận dụng ranh giới hiện có (`score-interview`, `_shared/receipt.js`, `callWithFallback`), chỉ thêm cái chưa có.

1. **Hành động `start` trong `score-interview`.** Sinh câu hỏi bằng `callWithFallback`, ký (user, thời điểm, danh sách câu hỏi, phiên bản chính sách), trả về `session_id`. Giải quyết R3, đo thời gian bằng giờ server (chỉ để cung cấp ngữ cảnh, không tạo suy diễn gian lận), và là điểm neo cho idempotency.
2. **Bảng phiên và sổ cái dùng chung**, một chỗ cho cả Mock Interview lẫn các tính năng AI khác sau này (khớp kế hoạch credits C2). Tối thiểu: phiên (id, user, trạng thái, phiên bản chính sách, thời hạn), yêu cầu AI (id, khóa bình đẳng, phiên, trạng thái, token ước tính, token thực), và số dư/dự trữ. **Chưa đề xuất SQL cụ thể**; theo brief mục 9 cần một đề xuất riêng sau khi Ivy duyệt hướng.
3. **Cổng thực thi AI** là hàm chung gọi `callWithFallback` với: danh sách model cho phép, trần token, hạn chót tổng, chính sách retry, giữ chỗ nguyên tử trước khi gọi, ghi nhận sau khi gọi. `ai` và `score-interview` đều đi qua cổng này, để đóng R1.
4. **Máy trạng thái yêu cầu** map trực tiếp từ brief mục 6.3: `rejected`, `reserved`, `started`, `completed`, `failed`, `cancelled`, `unknown_pending_reconciliation`.
5. **Giữ nguyên** công thức điểm hiện tại, Trust Score, và Practice linh hoạt (không hạn chót cứng, không tín hiệu dán/chuyển tab).

**Đề xuất chuỗi PR (đã sắp lại theo phát hiện; cần duyệt):**
- **PR 1:** tài liệu audit này + đánh dấu `PLAN-interview-integrity-signals.md` là bị thay thế một phần. Chỉ docs.
- **PR 2 (không SQL):** hạn chót tổng cho fallback và merge đo lường C1 (chỉ log) để có số đo thật. Hai thứ này không cần thay đổi dữ liệu và cho dữ liệu chi phí thật trước khi chọn hạn mức.
- **PR 3 (cần SQL được duyệt):** bảng phiên + sổ cái + `start` + idempotency.
- **PR 4:** cổng thực thi chung; `ai` đi qua cổng.
- **PR 5:** quota người dùng/phiên/đồng thời + đối soát timeout (Cách B).
- **PR 6:** quan sát, rollout bằng cờ.

**Rollback:** bất kỳ cờ nào cũng phải giữ cổng phía server bật và chỉ tắt giao diện mới (brief mục 13). Hiện cờ duy nhất là `VITE_SERVER_SCORING` ở build trình duyệt, **không đủ**; cần một cờ phía server. Chưa thiết kế chi tiết.

---

## 11. Quyết định của chủ sản phẩm (2026-10-11) và câu hỏi còn mở

### Đã quyết

| # | Quyết định | Ghi chú thực thi |
|---|---|---|
| 1 | **Duyệt chuỗi PR** ở mục 10. PR 1 chỉ là tài liệu. PR 2 = hạn chót tổng cho fallback + merge đo lường C1, **chưa đặt hạn mức tiền nào** trước khi có số đo thật. | PR 2 vẫn cần brief riêng và duyệt riêng trước khi làm. |
| 2 | **Timeout: Cách B** (nhả chỗ chạy đồng thời khi server biết chắc đã ngừng giữ yêu cầu; giữ dự trữ chi phí riêng tới khi đối soát). | Chỉ áp dụng ở PR 5. Chưa có gì được cài. Cần hạn chót tổng ở PR 2 trước. |
| 3 | **(a) + (c)** cho xung đột trust_score / Practice. | Xem diễn giải bên dưới. |

### Diễn giải quyết định 3 (đã kiểm tra lại trong code ngày 2026-10-11)

- **(a) Chỉ sửa câu chữ consent khi nội dung đã được xác minh chính xác.** Kết quả kiểm tra: câu "Not shared: ... practice scores" (`consentCopy.js:9`, `consent.js:13`) mô tả **đường đọc mới** `employer_view_candidates`, nơi cột trả về chỉ gồm profile và (tuỳ chọn) khoảng lương (`PART_FIELDS`, `consent.js:8-11`). Câu đó **đúng cho đường mới** và **sai nếu đặt cạnh đường cũ**: Employer Portal vẫn đọc trực tiếp `candidate_trust_profiles` sắp theo `trust_score` (`EmployerPortal.jsx:764`, theo `CONSENT-FLOW-DESIGN.md:21`), mà `trust_score` có 35% từ điểm phỏng vấn. Vì vậy **không sửa câu chữ ngay, và không được phát hành màn consent như một lời bảo đảm** cho tới khi (c) hoàn tất. Yêu cầu giữ lại: không viết hay hàm ý rằng điểm luyện tập "không còn ảnh hưởng" `trust_score` chừng nào trigger chưa đổi.
- **(c) Chờ cơ chế chỉ-đọc-khi-có-consent được triển khai và kiểm thử** (SQL `2026-10-09-consent-only-recruiter-access.sql` + PR D của `CONSENT-FLOW-DESIGN.md`, Employer Portal fail-closed, không gọi `candidate_trust_profiles` trực tiếp). Chỉ sau khi nó chạy và được kiểm chứng mới được tuyên bố quyền truy cập đã được kiểm soát.
- **Không làm:** (b) đổi trigger đưa Practice ra khỏi `trust_score`. Cần SQL, cần quyết định chính sách riêng. Ghi lại như một lựa chọn còn mở nếu sau này chủ sản phẩm muốn Practice không bao giờ ảnh hưởng điểm tuyển dụng.

### Còn mở (chưa quyết, không có giá trị mặc định)

3b. Hạn mức số cho người dùng / phiên / đồng thời. **Chờ dữ liệu C1** (PR 2).
4. Hạn mức gắn vào hệ thống credits (C2–C6) hay riêng cho Interview. Đề xuất đọc cùng quyết định 3b khi có số đo.
6. Đánh dấu `PLAN-interview-integrity-signals.md` là bị thay thế một phần (bỏ dán/chuyển tab, giữ `start` và thời gian giờ server). Đưa vào PR 1 nếu chủ sản phẩm đồng ý.
7. Hẹn giờ và ghi âm: **giai đoạn A** (giao diện, hẹn giờ chỉ mang tính hướng dẫn, nhập text, prototype ghi âm chưa nối backend) có thể chốt song song, không sửa code production. **Giai đoạn B** (ghi âm thật, chuyển giọng nói thành văn bản, AI feedback) chỉ sau khi phiên và quota ổn định; nhà cung cấp chuyển giọng nói, chi phí, giới hạn thời lượng và chính sách lưu âm thanh **chưa được xác định, không được tự chọn**.
8. Cho phép lưu nhiều hơn một phiên cho cùng một bộ câu hỏi không (ảnh hưởng thiết kế idempotency).

## 12. Phạm vi PR đầu tiên

PR 1 chỉ gồm tài liệu, xem `docs/audits/PR1-BRIEF-interview-constraints-docs.md`. Không có thay đổi mã, SQL hay cấu hình.
