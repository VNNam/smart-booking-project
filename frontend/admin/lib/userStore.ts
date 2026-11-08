/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: User & Staff Accounts Persistent Store (Admin Management)
 * FILE: frontend/admin/lib/userStore.ts
 * ==============================================================================
 */

export type AccountRole = 'ADMIN' | 'STAFF_RECEPTION' | 'STAFF_ACCOUNTANT' | 'MEMBER';
export type AccountStatus = 'ACTIVE' | 'LOCKED';

export interface ManagedUser {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: AccountRole;
    status: AccountStatus;
    lastLogin?: string;
    createdAt: string;
}

const STORAGE_KEY_USERS = 'smart_booking_user_accounts_v1';
const EVENT_USERS_CHANGED = 'smart_booking_users_changed';

export const DEFAULT_USERS: ManagedUser[] = [
    {
        id: 'usr-admin-001',
        fullName: 'Nguyễn Văn Quản Trị (Super Admin)',
        email: 'admin@smartbooking.vn',
        phone: '0909000001',
        role: 'ADMIN',
        status: 'ACTIVE',
        lastLogin: '2026-11-08 14:30',
        createdAt: '2026-10-01'
    },
    {
        id: 'usr-staff-001',
        fullName: 'Nguyễn Thu Thảo (Lễ Tân Trưởng)',
        email: 'receptionist@smartbooking.vn',
        phone: '0909000002',
        role: 'STAFF_RECEPTION',
        status: 'ACTIVE',
        lastLogin: '2026-11-08 13:45',
        createdAt: '2026-10-02'
    },
    {
        id: 'usr-staff-002',
        fullName: 'Trần Thị Mai (Kế Toán Viên)',
        email: 'accountant@smartbooking.vn',
        phone: '0909000003',
        role: 'STAFF_ACCOUNTANT',
        status: 'ACTIVE',
        lastLogin: '2026-11-08 11:20',
        createdAt: '2026-10-02'
    },
    {
        id: 'usr-member-001',
        fullName: 'Hoàng Nam (Hội Viên VIP)',
        email: 'member@smartbooking.vn',
        phone: '0901234567',
        role: 'MEMBER',
        status: 'ACTIVE',
        lastLogin: '2026-11-08 10:10',
        createdAt: '2026-10-05'
    }
];

export const userStore = {
    getUsers(): ManagedUser[] {
        if (typeof window === 'undefined') return DEFAULT_USERS;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_USERS);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEFAULT_USERS));
                return DEFAULT_USERS;
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USERS;
        } catch {
            return DEFAULT_USERS;
        }
    },

    saveUsers(users: ManagedUser[]): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
            window.dispatchEvent(new CustomEvent(EVENT_USERS_CHANGED, { detail: users }));
        } catch (e) {
            console.error('Không thể lưu users vào localStorage', e);
        }
    },

    toggleLockUser(userId: string): ManagedUser | null {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return null;

        // Bảo vệ tài khoản Super Admin không được tự khóa
        if (users[index].email === 'admin@smartbooking.vn') {
            throw new Error('Không thể khóa tài khoản Super Admin gốc.');
        }

        const newStatus: AccountStatus = users[index].status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
        users[index] = { ...users[index], status: newStatus };
        this.saveUsers(users);
        return users[index];
    },

    addUser(user: Omit<ManagedUser, 'id' | 'createdAt'>): ManagedUser {
        const users = this.getUsers();
        const newUser: ManagedUser = {
            ...user,
            id: `usr-${Date.now()}`,
            createdAt: new Date().toISOString().split('T')[0]
        };
        const updated = [...users, newUser];
        this.saveUsers(updated);
        return newUser;
    },

    updateUser(id: string, updates: Partial<ManagedUser>): ManagedUser | null {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === id);
        if (index === -1) return null;

        users[index] = { ...users[index], ...updates };
        this.saveUsers(users);
        return users[index];
    },

    deleteUser(id: string): boolean {
        const users = this.getUsers();
        const target = users.find(u => u.id === id);
        if (target?.email === 'admin@smartbooking.vn') {
            throw new Error('Không thể xóa tài khoản Super Admin.');
        }
        const updated = users.filter(u => u.id !== id);
        this.saveUsers(updated);
        return true;
    },

    resetPassword(id: string): boolean {
        const users = this.getUsers();
        const target = users.find(u => u.id === id);
        if (!target) return false;
        // Ghi nhận mật khẩu được reset về mặc định
        return true;
    },

    subscribe(callback: (users: ManagedUser[]) => void): () => void {
        if (typeof window === 'undefined') return () => {};

        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<ManagedUser[]>;
            callback(customEvent.detail || this.getUsers());
        };

        window.addEventListener(EVENT_USERS_CHANGED, handler);
        return () => window.removeEventListener(EVENT_USERS_CHANGED, handler);
    }
};

