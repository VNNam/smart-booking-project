/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: JWT Authentication & RBAC Guard Middleware
 * FILE: src/middleware/auth.ts
 * ==============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { JwtUtil, JwtPayload } from '../services/auth/JwtUtil';
import { UserRole } from '../services/auth/types';

export interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
}

/**
 * Middleware bảo vệ API bằng JWT Token và phân quyền RBAC
 * @param secretKey Khóa bí mật JWT
 * @param allowedRoles Danh sách các Role được phép truy cập (nếu để trống: chỉ cần đăng nhập)
 */
export function createJwtAuthGuard(
    secretKey = process.env.JWT_SECRET || 'c8f8b3c2980173295847e098df241746b149b1093847af2b6839174628394018',
    allowedRoles?: UserRole[]
) {
    return function jwtAuthGuard(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): void {
        const authHeader = req.header('Authorization') || req.header('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                code: 'UNAUTHORIZED',
                message: 'Vui lòng đăng nhập để truy cập tài nguyên này (Yêu cầu Authorization: Bearer <token>).'
            });
            return;
        }

        const token = authHeader.substring(7).trim();
        const payload = JwtUtil.verify(token, secretKey);

        if (!payload) {
            res.status(401).json({
                code: 'INVALID_TOKEN',
                message: 'Phiên đăng nhập đã hết hạn hoặc mã xác thực không hợp lệ. Vui lòng đăng nhập lại.'
            });
            return;
        }

        // Kiểm tra phân quyền RBAC
        if (allowedRoles && allowedRoles.length > 0) {
            if (!allowedRoles.includes(payload.role)) {
                res.status(403).json({
                    code: 'FORBIDDEN',
                    message: `Tài khoản với quyền [${payload.role}] không được phép thực hiện thao tác này.`
                });
                return;
            }
        }

        // Gắn thông tin người dùng vào request context
        req.user = payload;
        next();
    };
}
