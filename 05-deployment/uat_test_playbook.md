# 🧪 KỊCH BẢN KIỂM THỬ NGHIỆM THU NGƯỜI DÙNG (UAT TEST PLAYBOOK)

**Dự án:** Smart Meeting Room Booking System  
**Phiên bản kiểm thử:** v1.4 Hardened (BRD v1.4)  
**Biên soạn bởi:** `@QA_Agent`  
**Ngày phát hành:** 2026-10-07  
**Đối tượng thực hiện:** Đội ngũ Nghiệm thu UAT (Product Owner, Business Analyst, QA Lead, Receptionist, Shift Supervisor, Corporate Representative).

---

## 1. Mục tiêu & Môi trường Kiểm thử

### 1.1. Mục tiêu kiểm thử
Xác nhận hệ thống đáp ứng 100% các tiêu chí chấp nhận (Acceptance Criteria) trong môi trường phân tán thực tế trước khi Go-Live, đặc biệt tập trung vào các phòng tuyến kỹ thuật quan trọng của BRD v1.4:
1. Cơ chế giữ chỗ 10 phút (TTL 600s) và bù trừ lệch đồng hồ (Clock Skew Compensation).
2. Tự động hoàn tiền khi nhận Webhook thanh toán trễ (Late Webhook Saga Auto-Refund).
3. Chặn đứng gian lận tiền mặt bằng Quy tắc 2 người duyệt OTP (Two-Man Rule).
4. Kiểm soát trần công nợ doanh nghiệp (Credit Limit Validation - HTTP 422).
5. Chính sách hủy phòng phân tầng và chống lạm dụng hạn mức 2 lần/tháng.
6. Chống trừ tiền trùng lặp ví thành viên (Anti Double-Spending with Pessimistic Lock).

### 1.2. Thông tin Môi trường UAT ($0 Cloud Stack)
* **Frontend Web Admin:** `https://smart-booking-admin-uat.vercel.app`
* **Backend API Docs:** `https://smart-booking-api-uat.onrender.com/api/docs`
* **Local Fallback:** `http://localhost:3001` (Docker Compose)
* **Danh sách Tài khoản Kiểm thử (Test Accounts):**

| Vai trò (Role) | Tên đăng nhập (Username) | Mật khẩu (Password) | Dữ liệu khởi tạo (Initial State) |
|---|---|---|---|
| **Lễ tân (Receptionist)** | `reception_uat@smartbooking.vn` | `Pass@123456` | Quyền tạo đơn tiền mặt, xem lịch lưới, gửi yêu cầu hoàn tiền |
| **Quản lý ca (Supervisor)** | `supervisor_uat@smartbooking.vn` | `Sup@123456` | Nắm giữ thiết bị nhận OTP xác thực hoàn tiền mặt |
| **Hội viên (Member)** | `member_vip@smartbooking.vn` | `Mem@123456` | Số dư ví: `5,000,000 VND`, Đã hủy phòng trong tháng: `1 lần` |
| **Hội viên Abuse Test** | `member_abuser@smartbooking.vn` | `Mem@123456` | Số dư ví: `10,000,000 VND`, Đã hủy phòng trong tháng: `2 lần` (Chạm trần) |
| **Công ty (Corporate Corp)** | `corp_fpt@smartbooking.vn` | `Corp@123456` | Hạn mức tín dụng: `20,000,000 VND`, Nợ hiện tại: `18,500,000 VND` |

---

## 2. Kịch bản Kiểm thử Happy Path (Luồng Tiêu chuẩn)

### 📌 TC-UAT-01: Đặt phòng Trực tuyến qua Cổng VNPAY Sandbox (Online Hold 10m)
* **Người thực hiện:** Khách vãng lai / Hội viên trên Mobile PWA.
* **Tiền điều kiện:** Phòng họp `Room 101` trống khung giờ `09:00 - 11:00` ngày mai.
* **Các bước thực hiện:**
  1. Truy cập ứng dụng Mobile PWA, tìm kiếm phòng `Room 101`.
  2. Chọn khung giờ `09:00 - 11:00` (Giá: 400,000 VND). Nhấn **"Tiếp tục đặt chỗ"**.
  3. Tại màn hình Checkout, quan sát Widget đếm ngược thời gian.
  4. Chọn phương thức thanh toán **"Cổng VNPAY / MoMo"**. Nhấn **"Thanh toán ngay"**.
  5. Hệ thống chuyển hướng sang VNPAY Sandbox: Nhập thông tin thẻ test (Ngân hàng: NCB, Số thẻ: `9704198526191432198`, Tên: `NGUYEN VAN A`, Ngày: `07/15`, OTP: `123456`).
  6. Hoàn tất thanh toán và quay về màn hình ứng dụng.
* **Kết quả mong đợi:**
  * Đồng hồ đếm ngược bắt đầu chính xác từ `10:00` (600 giây) và giảm đều.
  * Trong thời gian 10 phút, người khác truy cập sẽ thấy slot chuyển màu cam `Đang giữ chỗ` và không thể đặt.
  * Sau khi VNPAY xác nhận, đơn chuyển ngay sang `CONFIRMED_PAID`.
  * Mã QR Check-in được sinh ra hợp lệ và slot trên Web Admin chuyển sang màu xanh lá.

---

### 📌 TC-UAT-02: Đặt phòng bằng Ví Hội viên (Instant Wallet Deduct)
* **Người thực hiện:** Hội viên `member_vip@smartbooking.vn`.
* **Tiền điều kiện:** Ví có `5,000,000 VND`. Slot `14:00 - 15:00` phòng `Room 201` đang trống (Giá: 250,000 VND).
* **Các bước thực hiện:**
  1. Đăng nhập tài khoản hội viên trên Mobile PWA.
  2. Chọn phòng `Room 201`, chọn slot `14:00 - 15:00`.
  3. Tại Checkout, chọn phương thức **"Ví thành viên (Số dư: 5,000,000 VND)"**.
  4. Nhấn **"Xác nhận thanh toán ví"**.
* **Kết quả mong đợi:**
  * Hệ thống trừ ngay `250,000 VND`, số dư hiển thị mới là `4,750,000 VND`.
  * Không qua bước giữ chỗ tạm thời; đơn hàng chuyển thẳng sang `CONFIRMED_PAID`.
  * Sinh mã đặt chỗ và hiển thị mã QR Check-in tức thì.

---

### 📌 TC-UAT-03: Lễ tân Đặt phòng Khách Vãng lai Trả Tiền Mặt (Walk-in Cash)
* **Người thực hiện:** Lễ tân `reception_uat@smartbooking.vn` trên Web Admin.
* **Tiền điều kiện:** Phòng `VIP Boardroom` trống lúc `10:00 - 12:00`.
* **Các bước thực hiện:**
  1. Lễ tân truy cập trang `https://smart-booking-admin-uat.vercel.app/cash-booking`.
  2. Chọn phòng `VIP Boardroom`, chọn thời gian `10:00 - 12:00`.
  3. Nhập thông tin khách: Họ tên `Trần Văn B`, Số điện thoại `0912345678`.
  4. Thu tiền mặt `600,000 VND` từ khách, nhấn **"Xác nhận đã thu tiền & Tạo đơn"**.
* **Kết quả mong đợi:**
  * Đơn hàng được tạo thành công với trạng thái `CONFIRMED_PAID` (`payment_method: CASH_ON_ARRIVAL`).
  * Modal in phiếu thu tiền mặt (`CASH_IN_COLLECT`) tự động xuất hiện.
  * Lịch master grid cập nhật tức thì, khóa slot với màu xanh lá cây.
  * Sổ quỹ tiền mặt ghi nhận tăng `+600,000 VND`.

---

### 📌 TC-UAT-04: Đặt phòng Ghi Nợ Doanh Nghiệp trong Hạn mức (Postpaid In-Limit)
* **Người thực hiện:** Lễ tân hoặc Đại diện công ty `corp_fpt@smartbooking.vn`.
* **Tiền điều kiện:** Hạn mức: `20,000,000 VND`, Nợ hiện tại: `18,500,000 VND` (Còn khả dụng: `1,500,000 VND`).
* **Các bước thực hiện:**
  1. Chọn phòng họp với tổng tiền đơn là `1,000,000 VND`.
  2. Chọn phương thức **"Công nợ doanh nghiệp (Postpaid Debt)"**.
  3. Nhập mã doanh nghiệp `CORP_FPT`.
  4. Nhấn **"Xác nhận ghi nợ"**.
* **Kết quả mong đợi:**
  * Do `18,500,000 + 1,000,000 = 19,500,000 <= 20,000,000 VND`, đơn được duyệt thành công.
  * Trạng thái đơn: `CONFIRMED_DEBT`.
  * Nợ hiện tại của công ty tự động cập nhật lên `19,500,000 VND`.

---

## 3. Kịch bản Kiểm thử Edge Cases & Rào cản Bảo mật (BRD v1.4)

### 📌 TC-UAT-05: Quá hạn Giữ chỗ 10 Phút & Saga Auto-Refund Khi Nhận Webhook Trễ
* **Mục tiêu:** Kiểm tra cơ chế giải phóng phòng khi hết TTL và tự động hoàn tiền nếu khách thanh toán sau khi phòng đã bị giải phóng.
* **Các bước thực hiện:**
  1. Tester A giữ chỗ phòng `Room 102` lúc 09:00: Widget đếm ngược `10:00` bắt đầu chạy.
  2. Tester A cố tình **KHÔNG thanh toán** và chờ hết 10 phút (600 giây).
  3. **Kiểm tra 1:** Đồng hồ về `00:00`, popup thông báo: *"Thời gian giữ chỗ đã hết, phòng đã được giải phóng."*
  4. Tester B vào trang tìm kiếm: Phòng `Room 102` đã chuyển lại màu trắng `AVAILABLE` và Tester B thực hiện đặt thành công phòng này.
  5. Kỹ sư QA giả lập gửi Webhook thanh toán thành công trễ của Tester A từ VNPAY qua cURL:
     ```bash
     curl -X POST https://smart-booking-api-uat.onrender.com/api/v1/payments/webhook/vnpay \
       -H "Content-Type: application/json" \
       -d '{"booking_id": "booking-tester-a", "vnp_ResponseCode": "00", "vnp_Amount": 40000000}'
     ```
* **Kết quả mong đợi:**
  * Backend phát hiện slot của Tester A đã bị Tester B chiếm hữu.
  * **SAGA COMPENSATION KÍCH HOẠT:** Đơn hàng của Tester A chuyển sang `CANCELLED_AUTO_REFUNDED`.
  * Không xảy ra tình trạng Double-Booking; phòng của Tester B vẫn an toàn.
  * Bản ghi hoàn tiền 100% được lưu vào cơ sở dữ liệu và thông báo hoàn tiền được đẩy ra hàng đợi Outbox.

---

### 📌 TC-UAT-06: Hoàn Tiền Mặt Quy Tắc 2 Người Duyệt OTP (Two-Man Rule)
* **Mục tiêu:** Ngăn chặn tuyệt đối Lễ tân tự ý hoàn tiền mặt để chiếm dụng quỹ.
* **Các bước thực hiện:**
  1. Khách hàng mang phiếu thu yêu cầu hủy đơn tiền mặt `600,000 VND` tại quầy.
  2. Lễ tân mở Web Admin, tìm đơn hàng và nhấn **"Yêu cầu Hoàn tiền mặt"**.
  3. Modal [RefundModal.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/components/RefundModal.tsx) xuất hiện: Nút xác nhận hoàn tiền bị **VÔ HIỆU HÓA**.
  4. Lễ tân nhấn **"Gửi yêu cầu OTP Quản lý"**.
  5. Quản lý ca trực nhận tin nhắn OTP 6 số (ví dụ: `849201`).
  6. **Thử nghiệm sai:** Lễ tân cố tình nhập mã bừa `111111` và nhấn Hoàn tiền -> Hệ thống báo lỗi *"Mã OTP Quản lý không chính xác hoặc đã hết hạn"*, không cho hoàn tiền.
  7. **Thử nghiệm đúng:** Nhập chính xác mã `849201` của Quản lý và nhấn Hoàn tiền.
* **Kết quả mong đợi:**
  * Đơn hàng chuyển sang `REFUNDED_CASH`.
  * Hệ thống sinh phiếu chi `CASH_OUT_REFUND` có ghi rõ `approved_by: supervisor_id`.
  * Sổ quỹ tiền mặt giảm `-600,000 VND` khớp với thực tế chi trả.

---

### 📌 TC-UAT-07: Chặn Vượt Hạn Mức Tín Dụng Doanh Nghiệp (Credit Limit Exceeded)
* **Mục tiêu:** Kiểm tra ràng buộc hạn mức công nợ.
* **Tiền điều kiện:** Công ty `corp_fpt@smartbooking.vn` đang nợ `18,500,000 VND` trên hạn mức `20,000,000 VND`.
* **Các bước thực hiện:**
  1. Chọn phòng họp với chi phí đơn là `2,000,000 VND`.
  2. Nhập mã công ty `CORP_FPT` để thanh toán nợ sau.
* **Kết quả mong đợi:**
  * Do `18,500,000 + 2,000,000 = 20,500,000 > 20,000,000 VND` (Vượt hạn mức 500,000 VND).
  * Giao diện hiển thị cảnh báo đỏ: *"Vượt quá hạn mức tín dụng còn lại (1,500,000 VND). Vui lòng thanh toán bớt công nợ trước khi tiếp tục."*
  * Nút đặt chỗ bị khóa.
  * Nếu gọi API trực tiếp, Backend phản hồi lỗi HTTP `422 Unprocessable Entity` với mã lỗi `CREDIT_LIMIT_EXCEEDED`.

---

### 📌 TC-UAT-08: Hủy Phòng Phân Tầng & Chế Tài Quá Hạn Mức 2 Lần/Tháng (Anti-Abuse)
* **Mục tiêu:** Kiểm tra chính sách khấu trừ phí hủy phòng và phạt găm giữ phòng đầu cơ.
* **Các trường hợp thử nghiệm:**
  * **Trường hợp A (Hủy > 24h trước giờ họp - Hội viên bình thường):**
    * Chọn đơn cách giờ họp 3 ngày. Nhấn Hủy phòng.
    * Kết quả: Hoàn trả **100%** tiền về ví, phí phạt 0%.
  * **Trường hợp B (Hủy từ 2h đến 24h trước giờ họp):**
    * Chọn đơn cách giờ họp 5 tiếng. Nhấn Hủy phòng.
    * Kết quả: Khấu trừ **20%** phí giữ chỗ, hoàn trả **80%** tiền về ví.
  * **Trường hợp C (Hủy sát giờ < 2h):**
    * Chọn đơn cách giờ họp 1 tiếng. Nhấn Hủy phòng.
    * Kết quả: Phí phạt **100%**, hoàn trả **0 VND**.
  * **Trường hợp D (Người dùng `member_abuser` đã hủy đủ 2 lần miễn phí trong tháng):**
    * Dù hủy trước > 24h, hệ thống tự động phát hiện số lần hủy trong tháng $\ge 2$.
    * Kết quả: Áp dụng phụ phí lạm dụng 30%, chỉ hoàn lại tối đa **70%** giá trị đơn.

---

### 📌 TC-UAT-09: Chống Trừ Tiền Trùng Lặp Ví (Concurrency Anti Double-Spending)
* **Mục tiêu:** Thử nghiệm hai giao dịch đồng thời trên cùng số dư ví hội viên.
* **Tiền điều kiện:** Ví hội viên có đúng `500,000 VND`.
* **Các bước thực hiện:**
  1. Mở 2 tab trình duyệt cùng lúc với cùng tài khoản hội viên.
  2. Tab 1 chọn Slot A giá `400,000 VND`.
  3. Tab 2 chọn Slot B giá `400,000 VND`.
  4. Bấm nút thanh toán ví trên cả 2 tab gần như cùng 1 giây.
* **Kết quả mong đợi:**
  * Chỉ duy nhất 1 giao dịch thành công (nhờ cơ chế PostgreSQL `SELECT ... FOR UPDATE` và ràng buộc `chk_wallet_non_negative`).
  * Giao dịch còn lại bị từ chối với thông báo: *"Số dư ví không đủ để thực hiện giao dịch (Số dư còn lại: 100,000 VND)"*.
  * Số dư ví tuyệt đối không bị âm (`balance >= 0`).

---

## 4. Bảng Ký Duyệt Nghiệm Thu (Sign-off Checklist Matrix)

Tất cả các bên liên quan phải hoàn thành kiểm thử và ký xác nhận trước khi hệ thống được chuyển sang giai đoạn **Triển khai Production (Go-Live)**:

| Mã Kiểm Thử | Nội dung Nghiệm thu Nghiệp vụ | Tiêu chí Đạt (Pass Criteria) | Trạng thái UAT | Chữ ký Người Kiểm thử |
|---|---|---|:---:|---|
| **UAT-SEC-01** | Khóa Redlock 10 phút & Đồng hồ đếm ngược | Lock giải phóng sau đúng 600s, không lệch đồng hồ | [ ] PASS / [ ] FAIL | ____________________ |
| **UAT-SEC-02** | Late Webhook Saga Auto-Refund | Hoàn tiền 100% khi đơn trễ mất phòng, không double-booking | [ ] PASS / [ ] FAIL | ____________________ |
| **UAT-SEC-03** | Two-Man Rule Hoàn Tiền Mặt | Bắt buộc OTP Quản lý ca mới cho hoàn quỹ tiền mặt | [ ] PASS / [ ] FAIL | ____________________ |
| **UAT-SEC-04** | Kiểm soát Trần Công Nợ Doanh Nghiệp | Chặn đứng đơn vượt `credit_limit`, trả lỗi 422 | [ ] PASS / [ ] FAIL | ____________________ |
| **UAT-SEC-05** | Hủy Phòng Phân Tầng & Chống Lạm Dụng | Khấu trừ chính xác 0%, 20%, 100% và phạt 30% khi quá 2 lần/tháng | [ ] PASS / [ ] FAIL | ____________________ |
| **UAT-SEC-06** | Ví Thành Viên Chống Double-Spending | Pessimistic lock khóa hàng; số dư không bao giờ âm | [ ] PASS / [ ] FAIL | ____________________ |
| **UAT-UI-07** | Lưới Lịch Master & Lọc Phòng Mobile | Hiển thị mượt mà trạng thái theo màu sắc, không giật lag | [ ] PASS / [ ] FAIL | ____________________ |
| **UAT-OPS-08** | Vận hành Hạ tầng $0 Free-Tier | Hệ thống ổn định trên Vercel, Render, Neon, Upstash | [ ] PASS / [ ] FAIL | ____________________ |

---

### 📝 BIÊN BẢN KẾT LUẬN NGHIỆM THU (UAT CONCLUSION)
* **Tổng số kịch bản kiểm thử:** 9 Test Cases
* **Số ca đạt (Passed):** _____ / 9
* **Số lỗi phát hiện (Defects Logged):** _____
* **Ý kiến của Đại diện Nghiệp vụ (Product Owner):**
  > *"Hệ thống [  ] ĐỦ ĐIỀU KIỆN / [  ] CHƯA ĐỦ ĐIỀU KIỆN để tiến hành Triển khai Production."*

**Đại diện QA Lead:** ____________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **Đại diện Product Owner:** ____________________  
*(Ký và ghi rõ họ tên)* &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; *(Ký và ghi rõ họ tên)*
