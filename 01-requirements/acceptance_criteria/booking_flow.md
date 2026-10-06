# Acceptance Criteria: Luồng Đặt Phòng & Khóa Giữ Chỗ Trực Tuyến (Online Booking Flow)
**Feature ID:** US-02 & US-03  
**Status:** Approved  
**BRD Version Alignment:** v1.4 (Post-Audit Hardened)  

---

## 1. Luồng chọn Phòng họp & Khóa tạm thời 10 phút (Slot Hold)
- **AC-01.1 (Kiểm tra phòng khả dụng):**
  - Given khách hàng đang ở màn hình tìm kiếm phòng họp trên Mobile App và chọn khung giờ hợp lệ
  - When hệ thống tải danh sách phòng họp
  - Then chỉ các phòng có trạng thái `AVAILABLE` mới hiển thị cho phép bấm "Đặt & Thanh toán".
  - And các phòng có trạng thái `LOCKED_PENDING_ONLINE` hoặc `BOOKED` (`CONFIRMED`, `CONFIRMED_PAID`, `CONFIRMED_DEBT`) phải bị vô hiệu hóa kèm nhãn trạng thái tương ứng.

- **AC-01.2 (Distributed Lock Concurrency - Chống Double-Booking):**
  - Given hai khách hàng A và B cùng xem và bấm đặt cùng 1 phòng vào thời điểm gần như trùng nhau (race condition)
  - When cả hai gửi request `POST /api/v1/bookings` với phương thức `ONLINE_GATEWAY`
  - Then Redis Redlock chỉ cấp quyền lock cho người đến trước.
  - And người đến trước nhận HTTP 201 với trạng thái `LOCKED_PENDING_ONLINE`, thời hạn giữ chỗ `lock_expires_at` (10 phút / 600 giây) và link thanh toán.
  - And người đến sau nhận HTTP 409 Conflict với thông báo `"Phòng họp đã vừa được giữ chỗ bởi người khác, vui lòng chọn khung giờ khác."`

---

## 2. Luồng Thanh toán Trực tuyến & Xác nhận
- **AC-02.1 (Thanh toán đúng hạn trong 10 phút):**
  - Given người dùng đang trong thời hạn 10 phút giữ chỗ
  - When người dùng hoàn tất thanh toán qua cổng thanh toán (IPN/Webhook trả về `SUCCESS` có chữ ký HMAC-SHA512 hợp lệ)
  - Then hệ thống chuyển trạng thái booking sang `CONFIRMED`.
  - And trạng thái thanh toán chuyển sang `PAID`.
  - And hệ thống gửi Push Notification và email xác nhận đặt lịch kèm mã QR check-in tới khách hàng qua Transactional Outbox.
  - And giải phóng Redis temporary lock và ghi nhận vào bảng `bookings` vĩnh viễn.

- **AC-02.2 (Timeout quá 10 phút không thanh toán):**
  - Given người dùng không hoàn tất thanh toán sau khi hết hạn 10 phút (TTL expired)
  - When sự kiện Redis keyspace expiry hoặc cron job kích hoạt
  - Then booking chuyển sang trạng thái `EXPIRED`.
  - And phòng họp ngay lập tức trở lại trạng thái `AVAILABLE` cho toàn bộ người dùng khác.

- **AC-02.3 (Late Webhook Saga Auto-Refund):**
  - Given người dùng thanh toán qua cổng thanh toán nhưng Webhook IPN đến muộn sau khi đã hết hạn 10 phút lock và slot đã bị khách hàng khác đặt
  - When hệ thống nhận IPN thành công từ cổng
  - Then hệ thống TUYỆT ĐỐI KHÔNG ghi đè booking thành `CONFIRMED`.
  - And Saga Orchestrator tự động kích hoạt Compensating Transaction gọi API cổng thanh toán hoàn tiền 100% cho người dùng.
  - And booking chuyển sang trạng thái `EXPIRED_REFUNDED`.

