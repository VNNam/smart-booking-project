/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Web Admin - Room Catalog & Maintenance Persistent Store
 * FILE: frontend/admin/lib/roomStore.ts
 * MÔ TẢ: Quản lý đồng bộ dữ liệu phòng họp giữa các trang Admin (Quản lý phòng & Thu tiền mặt).
 *       Tự động lưu trữ vào LocalStorage để không bị mất khi F5, phát sự kiện đồng bộ
 *       đa tab và gửi request cập nhật đến Backend API.
 * ==============================================================================
 */

export interface RoomItem {
    id: string;
    name: string;
    roomType: 'STANDARD' | 'EXECUTIVE' | 'BOARDROOM';
    capacity: number;
    hourlyRate: number;
    amenities: {
        projector?: boolean;
        whiteboard?: boolean;
        videoConf?: boolean;
        soundSystem?: boolean;
        smartTv?: boolean;
        highSpeedWifi?: boolean;
    };
    isActive: boolean;
    maintenanceReason?: string;
}

const STORAGE_KEY = 'smart_booking_rooms_catalog_v1';
const EVENT_KEY = 'smart_booking_rooms_changed';

export const DEFAULT_ROOMS: RoomItem[] = [
    {
        id: 'r0000000-0000-0000-0000-000000000001',
        name: 'Meeting Room Alpha',
        roomType: 'STANDARD',
        capacity: 8,
        hourlyRate: 350000,
        amenities: { projector: true, whiteboard: true, highSpeedWifi: true },
        isActive: true
    },
    {
        id: 'r0000000-0000-0000-0000-000000000002',
        name: 'Executive Boardroom Tokyo',
        roomType: 'EXECUTIVE',
        capacity: 16,
        hourlyRate: 650000,
        amenities: { projector: true, whiteboard: true, videoConf: true, soundSystem: true, highSpeedWifi: true },
        isActive: true
    },
    {
        id: 'r0000000-0000-0000-0000-000000000003',
        name: 'Boardroom New York',
        roomType: 'BOARDROOM',
        capacity: 24,
        hourlyRate: 1200000,
        amenities: { projector: true, whiteboard: true, videoConf: true, soundSystem: true, smartTv: true, highSpeedWifi: true },
        isActive: false, // Mặc định đang bảo trì kiểm kê
        maintenanceReason: 'Đang bảo dưỡng định kỳ hệ thống âm thanh & máy chiếu'
    }
];

export const roomStore = {
    /**
     * Lấy danh sách phòng (Ưu tiên từ LocalStorage để giữ trạng thái sau khi F5)
     */
    getRooms(): RoomItem[] {
        if (typeof window === 'undefined') return DEFAULT_ROOMS;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ROOMS));
                return DEFAULT_ROOMS;
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ROOMS;
        } catch {
            return DEFAULT_ROOMS;
        }
    },

    /**
     * Lấy danh sách các phòng ĐANG HOẠT ĐỘNG (Dùng cho Lễ tân thu tiền mặt)
     */
    getActiveRooms(): RoomItem[] {
        return this.getRooms().filter(r => r.isActive);
    },

    /**
     * Lưu danh sách phòng vào LocalStorage và phát sự kiện đồng bộ
     */
    saveRooms(rooms: RoomItem[]): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
            window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: rooms }));
        } catch (e) {
            console.error('Không thể lưu rooms vào localStorage', e);
        }
    },

    /**
     * Chuyển đổi trạng thái Bảo trì / Mở lại phòng
     * Tự động gửi API đến backend và cập nhật LocalStorage
     */
    async toggleMaintenance(roomId: string, reason?: string): Promise<RoomItem | null> {
        const rooms = this.getRooms();
        const targetIndex = rooms.findIndex(r => r.id === roomId);
        if (targetIndex === -1) return null;

        const currentStatus = rooms[targetIndex].isActive;
        const newStatus = !currentStatus; // true: mở lại, false: tạm ngưng bảo trì

        rooms[targetIndex] = {
            ...rooms[targetIndex],
            isActive: newStatus,
            maintenanceReason: newStatus ? undefined : (reason || 'Bảo trì kỹ thuật định kỳ')
        };

        this.saveRooms(rooms);

        // Gọi Backend API nếu có
        try {
            await fetch(`/api/admin/rooms/${roomId}/maintenance`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isMaintenance: !newStatus, reason })
            }).catch(() => {
                // Ignore network error if backend is offline in standalone UI mode
            });
        } catch {
            // Safe fallback
        }

        return rooms[targetIndex];
    },

    /**
     * Thêm phòng mới
     */
    addRoom(room: Omit<RoomItem, 'id'>): RoomItem {
        const rooms = this.getRooms();
        const newRoom: RoomItem = {
            ...room,
            id: `r-${Date.now()}`
        };
        const updated = [...rooms, newRoom];
        this.saveRooms(updated);
        return newRoom;
    },

    /**
     * Cập nhật thông tin phòng
     */
    updateRoom(id: string, updates: Partial<RoomItem>): RoomItem | null {
        const rooms = this.getRooms();
        const index = rooms.findIndex(r => r.id === id);
        if (index === -1) return null;

        rooms[index] = { ...rooms[index], ...updates };
        this.saveRooms(rooms);
        return rooms[index];
    },

    /**
     * Đăng ký lắng nghe sự kiện thay đổi phòng giữa các trang/tab
     */
    subscribe(callback: (rooms: RoomItem[]) => void): () => void {
        if (typeof window === 'undefined') return () => {};

        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<RoomItem[]>;
            callback(customEvent.detail || this.getRooms());
        };

        const storageHandler = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                callback(this.getRooms());
            }
        };

        window.addEventListener(EVENT_KEY, handler);
        window.addEventListener('storage', storageHandler);

        return () => {
            window.removeEventListener(EVENT_KEY, handler);
            window.removeEventListener('storage', storageHandler);
        };
    }
};

