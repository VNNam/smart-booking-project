/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Web Admin - Master Booking Calendar Grid Component
 * FILE: frontend/admin/components/CalendarGrid.tsx
 * MÔ TẢ: Bảng lịch đặt phòng tổng thể (Timeline Grid View) theo thời gian thực (08:00 - 22:00)
 *       Hiển thị trực quan trạng thái các Slot phòng họp theo chuẩn BRD v1.4:
 *       - AVAILABLE (Xanh lục): Slot trống
 *       - LOCKED_PENDING_ONLINE (Vàng cam nhấp nháy): Đang giữ chỗ trực tuyến 10 phút (TTL 600s)
 *       - CONFIRMED / CONFIRMED_PAID (Xanh dương): Đã xác nhận thanh toán
 *       - CONFIRMED_DEBT (Tím): Đặt phòng công nợ doanh nghiệp
 *       Tích hợp popover xem chi tiết và kích hoạt RefundModal (Two-Man Rule).
 * ==============================================================================
 */

import React, { useState, useMemo } from 'react';
import RefundModal, { BookingToRefund } from './RefundModal';

// ==============================================================================
// 1. KIỂU DỮ LIỆU & INTERFACES
// ==============================================================================
export type SlotStatus = 'AVAILABLE' | 'LOCKED_PENDING_ONLINE' | 'CONFIRMED' | 'CONFIRMED_PAID' | 'CONFIRMED_DEBT';

export interface RoomData {
    id: string;
    name: string;
    roomType: 'STANDARD' | 'EXECUTIVE' | 'BOARDROOM';
    capacity: number;
    hourlyRate: number;
}

export interface GridSlot {
    id: string;
    roomId: string;
    startTime: string; // ISO string "2026-10-07T08:00:00Z"
    endTime: string;   // ISO string "2026-10-07T09:00:00Z"
    status: SlotStatus;
    bookingId?: string;
    bookingCode?: string;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: 'ONLINE_GATEWAY' | 'PREPAID_WALLET' | 'CASH_ON_ARRIVAL' | 'POSTPAID_DEBT';
    totalAmount?: number;
    lockExpiresAt?: string;
}

export interface CalendarGridProps {
    date: string;
    rooms?: RoomData[];
    slots?: GridSlot[];
    onSelectAvailableSlot?: (roomId: string, slotId: string) => void;
    onRefresh?: () => void;
}

// Khung giờ hiển thị (08:00 -> 21:00)
const TIME_COLUMNS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
];

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// ==============================================================================
// 2. MAIN COMPONENT: CalendarGrid
// ==============================================================================
export default function CalendarGrid({
    date,
    rooms = [
        { id: 'r-01', name: 'Meeting Room Alpha', roomType: 'STANDARD', capacity: 8, hourlyRate: 350000 },
        { id: 'r-02', name: 'Executive Room Tokyo', roomType: 'EXECUTIVE', capacity: 16, hourlyRate: 650000 },
        { id: 'r-03', name: 'Boardroom New York', roomType: 'BOARDROOM', capacity: 24, hourlyRate: 1200000 }
    ],
    slots = [],
    onSelectAvailableSlot,
    onRefresh
}: CalendarGridProps) {
    const [selectedSlotForDetail, setSelectedSlotForDetail] = useState<GridSlot | null>(null);
    const [refundModalBooking, setRefundModalBooking] = useState<BookingToRefund | null>(null);
    const [filterType, setFilterType] = useState<string>('ALL');

    const filteredRooms = useMemo(() => {
        if (filterType === 'ALL') return rooms;
        return rooms.filter(r => r.roomType === filterType);
    }, [rooms, filterType]);

    // Tìm slot tương ứng với Room và Hour
    const getSlotForHour = (roomId: string, hourStr: string): GridSlot | undefined => {
        const targetPrefix = `${date}T${hourStr}`;
        return slots.find(s => s.roomId === roomId && s.startTime.startsWith(targetPrefix));
    };

    const handleSlotClick = (slot: GridSlot, room: RoomData) => {
        if (slot.status === 'AVAILABLE') {
            if (onSelectAvailableSlot) {
                onSelectAvailableSlot(room.id, slot.id);
            }
        } else {
            setSelectedSlotForDetail(slot);
        }
    };

    const handleOpenRefund = (slot: GridSlot, room: RoomData) => {
        if (!slot.bookingId || !slot.bookingCode) return;
        setRefundModalBooking({
            id: slot.bookingId,
            bookingCode: slot.bookingCode,
            roomName: room.name,
            customerName: slot.customerName || 'Khách vãng lai',
            customerPhone: slot.customerPhone || '0900000000',
            startTime: slot.startTime,
            endTime: slot.endTime,
            totalAmount: slot.totalAmount || room.hourlyRate,
            paymentMethod: slot.paymentMethod || 'CASH_ON_ARRIVAL',
            monthlyCancelCount: 0
        });
        setSelectedSlotForDetail(null);
    };

    return (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 font-sans">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
                        📅
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Lịch Đặt Phòng Tổng Thể (Master Calendar)</h2>
                        <p className="text-xs text-slate-400">Ngày làm việc: <strong className="text-emerald-400">{date}</strong> (Cập nhật thời gian thực)</p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {/* Bộ lọc loại phòng */}
                    <select
                        id="filter-room-type"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="ALL">Tất cả loại phòng</option>
                        <option value="STANDARD">Standard</option>
                        <option value="EXECUTIVE">Executive</option>
                        <option value="BOARDROOM">Boardroom</option>
                    </select>

                    {onRefresh && (
                        <button
                            id="btn-refresh-grid"
                            onClick={onRefresh}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium border border-slate-700 transition flex items-center space-x-1.5"
                        >
                            <span>🔄</span>
                            <span>Làm mới</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Bảng chú giải trạng thái (Legend) */}
            <div className="flex flex-wrap items-center gap-4 py-4 text-xs text-slate-300 border-b border-slate-800/60">
                <span className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40"></span>
                    <span>Trống (AVAILABLE)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500 animate-pulse"></span>
                    <span className="text-amber-300">Đang giữ chỗ Online 10p (LOCKED)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500"></span>
                    <span>Đã thanh toán (CONFIRMED_PAID)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500"></span>
                    <span>Công nợ doanh nghiệp (CONFIRMED_DEBT)</span>
                </span>
            </div>

            {/* Bảng Lịch Grid View */}
            <div className="mt-6 overflow-x-auto">
                <div className="min-w-[1000px]">
                    {/* Header: Giờ */}
                    <div className="grid grid-cols-15 gap-1.5 text-center text-xs font-semibold text-slate-400 pb-2 border-b border-slate-800">
                        <div className="col-span-2 text-left pl-3 text-slate-300">Phòng họp</div>
                        {TIME_COLUMNS.map((hour) => (
                            <div key={hour} className="col-span-1">{hour}</div>
                        ))}
                    </div>

                    {/* Body: Các phòng và các Slot */}
                    <div className="space-y-2.5 pt-3">
                        {filteredRooms.map((room) => (
                            <div key={room.id} className="grid grid-cols-15 gap-1.5 items-center p-2 rounded-xl bg-slate-950/40 hover:bg-slate-950/70 border border-slate-800/80 transition">
                                {/* Cột Tên phòng */}
                                <div className="col-span-2 pl-2">
                                    <h4 className="font-semibold text-white text-xs truncate" title={room.name}>{room.name}</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{room.capacity} chỗ • {formatVND(room.hourlyRate)}/h</p>
                                </div>

                                {/* Các cột Slot giờ */}
                                {TIME_COLUMNS.map((hour) => {
                                    const slot = getSlotForHour(room.id, hour);
                                    const status: SlotStatus = slot ? slot.status : 'AVAILABLE';

                                    let bgClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20';
                                    let label = 'Trống';

                                    if (status === 'LOCKED_PENDING_ONLINE') {
                                        bgClass = 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse';
                                        label = 'Giữ 10p';
                                    } else if (status === 'CONFIRMED' || status === 'CONFIRMED_PAID') {
                                        bgClass = 'bg-blue-500/20 border-blue-500/50 text-blue-300';
                                        label = 'Đã đặt';
                                    } else if (status === 'CONFIRMED_DEBT') {
                                        bgClass = 'bg-purple-500/20 border-purple-500/50 text-purple-300';
                                        label = 'Công nợ';
                                    }

                                    return (
                                        <button
                                            key={`${room.id}-${hour}`}
                                            id={`slot-${room.id}-${hour}`}
                                            onClick={() => slot && handleSlotClick(slot, room)}
                                            className={`col-span-1 py-2.5 px-1 rounded-lg border text-[11px] font-medium transition flex flex-col items-center justify-center ${bgClass}`}
                                            title={`${room.name} (${hour}): ${label}`}
                                        >
                                            <span className="truncate w-full text-center">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* POPOVER XEM CHI TIẾT ĐƠN PHÒNG ĐÃ ĐẶT */}
            {selectedSlotForDetail && (
                <div id="slot-detail-modal" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="font-bold text-white text-sm">Chi Tiết Đơn Đặt Phòng</h3>
                            <button onClick={() => setSelectedSlotForDetail(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Mã đơn:</span>
                                <span className="font-mono font-bold text-emerald-400">{selectedSlotForDetail.bookingCode || 'BKG-ONLINE'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Khách hàng:</span>
                                <span className="text-white font-medium">{selectedSlotForDetail.customerName || 'Khách vãng lai'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Phương thức:</span>
                                <span className="font-medium text-slate-200">{selectedSlotForDetail.paymentMethod || 'ONLINE_GATEWAY'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Trạng thái:</span>
                                <span className="font-bold text-blue-400">{selectedSlotForDetail.status}</span>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center space-x-2">
                            <button
                                onClick={() => setSelectedSlotForDetail(null)}
                                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold"
                            >
                                Đóng
                            </button>
                            {selectedSlotForDetail.status !== 'AVAILABLE' && (
                                <button
                                    id="btn-open-refund-from-grid"
                                    onClick={() => {
                                        const room = rooms.find(r => r.id === selectedSlotForDetail.roomId);
                                        if (room) handleOpenRefund(selectedSlotForDetail, room);
                                    }}
                                    className="flex-1 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold"
                                >
                                    Hủy & Hoàn Tiền
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TÍCH HỢP REFUND MODAL (TWO-MAN RULE) */}
            {refundModalBooking && (
                <RefundModal
                    isOpen={true}
                    onClose={() => setRefundModalBooking(null)}
                    booking={refundModalBooking}
                    onRefundSuccess={() => {
                        setRefundModalBooking(null);
                        if (onRefresh) onRefresh();
                    }}
                />
            )}
        </div>
    );
}
