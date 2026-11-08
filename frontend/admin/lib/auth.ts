/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Web Admin Authentication & Session Helper
 * FILE: frontend/admin/lib/auth.ts
 * ==============================================================================
 */

export type UserRole = 'CUSTOMER' | 'MEMBER' | 'STAFF' | 'ADMIN';

export interface AdminUser {
    id: string;
    email: string;
    phone: string;
    fullName: string;
    role: UserRole;
    creditLimit?: number;
    currentDebt?: number;
    companyId?: string | null;
}

const TOKEN_KEY = 'smart_booking_token';
const USER_KEY = 'smart_booking_user';

export const AuthManager = {
    setSession(token: string, user: AdminUser): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(TOKEN_KEY);
    },

    getUser(): AdminUser | null {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(USER_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    isAuthenticated(): boolean {
        return !!this.getToken();
    },

    clearSession(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }
};

