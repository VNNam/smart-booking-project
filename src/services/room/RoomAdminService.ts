/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Room, Dynamic Pricing & Asset Management Service
 * FILE: src/services/room/RoomAdminService.ts
 * MÔ TẢ: Cung cấp đầy đủ các tác vụ quản trị danh mục phòng họp (CRUD), cấu hình
 *       bảng giá động (Dynamic Pricing - Giờ cao điểm/Cuối tuần) và quản lý vòng
 *       đời trang thiết bị đi kèm (Asset Management).
 * ==============================================================================
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
    RoomDetailDto,
    CreateRoomDto,
    UpdateRoomDto,
    PricingRuleDto,
    RoomEquipmentDto,
    AddEquipmentDto,
    EquipmentStatus
} from './types';

export class RoomAdminService {
    constructor(private readonly dbPool: Pool) {}

    /**
     * 1. LẤY DANH SÁCH TẤT CẢ PHÒNG HỌP (KÈM BỘ LỌC)
     */
    async listRooms(filters?: { branchId?: string; isActive?: boolean; roomType?: string }): Promise<RoomDetailDto[]> {
        let query = `
            SELECT 
                r.id, r.branch_id, b.name AS branch_name, r.name,
                r.room_type, r.capacity, r.hourly_rate, r.amenities,
                r.is_active, r.created_at
            FROM rooms r
            LEFT JOIN branches b ON b.id = r.branch_id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (filters?.branchId) {
            params.push(filters.branchId);
            query += ` AND r.branch_id = $${params.length}`;
        }
        if (filters?.isActive !== undefined) {
            params.push(filters.isActive);
            query += ` AND r.is_active = $${params.length}`;
        }
        if (filters?.roomType) {
            params.push(filters.roomType);
            query += ` AND r.room_type = $${params.length}`;
        }

        query += ` ORDER BY r.name ASC;`;

        const res = await this.dbPool.query(query, params);
        return res.rows.map(row => ({
            id: row.id,
            branchId: row.branch_id,
            branchName: row.branch_name || 'Chi nhánh Trung tâm',
            name: row.name,
            roomType: row.room_type,
            capacity: row.capacity,
            hourlyRate: parseFloat(row.hourly_rate),
            amenities: row.amenities || {},
            isActive: row.is_active,
            createdAt: row.created_at
        }));
    }

    /**
     * 2. LẤY CHI TIẾT 1 PHÒNG HỌP KÈM THIẾT BỊ VÀ BẢNG GIÁ
     */
    async getRoomDetail(roomId: string): Promise<RoomDetailDto | null> {
        const roomQuery = `
            SELECT 
                r.id, r.branch_id, b.name AS branch_name, r.name,
                r.room_type, r.capacity, r.hourly_rate, r.amenities,
                r.is_active, r.created_at
            FROM rooms r
            LEFT JOIN branches b ON b.id = r.branch_id
            WHERE r.id = $1
            LIMIT 1;
        `;
        const res = await this.dbPool.query(roomQuery, [roomId]);
        if (res.rows.length === 0) return null;

        const row = res.rows[0];
        const equipments = await this.getEquipmentsByRoom(roomId);
        const pricingRules = await this.getPricingRules(roomId);

        return {
            id: row.id,
            branchId: row.branch_id,
            branchName: row.branch_name || 'Chi nhánh Trung tâm',
            name: row.name,
            roomType: row.room_type,
            capacity: row.capacity,
            hourlyRate: parseFloat(row.hourly_rate),
            amenities: row.amenities || {},
            isActive: row.is_active,
            createdAt: row.created_at,
            equipments,
            pricingRules
        };
    }

    /**
     * 3. TẠO PHÒNG HỌP MỚI
     */
    async createRoom(dto: CreateRoomDto): Promise<RoomDetailDto> {
        const client: PoolClient = await this.dbPool.connect();
        try {
            await client.query('BEGIN');

            let branchId = dto.branchId;
            if (!branchId) {
                // Lấy chi nhánh mặc định đầu tiên nếu không truyền
                const branchRes = await client.query('SELECT id FROM branches LIMIT 1');
                if (branchRes.rows.length > 0) {
                    branchId = branchRes.rows[0].id;
                } else {
                    const newBranchId = uuidv4();
                    await client.query(`
                        INSERT INTO branches (id, name, address, phone, is_active)
                        VALUES ($1, 'Chi nhánh Hội sở Landmark', '720A Điện Biên Phủ, Bình Thạnh, TP.HCM', '02812345678', TRUE);
                    `, [newBranchId]);
                    branchId = newBranchId;
                }
            }

            const roomId = uuidv4();
            const defaultAmenities = dto.amenities || {
                projector: true,
                whiteboard: true,
                videoConf: dto.roomType === 'BOARDROOM',
                highSpeedWifi: true
            };

            const insertQuery = `
                INSERT INTO rooms (
                    id, branch_id, name, room_type, capacity, hourly_rate, amenities, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
                RETURNING id, branch_id, name, room_type, capacity, hourly_rate, amenities, is_active, created_at;
            `;
            const roomRes = await client.query(insertQuery, [
                roomId, branchId, dto.name.trim(), dto.roomType, dto.capacity, dto.hourlyRate, JSON.stringify(defaultAmenities)
            ]);

            // Tự động sinh khung giờ mẫu (08:00 - 21:00) cho ngày hôm nay và ngày mai
            await this.generateSlotsForRoom(client, roomId, 2);

            await client.query('COMMIT');

            const row = roomRes.rows[0];
            return {
                id: row.id,
                branchId: row.branch_id,
                name: row.name,
                roomType: row.room_type,
                capacity: row.capacity,
                hourlyRate: parseFloat(row.hourly_rate),
                amenities: row.amenities,
                isActive: row.is_active,
                createdAt: row.created_at
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * 4. CẬP NHẬT THÔNG TIN PHÒNG
     */
    async updateRoom(roomId: string, dto: UpdateRoomDto): Promise<RoomDetailDto> {
        const fields: string[] = [];
        const values: any[] = [];

        if (dto.name !== undefined) {
            values.push(dto.name.trim());
            fields.push(`name = $${values.length}`);
        }
        if (dto.roomType !== undefined) {
            values.push(dto.roomType);
            fields.push(`room_type = $${values.length}`);
        }
        if (dto.capacity !== undefined) {
            values.push(dto.capacity);
            fields.push(`capacity = $${values.length}`);
        }
        if (dto.hourlyRate !== undefined) {
            values.push(dto.hourlyRate);
            fields.push(`hourly_rate = $${values.length}`);
        }
        if (dto.amenities !== undefined) {
            values.push(JSON.stringify(dto.amenities));
            fields.push(`amenities = $${values.length}`);
        }
        if (dto.isActive !== undefined) {
            values.push(dto.isActive);
            fields.push(`is_active = $${values.length}`);
        }

        if (fields.length === 0) {
            const current = await this.getRoomDetail(roomId);
            if (!current) throw new Error('Không tìm thấy phòng họp.');
            return current;
        }

        values.push(roomId);
        const updateQuery = `
            UPDATE rooms 
            SET ${fields.join(', ')} 
            WHERE id = $${values.length}
            RETURNING id, branch_id, name, room_type, capacity, hourly_rate, amenities, is_active, created_at;
        `;
        const res = await this.dbPool.query(updateQuery, values);
        if (res.rows.length === 0) {
            throw new Error('Không tìm thấy phòng họp để cập nhật.');
        }

        const row = res.rows[0];
        return {
            id: row.id,
            branchId: row.branch_id,
            name: row.name,
            roomType: row.room_type,
            capacity: row.capacity,
            hourlyRate: parseFloat(row.hourly_rate),
            amenities: row.amenities,
            isActive: row.is_active,
            createdAt: row.created_at
        };
    }

    /**
     * 5. THIẾT LẬP CHẾ ĐỘ BẢO TRÌ PHÒNG (MAINTENANCE TOGGLE)
     */
    async setRoomMaintenance(roomId: string, isMaintenance: boolean, reason = 'Bảo trì định kỳ'): Promise<{ success: boolean; message: string }> {
        const client: PoolClient = await this.dbPool.connect();
        try {
            await client.query('BEGIN');

            // Cập nhật trạng thái phòng
            await client.query('UPDATE rooms SET is_active = $1 WHERE id = $2', [!isMaintenance, roomId]);

            if (isMaintenance) {
                // Đổi các slot trống (AVAILABLE) chưa ai đặt sang trạng thái MAINTENANCE
                await client.query(`
                    UPDATE slots 
                    SET status = 'MAINTENANCE' 
                    WHERE room_id = $1 AND status = 'AVAILABLE';
                `, [roomId]);
            } else {
                // Mở lại các slot bảo trì về AVAILABLE
                await client.query(`
                    UPDATE slots 
                    SET status = 'AVAILABLE' 
                    WHERE room_id = $1 AND status = 'MAINTENANCE';
                `, [roomId]);
            }

            // Ghi nhật ký kiểm toán Outbox
            await client.query(`
                INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                VALUES ('ROOM', $1, $2, $3, 'PENDING');
            `, [roomId, isMaintenance ? 'ROOM_SET_MAINTENANCE' : 'ROOM_RESTORED_ACTIVE', JSON.stringify({ reason })]);

            await client.query('COMMIT');
            return {
                success: true,
                message: isMaintenance ? `Phòng đã chuyển sang chế độ bảo trì: ${reason}` : 'Phòng đã được kích hoạt hoạt động trở lại.'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * 6. QUẢN LÝ QUY TẮC ĐỊNH GIÁ ĐỘNG (DYNAMIC PRICING RULES)
     */
    async createPricingRule(dto: PricingRuleDto): Promise<PricingRuleDto> {
        // Đảm bảo bảng room_pricing_rules tồn tại
        await this.ensurePricingTableExists();

        const id = uuidv4();
        const insertQuery = `
            INSERT INTO room_pricing_rules (
                id, room_id, rule_name, start_hour, end_hour, price_multiplier, fixed_slot_price, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, room_id, rule_name, start_hour, end_hour, price_multiplier, fixed_slot_price, is_active;
        `;
        const res = await this.dbPool.query(insertQuery, [
            id, dto.roomId, dto.ruleName, dto.startHour, dto.endHour, dto.priceMultiplier, dto.fixedSlotPrice || null, dto.isActive !== false
        ]);

        const r = res.rows[0];
        return {
            id: r.id,
            roomId: r.room_id,
            ruleName: r.rule_name,
            startHour: r.start_hour,
            endHour: r.end_hour,
            priceMultiplier: parseFloat(r.price_multiplier),
            fixedSlotPrice: r.fixed_slot_price ? parseFloat(r.fixed_slot_price) : undefined,
            isActive: r.is_active
        };
    }

    async getPricingRules(roomId: string): Promise<PricingRuleDto[]> {
        await this.ensurePricingTableExists();
        const res = await this.dbPool.query('SELECT * FROM room_pricing_rules WHERE room_id = $1 ORDER BY start_hour ASC', [roomId]);
        return res.rows.map(r => ({
            id: r.id,
            roomId: r.room_id,
            ruleName: r.rule_name,
            startHour: r.start_hour,
            endHour: r.end_hour,
            priceMultiplier: parseFloat(r.price_multiplier),
            fixedSlotPrice: r.fixed_slot_price ? parseFloat(r.fixed_slot_price) : undefined,
            isActive: r.is_active
        }));
    }

    /**
     * 7. TÍNH TOÁN GIÁ SLOT ĐỘNG DỰA TRÊN QUY TẮC GIỜ CAO ĐIỂM
     */
    async calculateSlotPrice(roomId: string, startTime: Date, baseHourlyRate: number): Promise<number> {
        const rules = await this.getPricingRules(roomId);
        if (rules.length === 0) return baseHourlyRate;

        const hours = startTime.getHours().toString().padStart(2, '0') + ':00';

        for (const rule of rules) {
            if (!rule.isActive) continue;
            if (hours >= rule.startHour && hours < rule.endHour) {
                if (rule.fixedSlotPrice) return rule.fixedSlotPrice;
                return baseHourlyRate * rule.priceMultiplier;
            }
        }
        return baseHourlyRate;
    }

    /**
     * 8. QUẢN LÝ TRANG THIẾT BỊ / TÀI SẢN (ASSET MANAGEMENT)
     */
    async addEquipment(dto: AddEquipmentDto): Promise<RoomEquipmentDto> {
        await this.ensureEquipmentTableExists();
        const id = uuidv4();
        const insertQuery = `
            INSERT INTO room_equipment (
                id, room_id, equipment_name, serial_number, status, is_mandatory, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, room_id, equipment_name, serial_number, status, is_mandatory, notes, created_at;
        `;
        const res = await this.dbPool.query(insertQuery, [
            id, dto.roomId, dto.equipmentName.trim(), dto.serialNumber || null, dto.status || 'OPERATIONAL', dto.isMandatory || false, dto.notes || null
        ]);

        const r = res.rows[0];
        return {
            id: r.id,
            roomId: r.room_id,
            equipmentName: r.equipment_name,
            serialNumber: r.serial_number,
            status: r.status,
            isMandatory: r.is_mandatory,
            notes: r.notes
        };
    }

    async getEquipmentsByRoom(roomId: string): Promise<RoomEquipmentDto[]> {
        await this.ensureEquipmentTableExists();
        const res = await this.dbPool.query('SELECT * FROM room_equipment WHERE room_id = $1 ORDER BY equipment_name ASC', [roomId]);
        return res.rows.map(r => ({
            id: r.id,
            roomId: r.room_id,
            equipmentName: r.equipment_name,
            serialNumber: r.serial_number,
            status: r.status,
            isMandatory: r.is_mandatory,
            notes: r.notes
        }));
    }

    async updateEquipmentStatus(equipmentId: string, status: EquipmentStatus, notes?: string): Promise<boolean> {
        await this.ensureEquipmentTableExists();
        await this.dbPool.query(`
            UPDATE room_equipment 
            SET status = $1, notes = COALESCE($2, notes) 
            WHERE id = $3;
        `, [status, notes || null, equipmentId]);
        return true;
    }

    /**
     * Tự động sinh slot giờ (08:00 -> 21:00) cho N ngày tới
     */
    private async generateSlotsForRoom(client: PoolClient, roomId: string, daysAhead = 2): Promise<void> {
        const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
        const now = new Date();

        for (let d = 0; d < daysAhead; d++) {
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + d);

            for (const h of hours) {
                const startTime = new Date(targetDate);
                startTime.setHours(h, 0, 0, 0);

                const endTime = new Date(targetDate);
                endTime.setHours(h + 1, 0, 0, 0);

                const slotId = uuidv4();
                await client.query(`
                    INSERT INTO slots (id, room_id, start_time, end_time, status)
                    VALUES ($1, $2, $3, $4, 'AVAILABLE')
                    ON CONFLICT DO NOTHING;
                `, [slotId, roomId, startTime.toISOString(), endTime.toISOString()]);
            }
        }
    }

    private async ensurePricingTableExists(): Promise<void> {
        await this.dbPool.query(`
            CREATE TABLE IF NOT EXISTS room_pricing_rules (
                id UUID PRIMARY KEY,
                room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
                rule_name VARCHAR(100) NOT NULL,
                start_hour VARCHAR(10) NOT NULL,
                end_hour VARCHAR(10) NOT NULL,
                price_multiplier DECIMAL(5,2) DEFAULT 1.00,
                fixed_slot_price DECIMAL(12,2),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    private async ensureEquipmentTableExists(): Promise<void> {
        await this.dbPool.query(`
            CREATE TABLE IF NOT EXISTS room_equipment (
                id UUID PRIMARY KEY,
                room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
                equipment_name VARCHAR(150) NOT NULL,
                serial_number VARCHAR(100),
                status VARCHAR(30) DEFAULT 'OPERATIONAL',
                is_mandatory BOOLEAN DEFAULT FALSE,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }
}
