# Acceptance Criteria: Luồng Hủy Phòng & Hoàn Tiền Phân Tầng (Tiered Cancellation & Refund Policy)
**Version:** 1.4 (Post-Audit Hardened)  
**Status:** Approved  
**Referenced Document:** [brd_v1.4.md](../brd_v1.4.md), [admin_cash_booking.md](./admin_cash_booking.md)  

---

## 1. Điều Kiện Hủy Lịch & Phân Tầng Hoàn Tiền (Tiered Cancellation Rules)

### 1.1. Luồng Khách Tự Hủy Trên Mobile App (Online Gateway & Ví Thành Viên)
* **AC-CAN-01 (Mốc 1 - Hủy trước ≥ 24 giờ):**
  * Given khách hàng gửi yêu cầu hủy phòng họp có trạng thái `CONFIRMED`
  * And khoảng cách thời gian giữa thời điểm hiện tại và giờ họp `start_time` $\ge 24$ giờ
  * When hệ thống xử lý yêu cầu hủy
  * Then trạng thái đặt phòng chuyển sang `CANCELLED`.
  * And hoàn tiền **100%**:
    * Thanh toán `ONLINE_GATEWAY`: Khởi tạo lệnh hoàn 100% qua cổng thanh toán (VNPAY/MoMo/ZaloPay).
    * Thanh toán `PREPAID_WALLET`: Cộng hoàn trả 100% số dư vào ví thành viên và chèn bản ghi `REFUND` trong `WALLET_TRANSACTIONS`.
  * And phòng họp lập tức trở lại trạng thái `AVAILABLE`.
  * And gửi thông báo xác nhận hủy và thông tin hoàn tiền tới khách hàng.

* **AC-CAN-02 (Mốc 2 - Hủy từ 2 giờ đến dưới 24 giờ):**
  * Given khoảng cách thời gian giữa thời điểm hiện tại và giờ họp từ 2 giờ đến dưới 24 giờ ($2\text{h} \le \Delta t < 24\text{h}$)
  * When khách hàng bấm hủy trên Mobile App
  * Then hệ thống hiển thị thông báo chính sách: *"Hủy trong khoảng 2h - 24h sẽ chịu phí phạt 20% giữ chỗ và được hoàn trả 80% giá trị đơn phòng. Bạn có chắc chắn muốn hủy?"*
  * When khách hàng xác nhận tiếp tục
  * Then trạng thái phòng chuyển sang `CANCELLED`.
  * And số tiền hoàn trả $= 80\%$ giá trị đơn phòng; phí phạt $= 20\%$.
  * And hoàn $80\%$ qua cổng thanh toán hoặc số dư ví thành viên tương ứng.
  * And phòng họp trở lại trạng thái `AVAILABLE`.

* **AC-CAN-03 (Mốc 3 - Hủy sát giờ dưới < 2 giờ):**
  * Given khoảng cách thời gian giữa thời điểm hiện tại và giờ họp $< 2$ giờ
  * When khách hàng bấm hủy trên Mobile App
  * Then hệ thống hiển thị cảnh báo: *"Hủy phòng dưới 2 giờ trước giờ bắt đầu sẽ chịu phí phạt 100% (không được hoàn tiền). Bạn có chắc chắn muốn hủy để giải phóng phòng?"*
  * When khách hàng xác nhận hủy
  * Then trạng thái đặt phòng chuyển sang `CANCELLED_NO_REFUND`.
  * And số tiền hoàn trả $= 0$ VNĐ; phí phạt $= 100\%$.
  * And phòng họp lập tức được giải phóng trở lại trạng thái `AVAILABLE`.

* **AC-CAN-04 (Giới hạn số lần hủy miễn phạt trong tháng):**
  * Given khách hàng đã hủy phòng $\ge 2$ lần trong tháng hiện tại
  * When khách hàng thực hiện hủy tiếp lần thứ 3 trở đi thuộc Mốc 1 hoặc Mốc 2
  * Then hệ thống tự động phạt thêm $30\%$ phí vi phạm quy định thường xuyên.
  * And tỷ lệ hoàn tiền tối đa không vượt quá $70\%$.

---

## 2. Luồng Admin Hủy Trên Web Admin (Tiền Mặt & Công Nợ)

* **AC-CAN-05 (Admin hủy đơn tiền mặt tại quầy kèm Two-Man Rule):**
  * Given đơn đặt phòng ở trạng thái `CONFIRMED_PAID` (thanh toán `CASH_ON_ARRIVAL`)
  * When Lễ tân thao tác hủy trên Web Admin
  * Then nếu số tiền hoàn sau khi trừ phí phạt $> 0$, hệ thống bắt buộc kích hoạt cơ chế **Two-Man Rule**:
    * Yêu cầu nhập mã OTP xác thực từ Quản lý ca trực (Shift Supervisor) [admin_cash_booking.md](./admin_cash_booking.md).
    * Chặn hoàn tiền nếu thiếu OTP (`OTP_REQUIRED`) hoặc nhập sai OTP (`INVALID_OTP`).
  * And khi OTP được xác thực thành công:
    * Trạng thái đặt phòng đổi sang `CANCELLED`.
    * Hệ thống tự động sinh một bản ghi chi tiền hoàn mặt (`CASH_OUT_REFUND`) vào bảng `CASH_BOOK_LOGS` để kế toán đối soát cuối ngày.
    * Phòng họp chuyển về trạng thái `AVAILABLE`.

* **AC-CAN-06 (Admin hủy đơn công nợ `CONFIRMED_DEBT`):**
  * Given đơn đặt phòng ở trạng thái `CONFIRMED_DEBT` (thanh toán `POSTPAID_DEBT`)
  * When Admin thao tác hủy trên Web Admin
  * Then trạng thái đặt phòng đổi sang `CANCELLED`.
  * And công nợ dự kiến cho đơn phòng này được hủy bỏ (không kết chuyển vào bảng đối soát doanh nghiệp).
  * And phòng họp chuyển về trạng thái `AVAILABLE`.

