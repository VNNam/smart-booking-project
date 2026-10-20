# 📋 TIÊU CHÍ CHẤP NHẬN: TÍCH HỢP CỔNG THANH TOÁN MOMO (API v3)
## Acceptance Criteria - MoMo Payment Gateway v3 Integration

**Dự án:** Smart Meeting Room Booking System  
**Phiên bản:** v1.4 Hardened  
**Biên soạn bởi:** Senior Backend Engineer (`@Dev_Agent`)  
**Ngày ban hành:** 2026-10-20  

---

## 1. Danh sách Tiêu chí Chấp nhận (Acceptance Criteria Matrix)

| Mã AC | Nghiệp Vụ Kiểm Chứng | Tiêu Chí Đạt (Pass Criteria) | Trạng Thái Kỹ Thuật |
|---|---|---|:---:|
| **AC-MOMO-01** | **Khởi tạo Đơn Đa Phương Thức** | • Hỗ trợ cả 6 giá trị `requestType`: `captureWallet`, `payWithCC`, `payWithApplePay`, `payWithGooglePay`, `subscription`, `payWithMethod`.<br>• Với `payWithApplePay`: Bắt buộc kiểm tra `userInfo.email` hợp lệ.<br>• Với `subscription`: Bắt buộc có đối tượng `subscriptionInfo`.<br>• Trả về `payUrl` / `deeplink` để điều hướng khách hàng. | **Hoàn thành** |
| **AC-MOMO-02** | **Chữ ký số HMAC-SHA256** | • Tất cả tham số gửi đi được sắp xếp A-Z theo tên biến.<br>• Nối dạng `key1=value1&key2=value2...` và băm bằng HMAC-SHA256 với `secretKey`.<br>• Kết quả là chuỗi 64 ký tự Hexadecimal viết thường. | **Hoàn thành** |
| **AC-MOMO-03** | **Xác thực IPN & Bảo mật** | • Khi MoMo gửi Webhook IPN, hệ thống bóc tách `signature` và kiểm tra lại bằng `crypto.timingSafeEqual`.<br>• Chữ ký sai lệch $\rightarrow$ Phản hồi ngay `HTTP 400 Bad Request`, không tốn tài nguyên DB.<br>• Ghi log đầy đủ: `[MoMo IPN] Received orderId: ..., resultCode: ...`. | **Hoàn thành** |
| **AC-MOMO-04** | **Chống Xử lý Trùng lặp (Idempotency)** | • Mở Transaction và khóa dòng bằng `SELECT ... FOR UPDATE`.<br>• Nếu đơn hàng đã ở trạng thái `CONFIRMED` và `payment_status = 'PAID'` $\rightarrow$ Phản hồi ngay `HTTP 204 No Content` / `HTTP 200 OK`, bỏ qua xử lý tiếp. | **Hoàn thành** |
| **AC-MOMO-05** | **Saga Auto-Refund khi gặp Late Webhook** | • Nếu IPN gửi về thành công (`resultCode === 0`) nhưng đã quá hạn 10 phút TTL và slot đã bị người khác đặt trước:<br>&nbsp;&nbsp;1. Tuyệt đối KHÔNG cập nhật đơn sang `CONFIRMED` (ngăn chặn Double-Booking).<br>&nbsp;&nbsp;2. Chuyển đơn sang `EXPIRED_REFUNDED`.<br>&nbsp;&nbsp;3. Tự động gọi MoMo Refund API (`POST /v2/gateway/api/refund`) hoàn trả 100% tiền.<br>&nbsp;&nbsp;4. Ghi event `LATE_WEBHOOK_AUTO_REFUND_TRIGGERED` kèm voucher đền bù 20%. | **Hoàn thành** |
| **AC-MOMO-06** | **Fail-Safe Timeout Worker** | • Cronjob chạy ngầm định kỳ 5–10 phút/lần.<br>• Quét các đơn `LOCKED_PENDING_ONLINE` quá hạn 10 phút.<br>• Gọi API Query (`POST /v2/gateway/api/query`) sang MoMo.<br>• Nếu MoMo báo chưa thanh toán: Đánh dấu đơn `EXPIRED`, giải phóng slot về `AVAILABLE`, xóa Redis lock.<br>• Nếu MoMo báo đã thanh toán: Tự động khôi phục giao dịch sang chốt phòng. | **Hoàn thành** |
| **AC-MOMO-07** | **Bảo mật Bí mật Hệ thống** | • `secretKey` và `accessKey` đọc từ `.env`.<br>• Tuyệt đối không log `secretKey` ra console hoặc gửi về client. | **Hoàn thành** |
