/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Web Admin - Room Catalog, Dynamic Pricing & Equipment Store
 * FILE: frontend/admin/lib/roomStore.ts
 * MÔ TẢ: Quản lý đồng bộ dữ liệu phòng họp, bảng giá động theo khung giờ và tài sản
 *       thiết bị. Tự động lưu trữ vào LocalStorage để không bị mất khi F5, phát sự kiện
 *       đồng bộ liên trang và hỗ trợ đầy đủ thao tác Thêm, Sửa, Xóa, Cập nhật trạng thái.
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

export interface PricingRuleItem {
    id: string;
    roomName: string;
    ruleName: string;
    startTime: string; // e.g. "09:00"
    endTime: string;   // e.g. "11:00"
    applicableDays: string; // e.g. "Tất cả các ngày", "Thứ 2 - Thứ 6", "Thứ 7 & CN"
    multiplier: number; // e.g. 1.25
    isActive: boolean;
}

export interface EquipmentItem {
    id: string;
    roomId: string;
    roomName: string;
    equipmentName: string;
    serialNumber: string;
    quantity: number;
    status: 'OPERATIONAL' | 'MAINTENANCE' | 'DEFECTIVE';
    notes?: string;
}

const STORAGE_KEY_ROOMS = 'smart_booking_rooms_catalog_v1';
const STORAGE_KEY_PRICING = 'smart_booking_pricing_rules_v1';
const STORAGE_KEY_EQUIPMENT = 'smart_booking_equipments_v1';

const EVENT_ROOMS_CHANGED = 'smart_booking_rooms_changed';
const EVENT_PRICING_CHANGED = 'smart_booking_pricing_changed';
const EVENT_EQUIPMENT_CHANGED = 'smart_booking_equipment_changed';

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

export const DEFAULT_PRICING_RULES: PricingRuleItem[] = [
    {
        id: 'pr-01',
        roomName: 'Tất cả các phòng',
        ruleName: 'Giờ Vàng Cao Điểm Buổi Sáng',
        startTime: '09:00',
        endTime: '11:00',
        applicableDays: 'Thứ 2 - Thứ 6',
        multiplier: 1.25,
        isActive: true
    },
    {
        id: 'pr-02',
        roomName: 'Tất cả các phòng',
        ruleName: 'Giờ Vàng Cao Điểm Buổi Chiều',
        startTime: '14:00',
        endTime: '16:00',
        applicableDays: 'Thứ 2 - Thứ 6',
        multiplier: 1.25,
        isActive: true
    },
    {
        id: 'pr-03',
        roomName: 'Executive & Boardroom',
        ruleName: 'Phụ thu Ngoài giờ & Cuối tuần',
        startTime: '18:00',
        endTime: '21:00',
        applicableDays: 'Thứ 7 & CN',
        multiplier: 1.15,
        isActive: true
    }
];

export const DEFAULT_EQUIPMENTS: EquipmentItem[] = [
    {
        id: 'eq-01',
        roomId: 'r0000000-0000-0000-0000-000000000001',
        roomName: 'Meeting Room Alpha',
        equipmentName: 'Máy chiếu Epson 1080p Laser',
        serialNumber: 'EPS-2026-001',
        quantity: 1,
        status: 'OPERATIONAL',
        notes: 'Hình ảnh sắc nét, vừa bảo trì định kỳ'
    },
    {
        id: 'eq-02',
        roomId: 'r0000000-0000-0000-0000-000000000001',
        roomName: 'Meeting Room Alpha',
        equipmentName: 'Bảng kính từ tính 2.4m',
        serialNumber: 'GLS-2026-002',
        quantity: 1,
        status: 'OPERATIONAL'
    },
    {
        id: 'eq-03',
        roomId: 'r0000000-0000-0000-0000-000000000002',
        roomName: 'Executive Boardroom Tokyo',
        equipmentName: 'Camera Hội Nghị Logitech Rally 4K Ultra-HD',
        serialNumber: 'LOG-4K-9901',
        quantity: 1,
        status: 'OPERATIONAL',
        notes: 'Auto-framing hoạt động tốt'
    },
    {
        id: 'eq-04',
        roomId: 'r0000000-0000-0000-0000-000000000002',
        roomName: 'Executive Boardroom Tokyo',
        equipmentName: 'Loa hội nghị Jabra Speak 710',
        serialNumber: 'JAB-710-332',
        quantity: 2,
        status: 'MAINTENANCE',
        notes: 'Chờ thay cáp sạc USB-C'
    },
    {
        id: 'eq-05',
        roomId: 'r0000000-0000-0000-0000-000000000003',
        roomName: 'Boardroom New York',
        equipmentName: 'Màn hình cảm ứng tương tác Maxhub 86" 4K',
        serialNumber: 'MAX-86-888',
        quantity: 1,
        status: 'DEFECTIVE',
        notes: 'Bị lỗi cảm ứng góc trái, đã liên hệ bảo hành'
    }
];

export const roomStore = {
    // =========================================================================
    // 1. QUẢN LÝ PHÒNG HỌP (ROOMS)
    // =========================================================================
    getRooms(): RoomItem[] {
        if (typeof window === 'undefined') return DEFAULT_ROOMS;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_ROOMS);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY_ROOMS, JSON.stringify(DEFAULT_ROOMS));
                return DEFAULT_ROOMS;
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ROOMS;
        } catch {
            return DEFAULT_ROOMS;
        }
    },

    getActiveRooms(): RoomItem[] {
        return this.getRooms().filter(r => r.isActive);
    },

    saveRooms(rooms: RoomItem[]): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY_ROOMS, JSON.stringify(rooms));
            window.dispatchEvent(new CustomEvent(EVENT_ROOMS_CHANGED, { detail: rooms }));
        } catch (e) {
            console.error('Không thể lưu rooms vào localStorage', e);
        }
    },

    async toggleMaintenance(roomId: string, reason?: string): Promise<RoomItem | null> {
        const rooms = this.getRooms();
        const targetIndex = rooms.findIndex(r => r.id === roomId);
        if (targetIndex === -1) return null;

        const currentStatus = rooms[targetIndex].isActive;
        const newStatus = !currentStatus;

        rooms[targetIndex] = {
            ...rooms[targetIndex],
            isActive: newStatus,
            maintenanceReason: newStatus ? undefined : (reason || 'Bảo trì kỹ thuật định kỳ')
        };

        this.saveRooms(rooms);

        try {
            await fetch(`/api/admin/rooms/${roomId}/maintenance`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isMaintenance: !newStatus, reason })
            }).catch(() => {});
        } catch {}

        return rooms[targetIndex];
    },

    addRoom(room: Omit<RoomItem, 'id'>): RoomItem {
        const rooms = this.getRooms();
        const generatedUuid = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `r0000000-0000-0000-0000-${Date.now().toString().slice(-12).padStart(12, '0')}`;
        const newRoom: RoomItem = {
            ...room,
            id: generatedUuid
        };
        const updated = [...rooms, newRoom];
        this.saveRooms(updated);
        return newRoom;
    },

    updateRoom(id: string, updates: Partial<RoomItem>): RoomItem | null {
        const rooms = this.getRooms();
        const index = rooms.findIndex(r => r.id === id);
        if (index === -1) return null;

        rooms[index] = { ...rooms[index], ...updates };
        this.saveRooms(rooms);
        return rooms[index];
    },

    deleteRoom(id: string): boolean {
        const rooms = this.getRooms();
        const updated = rooms.filter(r => r.id !== id);
        this.saveRooms(updated);
        return true;
    },

    // =========================================================================
    // 2. QUẢN LÝ BẢNG GIÁ ĐỘNG & KHUNG GIỜ (DYNAMIC PRICING RULES)
    // =========================================================================
    getPricingRules(): PricingRuleItem[] {
        if (typeof window === 'undefined') return DEFAULT_PRICING_RULES;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PRICING);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY_PRICING, JSON.stringify(DEFAULT_PRICING_RULES));
                return DEFAULT_PRICING_RULES;
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRICING_RULES;
        } catch {
            return DEFAULT_PRICING_RULES;
        }
    },

    savePricingRules(rules: PricingRuleItem[]): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY_PRICING, JSON.stringify(rules));
            window.dispatchEvent(new CustomEvent(EVENT_PRICING_CHANGED, { detail: rules }));
        } catch (e) {
            console.error('Không thể lưu pricing rules', e);
        }
    },

    addPricingRule(rule: Omit<PricingRuleItem, 'id'>): PricingRuleItem {
        const rules = this.getPricingRules();
        const newRule: PricingRuleItem = {
            ...rule,
            id: `pr-${Date.now()}`
        };
        const updated = [...rules, newRule];
        this.savePricingRules(updated);
        return newRule;
    },

    updatePricingRule(id: string, updates: Partial<PricingRuleItem>): PricingRuleItem | null {
        const rules = this.getPricingRules();
        const index = rules.findIndex(r => r.id === id);
        if (index === -1) return null;

        rules[index] = { ...rules[index], ...updates };
        this.savePricingRules(rules);
        return rules[index];
    },

    deletePricingRule(id: string): boolean {
        const rules = this.getPricingRules();
        const updated = rules.filter(r => r.id !== id);
        this.savePricingRules(updated);
        return true;
    },

    togglePricingRule(id: string): PricingRuleItem | null {
        const rules = this.getPricingRules();
        const index = rules.findIndex(r => r.id === id);
        if (index === -1) return null;

        rules[index] = { ...rules[index], isActive: !rules[index].isActive };
        this.savePricingRules(rules);
        return rules[index];
    },

    // =========================================================================
    // 3. QUẢN LÝ TÀI SẢN & TRANG THIẾT BỊ (EQUIPMENT & ASSETS)
    // =========================================================================
    getEquipments(): EquipmentItem[] {
        if (typeof window === 'undefined') return DEFAULT_EQUIPMENTS;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_EQUIPMENT);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(DEFAULT_EQUIPMENTS));
                return DEFAULT_EQUIPMENTS;
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_EQUIPMENTS;
        } catch {
            return DEFAULT_EQUIPMENTS;
        }
    },

    saveEquipments(equipments: EquipmentItem[]): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(equipments));
            window.dispatchEvent(new CustomEvent(EVENT_EQUIPMENT_CHANGED, { detail: equipments }));
        } catch (e) {
            console.error('Không thể lưu equipments', e);
        }
    },

    addEquipment(eq: Omit<EquipmentItem, 'id'>): EquipmentItem {
        const equipments = this.getEquipments();
        const newEq: EquipmentItem = {
            ...eq,
            id: `eq-${Date.now()}`
        };
        const updated = [...equipments, newEq];
        this.saveEquipments(updated);
        return newEq;
    },

    updateEquipment(id: string, updates: Partial<EquipmentItem>): EquipmentItem | null {
        const equipments = this.getEquipments();
        const index = equipments.findIndex(e => e.id === id);
        if (index === -1) return null;

        equipments[index] = { ...equipments[index], ...updates };
        this.saveEquipments(updated => updated); // sync
        this.saveEquipments(equipments);
        return equipments[index];
    },

    deleteEquipment(id: string): boolean {
        const equipments = this.getEquipments();
        const updated = equipments.filter(e => e.id !== id);
        this.saveEquipments(updated);
        return true;
    },

    updateEquipmentStatus(id: string, newStatus: 'OPERATIONAL' | 'MAINTENANCE' | 'DEFECTIVE'): EquipmentItem | null {
        return this.updateEquipment(id, { status: newStatus });
    },

    // =========================================================================
    // 4. LẮNG NGHE SỰ KIỆN LIÊN TRANG (MULTI-TAB SUBSCRIPTION)
    // =========================================================================
    subscribe(callback: (rooms: RoomItem[]) => void): () => void {
        if (typeof window === 'undefined') return () => {};

        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<RoomItem[]>;
            callback(customEvent.detail || this.getRooms());
        };

        const storageHandler = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY_ROOMS) {
                callback(this.getRooms());
            }
        };

        window.addEventListener(EVENT_ROOMS_CHANGED, handler);
        window.addEventListener('storage', storageHandler);

        return () => {
            window.removeEventListener(EVENT_ROOMS_CHANGED, handler);
            window.removeEventListener('storage', storageHandler);
        };
    }
};
