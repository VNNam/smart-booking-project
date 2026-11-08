/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Authentication & IAM Types
 * FILE: src/services/auth/types.ts
 * ==============================================================================
 */

export type UserRole = 'CUSTOMER' | 'MEMBER' | 'STAFF' | 'ADMIN';

export interface UserEntity {
    id: string;
    company_id?: string | null;
    email: string;
    phone: string;
    full_name: string;
    password_hash: string;
    role: UserRole;
    credit_limit: number;
    current_debt: number;
    is_active: boolean;
    avatar_url?: string | null;
    last_login_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserProfileDto {
    id: string;
    email: string;
    phone: string;
    fullName: string;
    role: UserRole;
    companyId?: string | null;
    creditLimit: number;
    currentDebt: number;
    walletBalance?: number;
    avatarUrl?: string | null;
    lastLoginAt?: string | null;
}

export interface LoginRequestDto {
    identifier: string; // Email hoặc Số điện thoại
    password: string;
}

export interface LoginResponseDto {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number; // giây
    user: UserProfileDto;
}

export interface RegisterCustomerRequestDto {
    phone: string;
    email: string;
    fullName: string;
    password: string;
    otpCode?: string; // Tùy chọn nếu đã qua bước verify
}

export interface RequestOtpDto {
    channel: 'SMS' | 'EMAIL';
    target: string; // phone hoặc email
    purpose: 'REGISTER' | 'FORGOT_PASSWORD' | 'TWO_MAN_RULE';
}

export interface VerifyOtpDto {
    target: string;
    otpCode: string;
    purpose: 'REGISTER' | 'FORGOT_PASSWORD' | 'TWO_MAN_RULE';
}

export interface ForgotPasswordRequestDto {
    email: string;
}

export interface ResetPasswordRequestDto {
    email: string;
    token: string;
    newPassword: string;
}

export interface ChangePasswordDto {
    userId: string;
    currentPassword: string;
    newPassword: string;
}

export interface CreateInternalUserDto {
    email: string;
    phone: string;
    fullName: string;
    password: string;
    role: 'STAFF' | 'ADMIN';
    companyId?: string | null;
    creditLimit?: number;
}

