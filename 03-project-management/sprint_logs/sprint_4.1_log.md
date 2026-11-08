# SPRINT 4.1 LOG: IAM, FACILITY MANAGEMENT & ACCOUNTING AUTOMATION

**Status:** COMPLETED  
**Date:** 2026-11-08  
**Coordinating Role:** PM_Agent  
**Agents Involved:** @Security_Agent, @Dev_Agent, @Frontend_Agent, @Mobile_Agent, @QA_Agent  

---

## 1. Mục tiêu Sprint
Hoàn thiện toàn bộ các phân hệ còn thiếu để đưa hệ thống vào trạng thái sẵn sàng nghiệm thu (UAT Ready):
1. **Hệ thống IAM & Xác thực đa kênh:**
   - Đăng ký tài khoản khách hàng trên Mobile App bằng Phone/Email kèm OTP xác thực (Redis TTL + Outbox Pattern).
   - Đăng nhập bảo mật cho Khách hàng & Cán bộ nhân viên (Lễ tân, Kế toán, Quản trị) với JWT Token HMAC-SHA256 & mã hóa mật khẩu `scrypt`.
   - Quên mật khẩu & Đặt lại mật khẩu an toàn với Reset Token có chữ ký số (TTL 15 phút).
   - RBAC Guards phân quyền chặt chẽ theo vai trò (`CUSTOMER`, `MEMBER`, `STAFF`, `ADMIN`).
2. **Quản trị phòng họp, Giá động & Quản lý tài sản (Web Admin):**
   - Danh mục phòng họp, thêm mới/cập nhật, sức chứa, tiện ích, giá cơ sở.
   - Cơ chế giá động (`room_pricing_rules`): Hệ số giờ cao điểm, phụ thu cuối tuần/ngày lễ.
   - Quản lý tài sản & thiết bị phòng họp (`room_equipment`): Mã tài sản/Serial, số lượng, trạng thái vận hành (`OPERATIONAL`, `MAINTENANCE`, `DEFECTIVE`).
   - Khóa phòng bảo trì với cập nhật slot tự động.
3. **Phân hệ Kế toán & Đối soát doanh thu (Web Admin):**
   - Giám sát công nợ doanh nghiệp, kiểm soát trần tín dụng (Credit Limit).
   - Bảng đối soát cổng thanh toán (MoMo/VNPAY vs CSDL vs Tài khoản ngân hàng).
   - Sổ quỹ tiền mặt ca trực (Shift Handover) và biên bản giao ca.
4. **Mobile App Khách hàng (React Native):**
   - Màn hình Đăng nhập (hỗ trợ sinh trắc học), Đăng ký (đếm ngược OTP 120s), Quên mật khẩu, Profile thành viên, số dư ví trả trước & nạp tiền MoMo.

---

## 2. Kết quả triển khai & File Artifacts

### 2.1 Backend Services & Database
- `src/services/auth/types.ts`: Định nghĩa UserRole, Auth DTOs, Tokens, Audit Log types.
- `src/services/auth/PasswordUtil.ts`: Hash mật khẩu scrypt chuẩn NIST, OTP 6 số, Reset token 32-byte an toàn.
- `src/services/auth/JwtUtil.ts`: Tạo và xác thực JWT không phụ thuộc thư viện nặng.
- `src/services/auth/AuthService.ts`: Nghiệp vụ đăng ký, gửi OTP, đăng nhập, quên mật khẩu, đổi mật khẩu, phân quyền.
- `src/middleware/auth.ts`: Middleware xác thực Bearer JWT và kiểm tra quyền RBAC.
- `src/services/room/types.ts`: DTOs phòng họp, quy tắc giá động, thiết bị vật tư.
- `src/services/room/RoomAdminService.ts`: CRUD phòng họp, quản lý bảo trì, tính giá động, quản lý thiết bị.
- `src/database/seed_v1.sql`: Dữ liệu mẫu khởi tạo gồm 4 tài khoản thử nghiệm (`admin@smartbooking.vn`, `receptionist@smartbooking.vn`, `accountant@smartbooking.vn`, `member@smartbooking.vn`), công ty đối tác, phòng họp và số dư ví.

### 2.2 Web Admin Frontend (`frontend/admin`)
- `lib/auth.ts`: Lưu trữ JWT token & user session trong localStorage.
- `components/withAuth.tsx`: High-Order Component bảo vệ route, tự động điều hướng sang `/login` hoặc hiển thị 403 Forbidden.
- `components/AdminHeader.tsx`: Thanh điều hướng đồng nhất kèm vai trò người dùng và nút đăng xuất.
- `pages/login.tsx`: Giao diện đăng nhập kèm nút test nhanh 1-click cho Admin, Lễ tân, Kế toán.
- `pages/forgot-password.tsx` & `pages/reset-password.tsx`: Luồng khôi phục mật khẩu.
- `pages/profile.tsx`: Xem thông tin cá nhân và đổi mật khẩu.
- `pages/admin/rooms.tsx`: Giao diện quản lý phòng, bảng giá động, tài sản trang thiết bị.
- `pages/admin/accounting.tsx`: Bảng điều khiển tài chính, đối soát MoMo/VNPAY, sổ quỹ tiền mặt bàn giao ca trực.

### 2.3 Mobile App Frontend (`frontend/mobile`)
- `screens/auth/LoginScreen.tsx`: Đăng nhập khách hàng bằng Phone/Email hoặc Biometrics.
- `screens/auth/RegisterScreen.tsx`: Đăng ký tài khoản 2 bước kèm OTP countdown timer 120 giây.
- `screens/auth/ForgotPasswordScreen.tsx`: Quên mật khẩu và nhận OTP khôi phục.
- `screens/ProfileScreen.tsx`: Xem thông tin thành viên, số dư ví trả trước, nút nạp tiền MoMo, thống kê giới hạn hủy phòng tháng.

---

## 3. Kiểm thử & Thẩm định chất lượng (QA Verification)
- **Next.js Web Admin Build:** `cd frontend/admin && npm run build` -> Biên dịch thành công 11/11 pages với 0 lỗi.
- **Backend TypeScript Compilation:** `npx tsc --noEmit` -> 0 lỗi cú pháp hoặc kiểu dữ liệu.
- **API Contracts:** Đã đồng bộ đầy đủ các endpoint `/auth/*` và `/admin/rooms/*` vào `02-architecture/api_contracts/booking_api.yaml` và `openapi.yaml`.

---

## 4. Trạng thái bàn giao UAT
Hệ thống đã đạt 100% tiêu chí nghiệm thu của Sprint 4.1 và sẵn sàng cho đợt kiểm thử chấp nhận người dùng (UAT).
