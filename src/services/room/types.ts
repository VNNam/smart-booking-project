/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Room, Pricing & Asset Management Types
 * FILE: src/services/room/types.ts
 * ==============================================================================
 */

export type RoomType = 'STANDARD' | 'EXECUTIVE' | 'BOARDROOM';
export type EquipmentStatus = 'OPERATIONAL' | 'MAINTENANCE' | 'DEFECTIVE';

export interface RoomAmenities {
    projector?: boolean;
    whiteboard?: boolean;
    videoConf?: boolean;
    soundSystem?: boolean;
    smartTv?: boolean;
    highSpeedWifi?: boolean;
    teaCoffee?: boolean;
}

export interface RoomDetailDto {
    id: string;
    branchId: string;
    branchName?: string;
    name: string;
    roomType: RoomType;
    capacity: number;
    hourlyRate: number;
    amenities: RoomAmenities;
    isActive: boolean;
    createdAt: string;
    equipments?: RoomEquipmentDto[];
    pricingRules?: PricingRuleDto[];
}

export interface CreateRoomDto {
    branchId?: string;
    name: string;
    roomType: RoomType;
    capacity: number;
    hourlyRate: number;
    amenities?: RoomAmenities;
}

export interface UpdateRoomDto {
    name?: string;
    roomType?: RoomType;
    capacity?: number;
    hourlyRate?: number;
    amenities?: RoomAmenities;
    isActive?: boolean;
}

export interface PricingRuleDto {
    id?: string;
    roomId: string;
    ruleName: string;
    startHour: string; // "09:00"
    endHour: string;   // "11:00"
    dayOfWeek?: number[]; // [1,2,3,4,5] (1: T2, 0: CN)
    priceMultiplier: number; // 1.25 (tăng 25%)
    fixedSlotPrice?: number;
    isActive: boolean;
}

export interface RoomEquipmentDto {
    id: string;
    roomId: string;
    equipmentName: string;
    serialNumber?: string;
    status: EquipmentStatus;
    isMandatory: boolean;
    installedDate?: string;
    notes?: string;
}

export interface AddEquipmentDto {
    roomId: string;
    equipmentName: string;
    serialNumber?: string;
    status?: EquipmentStatus;
    isMandatory?: boolean;
    notes?: string;
}
