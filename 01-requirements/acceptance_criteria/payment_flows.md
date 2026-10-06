# Acceptance Criteria: Luồng Thanh Toán & Chuyển Trạng Thái Đặt Phòng (Payment Flows & State Transitions)
**Version:** 1.4 (Post-Audit Hardened)  
**Status:** Approved  
**Author:** BA Agent  
**Referenced Document:** [brd_v1.4.md](../brd_v1.4.md)  

---

## 1. Ma Trận Trạng Thái Đặt Phòng (Booking State Machine Matrix v1.4)

| Trạng thái Nguồn (Source) | Phương thức Thanh toán (Method) | Tác nhân (Actor) / Kênh | Sự kiện kích hoạt (Trigger) | Trạng thái Đích (Target) | Thời gian giữ chỗ (TTL) | Hành động Hệ thống kèm theo |
|---|---|---|---|---|---|---|
| `AVAILABLE` | `ONLINE_GATEWAY` | End-User (Mobile App) | Nhấn "Đặt & Thanh toán" | `LOCKED_PENDING_ONLINE` | **10 phút (600s)** | Khởi tạo Redis TTL lock 600s, tạo liên kết thanh toán VNPAY/MoMo |
| `LOCKED_PENDING_ONLINE` | `ONLINE_GATEWAY` | Cổng thanh toán (Webhook/IPN) | Trừ tiền thành công trong 10 phút | `CONFIRMED` | Không (Permanent) | Hủy TTL lock, lưu `OUTBOX_EVENTS`, gửi Push Notification & Email |
| `LOCKED_PENDING_ONLINE` | `ONLINE_GATEWAY` | Hệ thống (Redis Expiry) | Quá 10 phút không có IPN thành công | `AVAILABLE` | Hết hạn | Mở khóa phòng, chuyển booking sang `EXPIRED` |
| `EXPIRED` / `AVAILABLE` | `ONLINE_GATEWAY` | Cổng thanh toán (Late IPN) | Trừ tiền thành công SAU 10 phút | `EXPIRED` (Slot đã bị chiếm) | Không | **Saga Auto-Refund:** Kích hoạt API hoàn tiền 100% về ngân hàng |
| `AVAILABLE` | `PREPAID_WALLET` | Thành viên (Mobile App) | Nhấn "Thanh toán bằng Ví" (`Idempotency-Key`) | `CONFIRMED` | Không (Tức thì) | Khóa dòng `SELECT FOR UPDATE`, trừ tiền ví, lưu `OUTBOX_EVENTS` |
| `AVAILABLE` | `PREPAID_WALLET` | Thành viên (Mobile App) | Số dư ví < Giá phòng | `AVAILABLE` (Rejected) | Không | Trả về HTTP 402 `INSUFFICIENT_WALLET_BALANCE` |
| `AVAILABLE` | `CASH_ON_ARRIVAL` | Lễ tân/Admin (Web Admin) | Bấm "Xác nhận & Đã thu tiền" | `CONFIRMED_PAID` | Không (Tức thì) | Ghi nhận phiếu thu `CASH_IN_COLLECT` vào `CASH_BOOK_LOGS` |
| `AVAILABLE` | `POSTPAID_DEBT` | Lễ tân/Admin (Web Admin) | Đặt nợ (`current_debt + price <= limit`) | `CONFIRMED_DEBT` | Không (Tức thì) | Ghi nhận công nợ, cộng dồn `current_debt` |
| `AVAILABLE` | `POSTPAID_DEBT` | Lễ tân/Admin (Web Admin) | Đặt nợ (`current_debt + price > limit`) | `AVAILABLE` (Rejected) | Không | Trả về HTTP 422 `CREDIT_LIMIT_EXCEEDED` |
| `CONFIRMED_PAID` | `CASH_REFUND` | Lễ tân + Quản lý ca (Web Admin) | Lễ tân yêu cầu hủy $\to$ Quản lý nhập đúng OTP | `CANCELLED` | Không | Ghi phiếu chi `CASH_OUT_REFUND` vào `CASH_BOOK_LOGS` |

---

## 2. Tiêu Chí Nghiệm Thu Chi Tiết Theo Từng Luồng

### 2.1. Luồng 1: Thanh toán Trực tuyến (Online Payment - 10 phút TTL & Late Webhook)
- **AC-PAY-01.1 (Khóa phòng 10 phút):**
  - Given khách hàng chọn phòng trống và bấm "Đặt & Thanh toán"
  - When API `POST /api/v1/bookings` nhận request với `payment_method = "ONLINE_GATEWAY"`
  - Then phòng chuyển sang trạng thái `LOCKED_PENDING_ONLINE` với Redis TTL = 600 giây (10 phút)
  - And trả về `payment_url` cổng thanh toán.

- **AC-PAY-01.2 (Thanh toán đúng hạn trong 10 phút):**
  - Given phòng đang ở trạng thái `LOCKED_PENDING_ONLINE` và chưa hết 600 giây
  - When hệ thống nhận IPN từ cổng thanh toán báo `SUCCESS`
  - Then trạng thái booking đổi thành `CONFIRMED`, `payment_status = "PAID"`.

- **AC-PAY-01.3 (Late Webhook sau 10 phút - Tự động Hoàn tiền):**
  - Given đơn đặt phòng đã bị `EXPIRED` do quá 10 phút và phòng đã được khách khác đặt
  - When hệ thống nhận IPN thành công từ cổng thanh toán cho đơn cũ
  - Then hệ thống không cập nhật trạng thái booking sang `CONFIRMED`
  - And hệ thống lập tức gọi API hoàn tiền tự động 100% về tài khoản của khách hàng
  - And ghi log vào `AUDIT_LOGS` và gửi thông báo giải thích cho khách hàng.

---

### 2.2. Luồng 2: Ví Thành viên (Prepaid Credit - Chống Double-Spending)
- **AC-PAY-02.1 (Pessimistic Lock & Idempotency):**
  - Given thành viên gửi request kèm `Idempotency-Key`
  - When hệ thống xử lý giao dịch trong transaction với `SELECT ... FOR UPDATE`
  - Then số dư ví bị trừ chính xác và không bao giờ bị âm nhờ DB constraint `CHECK (balance >= 0)`.

- **AC-PAY-02.2 (Số dư không đủ):**
  - Given số dư ví khả dụng < giá phòng
  - When gửi request thanh toán bằng ví
  - Then hệ thống trả về mã lỗi HTTP 402 `INSUFFICIENT_WALLET_BALANCE`.

---

### 2.3. Luồng 3: Công nợ có Hạn mức Tín dụng (Corporate Postpaid Debt)
- **AC-PAY-03.1 (Kiểm soát Hạn mức Tín dụng):**
  - Given Lễ tân tạo booking công nợ cho doanh nghiệp
  - When `current_debt + room_price > credit_limit`
  - Then hệ thống từ chối tạo booking và trả về HTTP 422 `CREDIT_LIMIT_EXCEEDED`
  - And phòng vẫn giữ trạng thái `AVAILABLE`.

---

### 2.4. Luồng 4: Hủy phòng Phân tầng & Duyệt OTP Hoàn tiền Mặt (Two-Man Rule)
- **AC-PAY-04.1 (Khách hủy phòng phân tầng):**
  - **$\ge 24$ giờ:** Hoàn 100% tiền.
  - **2 giờ đến < 24 giờ:** Phạt 20% phí giữ chỗ (chỉ hoàn 80%).
  - **< 2 giờ:** Không hoàn tiền (0% hoàn tiền, trạng thái `CANCELLED_NO_REFUND`).
  - **Giới hạn:** Tối đa 2 lần hủy miễn phạt/tháng. Lần thứ 3 trở đi phạt cố định 30%.

- **AC-PAY-04.2 (Two-Man Rule - Duyệt OTP Hoàn tiền mặt):**
  - Given đơn đặt phòng tại quầy `CONFIRMED_PAID`
  - When Lễ tân bấm "Hủy & Hoàn tiền mặt"
  - Then hệ thống sinh mã OTP gửi đến số điện thoại của Quản lý ca trực (Shift Supervisor)
  - And Lễ tân nhập đúng OTP $\to$ Hệ thống chuyển sang `CANCELLED` và ghi phiếu chi `CASH_OUT_REFUND` vào `CASH_BOOK_LOGS`
  - And nếu nhập sai OTP 3 lần $\to$ Khóa luồng hủy và cảnh báo vi phạm bảo mật.
