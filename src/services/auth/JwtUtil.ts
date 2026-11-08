/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: JWT Token Utility (Zero-dependency HMAC-SHA256 Implementation)
 * FILE: src/services/auth/JwtUtil.ts
 * ==============================================================================
 */

import * as crypto from 'crypto';
import { UserRole } from './types';

export interface JwtPayload {
    sub: string;       // User ID
    email: string;
    phone: string;
    role: UserRole;
    companyId?: string | null;
    iat: number;
    exp: number;
}

export class JwtUtil {
    private static base64UrlEncode(str: string | Buffer): string {
        const buffer = Buffer.isBuffer(str) ? str : Buffer.from(str);
        return buffer
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }

    private static base64UrlDecode(str: string): string {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        return Buffer.from(base64, 'base64').toString('utf8');
    }

    /**
     * Ký JWT Token với Secret Key
     */
    static sign(payload: Omit<JwtPayload, 'iat' | 'exp'>, secretKey: string, expiresInSeconds: number): string {
        const now = Math.floor(Date.now() / 1000);
        const fullPayload: JwtPayload = {
            ...payload,
            iat: now,
            exp: now + expiresInSeconds
        };

        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };

        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
        const dataToSign = `${encodedHeader}.${encodedPayload}`;

        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(dataToSign)
            .digest();

        const encodedSignature = this.base64UrlEncode(signature);
        return `${dataToSign}.${encodedSignature}`;
    }

    /**
     * Xác thực và giải mã JWT Token
     */
    static verify(token: string, secretKey: string): JwtPayload | null {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;

            const [encodedHeader, encodedPayload, encodedSignature] = parts;
            const dataToSign = `${encodedHeader}.${encodedPayload}`;

            const expectedSignature = crypto
                .createHmac('sha256', secretKey)
                .update(dataToSign)
                .digest();

            const actualSignature = Buffer.from(
                encodedSignature.replace(/-/g, '+').replace(/_/g, '/'),
                'base64'
            );

            if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) {
                return null;
            }

            const payload: JwtPayload = JSON.parse(this.base64UrlDecode(encodedPayload));
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
                // Token đã hết hạn
                return null;
            }

            return payload;
        } catch (err) {
            return null;
        }
    }
}

