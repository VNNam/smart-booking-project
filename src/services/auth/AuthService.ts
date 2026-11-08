/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Authentication & IAM Service (Core Service)
 * FILE: src/services/auth/AuthService.ts
 * MÔ TẢ: Xử lý toàn bộ logic Đăng ký, Đăng nhập, Cấp phát Token JWT,
 *       Xác thực OTP, Quên/Đặt lại mật khẩu qua Email, Quản lý Profile & Phân quyền RBAC.
 * ==============================================================================
 */

import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
    UserRole,
    UserProfileDto,
    LoginRequestDto,
    LoginResponseDto,
    RegisterCustomerRequestDto,
    RequestOtpDto,
    VerifyOtpDto,
    ForgotPasswordRequestDto,
    ResetPasswordRequestDto,
    ChangePasswordDto,
    CreateInternalUserDto
} from './types';
import { PasswordUtil } from './PasswordUtil';
import { JwtUtil } from './JwtUtil';

export class BusinessError extends Error {
    constructor(public code: string, message: string, public statusCode: number = 400) {
        super(message);
        this.name = 'BusinessError';
    }
}

export class AuthService {
    private readonly jwtSecret: string;
    private readonly accessTokenTtlSeconds = 8 * 3600; // 8 giờ
    private readonly refreshTokenTtlSeconds = 7 * 24 * 3600; // 7 ngày

    constructor(
        private readonly dbPool: Pool,
        private readonly redisClient: Redis,
        jwtSecret = process.env.JWT_SECRET || 'c8f8b3c2980173295847e098df241746b149b1093847af2b6839174628394018'
    ) {
        this.jwtSecret = jwtSecret;
    }

    /**
     * 1. ĐĂNG NHẬP (Hỗ trợ cả Email hoặc Số điện thoại)
     */
    async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
        const identifier = dto.identifier.trim();
        const client: PoolClient = await this.dbPool.connect();

        try {
            const userQuery = `
                SELECT 
                    u.id, u.company_id, u.email, u.phone, u.full_name,
                    u.password_hash, u.role, u.credit_limit, u.current_debt,
                    u.is_active, u.created_at,
                    w.balance AS wallet_balance
                FROM users u
                LEFT JOIN member_wallets w ON w.user_id = u.id
                WHERE (LOWER(u.email) = LOWER($1) OR u.phone = $1)
                LIMIT 1;
            `;
            const res = await client.query(userQuery, [identifier]);

            if (res.rows.length === 0) {
                throw new BusinessError('INVALID_CREDENTIALS', 'Tài khoản hoặc mật khẩu không chính xác.', 401);
            }

            const user = res.rows[0];

            if (!user.is_active) {
                throw new BusinessError('ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động. Vui lòng liên hệ Quản trị viên.', 403);
            }

            // Kiểm tra mật khẩu
            const isMatch = PasswordUtil.verifyPassword(dto.password, user.password_hash);
            if (!isMatch) {
                throw new BusinessError('INVALID_CREDENTIALS', 'Tài khoản hoặc mật khẩu không chính xác.', 401);
            }

            // Cập nhật last_login_at
            const nowIso = new Date().toISOString();
            await client.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

            // Ký JWT Access Token & Refresh Token
            const accessToken = JwtUtil.sign({
                sub: user.id,
                email: user.email,
                phone: user.phone,
                role: user.role,
                companyId: user.company_id
            }, this.jwtSecret, this.accessTokenTtlSeconds);

            const refreshToken = JwtUtil.sign({
                sub: user.id,
                email: user.email,
                phone: user.phone,
                role: user.role,
                companyId: user.company_id
            }, this.jwtSecret, this.refreshTokenTtlSeconds);

            // Lưu refreshToken vào Redis
            await this.redisClient.set(
                `refresh_token:${user.id}`,
                refreshToken,
                'EX',
                this.refreshTokenTtlSeconds
            );

            const userProfile: UserProfileDto = {
                id: user.id,
                email: user.email,
                phone: user.phone,
                fullName: user.full_name,
                role: user.role,
                companyId: user.company_id,
                creditLimit: parseFloat(user.credit_limit || '0'),
                currentDebt: parseFloat(user.current_debt || '0'),
                walletBalance: user.wallet_balance ? parseFloat(user.wallet_balance) : 0,
                lastLoginAt: nowIso
            };

            return {
                accessToken,
                refreshToken,
                tokenType: 'Bearer',
                expiresIn: this.accessTokenTtlSeconds,
                user: userProfile
            };
        } finally {
            client.release();
        }
    }

    /**
     * 2. ĐĂNG KÝ TÀI KHOẢN KHÁCH HÀNG (MOBILE APP)
     */
    async registerCustomer(dto: RegisterCustomerRequestDto): Promise<UserProfileDto> {
        const client: PoolClient = await this.dbPool.connect();

        try {
            await client.query('BEGIN');

            // Kiểm tra trùng lặp email hoặc phone
            const checkQuery = `SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2 LIMIT 1;`;
            const checkRes = await client.query(checkQuery, [dto.email.trim(), dto.phone.trim()]);
            if (checkRes.rows.length > 0) {
                throw new BusinessError('USER_ALREADY_EXISTS', 'Email hoặc Số điện thoại đã được đăng ký trong hệ thống.', 409);
            }

            const userId = uuidv4();
            const passwordHash = PasswordUtil.hashPassword(dto.password);

            // Tạo bản ghi users
            const insertUserQuery = `
                INSERT INTO users (
                    id, email, phone, full_name, password_hash, role, credit_limit, current_debt, is_active
                ) VALUES ($1, $2, $3, $4, $5, 'CUSTOMER', 0.00, 0.00, TRUE)
                RETURNING id, email, phone, full_name, role, created_at;
            `;
            const userRes = await client.query(insertUserQuery, [
                userId, dto.email.trim(), dto.phone.trim(), dto.fullName.trim(), passwordHash
            ]);

            // Tự động khởi tạo ví rỗng cho khách
            const walletId = uuidv4();
            await client.query(`
                INSERT INTO member_wallets (id, user_id, balance)
                VALUES ($1, $2, 0.00)
                ON CONFLICT (user_id) DO NOTHING;
            `, [walletId, userId]);

            // Lưu event chào mừng ra Outbox
            await client.query(`
                INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                VALUES ('USER', $1, 'CUSTOMER_REGISTERED', $2, 'PENDING');
            `, [userId, JSON.stringify({ email: dto.email, phone: dto.phone, fullName: dto.fullName })]);

            await client.query('COMMIT');

            return {
                id: userId,
                email: dto.email.trim(),
                phone: dto.phone.trim(),
                fullName: dto.fullName.trim(),
                role: 'CUSTOMER',
                creditLimit: 0,
                currentDebt: 0,
                walletBalance: 0
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * 3. YÊU CẦU GỬI MÃ OTP (XÁC THỰC SĐT HOẶC EMAIL)
     */
    async requestOtp(dto: RequestOtpDto): Promise<{ success: boolean; message: string; expiresInSeconds: number }> {
        const target = dto.target.trim();
        const rateLimitKey = `rate_limit:otp:${target}`;

        // Kiểm tra chống spam: tối đa 3 lần / 5 phút
        const attempts = await this.redisClient.incr(rateLimitKey);
        if (attempts === 1) {
            await this.redisClient.expire(rateLimitKey, 300); // 5 phút
        }
        if (attempts > 3) {
            throw new BusinessError('RATE_LIMIT_EXCEEDED', 'Bạn đã yêu cầu gửi mã OTP quá nhiều lần. Vui lòng thử lại sau 5 phút.', 429);
        }

        const otp = PasswordUtil.generateOtp();
        const otpKey = `otp:${dto.purpose}:${target}`;
        const ttlSeconds = 120; // 2 phút

        await this.redisClient.set(otpKey, otp, 'EX', ttlSeconds);

        // Lưu Outbox Event để Worker gửi SMS / Email
        const eventType = dto.channel === 'SMS' ? 'SEND_SMS_OTP' : 'SEND_EMAIL_OTP';
        await this.dbPool.query(`
            INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
            VALUES ('OTP', $1, $2, $3, 'PENDING');
        `, [target, eventType, JSON.stringify({ target, otp, purpose: dto.purpose, expiresInSeconds: ttlSeconds })]);

        console.log(`[AuthService] Đã sinh OTP cho ${target} (${dto.channel} - ${dto.purpose}): ${otp}`);

        return {
            success: true,
            message: `Mã xác thực OTP đã được gửi tới ${dto.channel === 'SMS' ? 'số điện thoại' : 'email'} của bạn.`,
            expiresInSeconds: ttlSeconds
        };
    }

    /**
     * 4. XÁC THỰC MÃ OTP
     */
    async verifyOtp(dto: VerifyOtpDto): Promise<boolean> {
        const otpKey = `otp:${dto.purpose}:${dto.target.trim()}`;
        const storedOtp = await this.redisClient.get(otpKey);

        if (!storedOtp) {
            throw new BusinessError('OTP_EXPIRED', 'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu mã mới.', 400);
        }

        if (storedOtp !== dto.otpCode.trim()) {
            throw new BusinessError('INVALID_OTP', 'Mã xác thực OTP không chính xác.', 400);
        }

        // Xóa OTP sau khi dùng thành công (One-time use)
        await this.redisClient.del(otpKey);
        return true;
    }

    /**
     * 5. QUÊN MẬT KHẨU (GỬI TOKEN RESET QUA EMAIL)
     */
    async forgotPassword(dto: ForgotPasswordRequestDto): Promise<{ success: boolean; message: string }> {
        const email = dto.email.trim().toLowerCase();
        const res = await this.dbPool.query('SELECT id, full_name FROM users WHERE LOWER(email) = $1 LIMIT 1', [email]);

        // Trả về thông báo thành công dù email không tồn tại để chống User Enumeration Attack
        if (res.rows.length === 0) {
            return {
                success: true,
                message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hòm thư của bạn.'
            };
        }

        const user = res.rows[0];
        const resetToken = PasswordUtil.generateResetToken();
        const ttlSeconds = 15 * 60; // 15 phút

        await this.redisClient.set(`pwd_reset:${resetToken}`, email, 'EX', ttlSeconds);

        const resetLink = `https://smart-booking-admin-uat.vercel.app/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        // Đẩy sự kiện gửi email ra Outbox
        await this.dbPool.query(`
            INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
            VALUES ('USER', $1, 'PASSWORD_RESET_REQUESTED', $2, 'PENDING');
        `, [user.id, JSON.stringify({ email, fullName: user.full_name, resetToken, resetLink, expiresInMinutes: 15 })]);

        console.log(`[AuthService] Password reset link for ${email}: ${resetLink}`);

        return {
            success: true,
            message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hòm thư của bạn.'
        };
    }

    /**
     * 6. THIẾT LẬP MẬT KHẨU MỚI BẰNG RESET TOKEN
     */
    async resetPassword(dto: ResetPasswordRequestDto): Promise<{ success: boolean; message: string }> {
        const emailFromToken = await this.redisClient.get(`pwd_reset:${dto.token.trim()}`);

        if (!emailFromToken || emailFromToken.toLowerCase() !== dto.email.trim().toLowerCase()) {
            throw new BusinessError('INVALID_OR_EXPIRED_TOKEN', 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 400);
        }

        if (dto.newPassword.length < 6) {
            throw new BusinessError('WEAK_PASSWORD', 'Mật khẩu mới phải có tối thiểu 6 ký tự.', 400);
        }

        const newHash = PasswordUtil.hashPassword(dto.newPassword);

        await this.dbPool.query(`
            UPDATE users 
            SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE LOWER(email) = LOWER($2);
        `, [newHash, dto.email.trim()]);

        // Xóa token reset
        await this.redisClient.del(`pwd_reset:${dto.token.trim()}`);

        return {
            success: true,
            message: 'Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập bằng mật khẩu mới.'
        };
    }

    /**
     * 7. LẤY THÔNG TIN HỒ SƠ NGƯỜI DÙNG HIỆN TẠI (ME / PROFILE)
     */
    async getProfile(userId: string): Promise<UserProfileDto> {
        const userQuery = `
            SELECT 
                u.id, u.company_id, u.email, u.phone, u.full_name,
                u.role, u.credit_limit, u.current_debt, u.is_active,
                w.balance AS wallet_balance
            FROM users u
            LEFT JOIN member_wallets w ON w.user_id = u.id
            WHERE u.id = $1
            LIMIT 1;
        `;
        const res = await this.dbPool.query(userQuery, [userId]);

        if (res.rows.length === 0) {
            throw new BusinessError('NOT_FOUND', 'Không tìm thấy thông tin tài khoản người dùng.', 404);
        }

        const user = res.rows[0];
        return {
            id: user.id,
            email: user.email,
            phone: user.phone,
            fullName: user.full_name,
            role: user.role,
            companyId: user.company_id,
            creditLimit: parseFloat(user.credit_limit || '0'),
            currentDebt: parseFloat(user.current_debt || '0'),
            walletBalance: user.wallet_balance ? parseFloat(user.wallet_balance) : 0
        };
    }

    /**
     * 8. ĐỔI MẬT KHẨU (CHANGE PASSWORD KHI ĐANG ĐĂNG NHẬP)
     */
    async changePassword(dto: ChangePasswordDto): Promise<{ success: boolean; message: string }> {
        const res = await this.dbPool.query('SELECT password_hash FROM users WHERE id = $1', [dto.userId]);
        if (res.rows.length === 0) {
            throw new BusinessError('NOT_FOUND', 'Người dùng không tồn tại.', 404);
        }

        const currentHash = res.rows[0].password_hash;
        if (!PasswordUtil.verifyPassword(dto.currentPassword, currentHash)) {
            throw new BusinessError('WRONG_CURRENT_PASSWORD', 'Mật khẩu hiện tại không chính xác.', 400);
        }

        if (dto.newPassword.length < 6) {
            throw new BusinessError('WEAK_PASSWORD', 'Mật khẩu mới phải có tối thiểu 6 ký tự.', 400);
        }

        const newHash = PasswordUtil.hashPassword(dto.newPassword);
        await this.dbPool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, dto.userId]);

        return {
            success: true,
            message: 'Đổi mật khẩu thành công.'
        };
    }

    /**
     * 9. TẠO TÀI KHOẢN NỘI BỘ (ADMIN CẤP QUYỀN CHO LỄ TÂN / KẾ TOÁN)
     */
    async createInternalUser(creatorRole: UserRole, dto: CreateInternalUserDto): Promise<UserProfileDto> {
        if (creatorRole !== 'ADMIN') {
            throw new BusinessError('FORBIDDEN', 'Chỉ Quản trị viên (ADMIN) mới có quyền cấp tài khoản nhân viên nội bộ.', 403);
        }

        const client: PoolClient = await this.dbPool.connect();
        try {
            const checkRes = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2 LIMIT 1', [dto.email, dto.phone]);
            if (checkRes.rows.length > 0) {
                throw new BusinessError('ALREADY_EXISTS', 'Email hoặc Số điện thoại nhân viên đã tồn tại.', 409);
            }

            const userId = uuidv4();
            const passwordHash = PasswordUtil.hashPassword(dto.password);

            const insertRes = await client.query(`
                INSERT INTO users (
                    id, email, phone, full_name, password_hash, role, company_id, credit_limit, current_debt, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.00, TRUE)
                RETURNING id, email, phone, full_name, role;
            `, [userId, dto.email.trim(), dto.phone.trim(), dto.fullName.trim(), passwordHash, dto.role, dto.companyId || null, dto.creditLimit || 0.00]);

            const created = insertRes.rows[0];
            return {
                id: created.id,
                email: created.email,
                phone: created.phone,
                fullName: created.full_name,
                role: created.role,
                companyId: dto.companyId,
                creditLimit: dto.creditLimit || 0,
                currentDebt: 0
            };
        } finally {
            client.release();
        }
    }
}

