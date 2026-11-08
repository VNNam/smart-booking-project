/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Password Hashing Utility (Zero-dependency using Node.js crypto scrypt)
 * FILE: src/services/auth/PasswordUtil.ts
 * ==============================================================================
 */

import * as crypto from 'crypto';

export class PasswordUtil {
    private static readonly KEY_LEN = 64;

    /**
     * Băm mật khẩu bằng thuật toán scrypt với Salt ngẫu nhiên 16 bytes
     * Định dạng kết quả: salt:hash
     */
    static hashPassword(password: string): string {
        const salt = crypto.randomBytes(16).toString('hex');
        const derivedKey = crypto.scryptSync(password, salt, this.KEY_LEN);
        return `${salt}:${derivedKey.toString('hex')}`;
    }

    /**
     * Xác thực mật khẩu nhập vào so với chuỗi hash đã lưu
     */
    static verifyPassword(password: string, storedHash: string): boolean {
        try {
            if (!storedHash || !storedHash.includes(':')) {
                // Tương thích ngược nếu mật khẩu mẫu là text thuần
                return password === storedHash;
            }
            const [salt, key] = storedHash.split(':');
            const keyBuffer = Buffer.from(key, 'hex');
            const derivedKey = crypto.scryptSync(password, salt, this.KEY_LEN);
            return crypto.timingSafeEqual(keyBuffer, derivedKey);
        } catch (err) {
            console.error('[PasswordUtil] Lỗi xác thực mật khẩu:', err);
            return false;
        }
    }

    /**
     * Sinh mã OTP 6 số ngẫu nhiên
     */
    static generateOtp(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Sinh token đặt lại mật khẩu ngẫu nhiên an toàn cao
     */
    static generateResetToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }
}

