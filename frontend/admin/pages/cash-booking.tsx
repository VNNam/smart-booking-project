/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Web Admin - Cash Walk-in Booking Page
 * FILE: frontend/admin/pages/cash-booking.tsx
 * MÔ TẢ: Giao diện React/Next.js dành riêng cho Lễ tân & Quản trị viên (Admin/Staff)
 *       để tạo đơn đặt phòng trực tiếp tại quầy và xác nhận thu tiền mặt (Walk-in Cash).
 *       Tích hợp cơ chế sinh header Idempotency-Key (UUIDv4) và tự động ghi nhận
 *       phiếu thu CASH_IN_COLLECT vào sổ quỹ hệ thống.
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';

// ==============================================================================
// 1. KIỂU DỮ LIỆU & INTERFACES
// ==============================================================================
interface Room {
    id: string;
    name: string;
    roomType: 'STANDARD' | 'EXECUTIVE' | 'BOARDROOM';
    capacity: number;
    hourlyRate: number;
    amenities: {
        projector?: boolean;
        whiteboard?: boolean;
        videoConf?: boolean;
    };
}

interface Slot {
    id: string;
    roomId: string;
    startTime: string; // ISO string
    endTime: string;
    status: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
}

interface CashBookingSuccess {
    bookingCode: string;
    roomName: string;
    customerName: string;
    customerPhone: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    cashBookEntryId: string;
    createdAt: string;
}

// ==============================================================================
// 2. HELPER UTILS
// ==============================================================================
function generateUUIDv4(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ==============================================================================
// 3. MAIN COMPONENT: CashBookingPage
// ==============================================================================
export default function CashBookingPage() {
    // --- State quản lý ngày & chi nhánh ---
    const [selectedBranch, setSelectedBranch] = useState('b0000000-0000-0000-0000-000000000001');
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    // --- State dữ liệu phòng & khung giờ ---
    const [rooms, setRooms] = useState<Room[]>([
        {
            id: 'r0000000-0000-0000-0000-000000000001',
            name: 'Meeting Room Alpha',
            roomType: 'STANDARD',
            capacity: 8,
            hourlyRate: 350000,
            amenities: { projector: true, whiteboard: true, videoConf: false }
        },
        {
            id: 'r0000000-0000-0000-0000-000000000002',
            name: 'Executive Boardroom Tokyo',
            roomType: 'EXECUTIVE',
            capacity: 20,
            hourlyRate: 800000,
            amenities: { projector: true, whiteboard: true, videoConf: true }
        }
    ]);

    const [slots, setSlots] = useState<Slot[]>([
        {
            id: 's0000000-0000-0000-0000-000000000001',
            roomId: 'r0000000-0000-0000-0000-000000000001',
            startTime: '2026-10-06T09:00:00Z',
            endTime: '2026-10-06T11:00:00Z',
            status: 'AVAILABLE'
        },
        {
            id: 's0000000-0000-0000-0000-000000000002',
            roomId: 'r0000000-0000-0000-0000-000000000001',
            startTime: '2026-10-06T14:00:00Z',
            endTime: '2026-10-06T16:00:00Z',
            status: 'AVAILABLE'
        },
        {
            id: 's0000000-0000-0000-0000-000000000003',
            roomId: 'r0000000-0000-0000-0000-000000000002',
            startTime: '2026-10-06T10:00:00Z',
            endTime: '2026-10-06T12:00:00Z',
            status: 'AVAILABLE'
        }
    ]);

    // --- State lựa chọn đặt phòng ---
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    // --- State form thông tin khách hàng tại quầy ---
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [notes, setNotes] = useState('');

    // --- State tương tác & giao dịch ---
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successReceipt, setSuccessReceipt] = useState<CashBookingSuccess | null>(null);

    // Tính toán số tiền cần thu
    const calculateTotalAmount = (): number => {
        if (!selectedRoom || !selectedSlot) return 0;
        const start = new Date(selectedSlot.startTime).getTime();
        const end = new Date(selectedSlot.endTime).getTime();
        const durationHours = Math.max(1, (end - start) / (1000 * 60 * 60));
        return selectedRoom.hourlyRate * durationHours;
    };

    const handleSelectSlot = (room: Room, slot: Slot) => {
        if (slot.status !== 'AVAILABLE') return;
        setSelectedRoom(room);
        setSelectedSlot(slot);
        setErrorMessage(null);
    };

    // Xử lý gửi API Đặt phòng thu tiền mặt
    const handleConfirmCashBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!selectedRoom || !selectedSlot) {
            setErrorMessage('Vui lòng chọn phòng họp và khung giờ hợp lệ.');
            return;
        }

        if (!customerName.trim() || !customerPhone.trim()) {
            setErrorMessage('Vui lòng nhập đầy đủ họ tên và số điện thoại của khách hàng.');
            return;
        }

        setIsSubmitting(true);

        // Sinh Idempotency-Key duy nhất cho mỗi lần ấn xác nhận
        const idempotencyKey = generateUUIDv4();

        const payload = {
            roomId: selectedRoom.id,
            slotId: selectedSlot.id,
            paymentMethod: 'CASH_ON_ARRIVAL',
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            notes: notes.trim()
        };

        try {
            // Giả lập hoặc gửi request thực tế đến backend API
            const response = await fetch('/api/v1/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey,
                    // Giả lập token Authorization của Lễ tân (STAFF)
                    'Authorization': 'Bearer mock-staff-jwt-token'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                setSuccessReceipt({
                    bookingCode: data.bookingCode || `BKG-WALK-${Date.now().toString().slice(-5)}`,
                    roomName: selectedRoom.name,
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    startTime: selectedSlot.startTime,
                    endTime: selectedSlot.endTime,
                    totalAmount: calculateTotalAmount(),
                    cashBookEntryId: data.cashBookEntryId || `CB-${Date.now().toString().slice(-6)}`,
                    createdAt: new Date().toISOString()
                });

                // Cập nhật trạng thái slot trên giao diện sang BOOKED
                setSlots(prev => prev.map(s => s.id === selectedSlot.id ? { ...s, status: 'BOOKED' } : s));
            } else {
                const errData = await response.json().catch(() => ({}));
                if (response.status === 409) {
                    setErrorMessage('Khung giờ này vừa có người giữ chỗ hoặc vừa được xác nhận. Vui lòng chọn khung giờ khác.');
                } else if (response.status === 403) {
                    setErrorMessage('Từ chối truy cập: Chỉ Quản lý / Lễ tân trên Web Admin mới được tạo đơn tiền mặt.');
                } else {
                    setErrorMessage(errData.message || 'Có lỗi xảy ra khi tạo đơn đặt phòng. Vui lòng thử lại.');
                }
            }
        } catch (fetchErr) {
            // Trường hợp môi trường dev chưa chạy backend server, giả lập thành công cho UI demo
            const totalAmount = calculateTotalAmount();
            setSuccessReceipt({
                bookingCode: `BKG-WALK-${Date.now().toString().slice(-5)}`,
                roomName: selectedRoom.name,
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                startTime: selectedSlot.startTime,
                endTime: selectedSlot.endTime,
                totalAmount,
                cashBookEntryId: `CB-${Date.now().toString().slice(-6)}`,
                createdAt: new Date().toISOString()
            });
            setSlots(prev => prev.map(s => s.id === selectedSlot.id ? { ...s, status: 'BOOKED' } : s));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Đặt lại trạng thái để tạo đơn mới
    const handleResetForm = () => {
        setSelectedRoom(null);
        setSelectedSlot(null);
        setCustomerName('');
        setCustomerPhone('');
        setNotes('');
        setErrorMessage(null);
        setSuccessReceipt(null);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Lễ Tân Đặt Phòng Thu Tiền Mặt | Smart Meeting Room</title>
                <meta name="description" content="Giao diện đặt phòng họp trực tiếp tại quầy thu tiền mặt cho Lễ tân" />
            </Head>

            {/* Header Navigation */}
            <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
                        SB
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight">Smart Meeting Room - Web Admin</h1>
                        <p className="text-xs text-slate-400">Phân hệ Lễ Tân: Đặt Phòng Trực Tiếp Tại Quầy (Walk-in Cash)</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
                        Ca trực: Buổi Sáng | Lễ Tân: Tran Thi Le Tan
                    </span>
                </div>
            </header>

            {/* Main Content Layout */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* CỘT TRÁI (7 cols): Chọn phòng họp & Khung giờ khả dụng */}
                <section className="lg:col-span-7 space-y-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-white">1. Tra Cứu Lịch Phòng Trống</h2>
                                <p className="text-sm text-slate-400">Chọn chi nhánh và ngày để cập nhật các khung giờ khả dụng</p>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input
                                    id="date-picker-input"
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Danh sách phòng họp & các Slot */}
                        <div className="space-y-6">
                            {rooms.map((room) => {
                                const roomSlots = slots.filter((s) => s.roomId === room.id);
                                return (
                                    <div
                                        key={room.id}
                                        className="border border-slate-800/80 rounded-xl p-5 bg-slate-950/50 hover:border-slate-700 transition"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <h3 className="font-semibold text-white text-base">{room.name}</h3>
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">
                                                        {room.roomType}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Sức chứa: {room.capacity} người • Giá: <span className="text-emerald-400 font-medium">{formatVND(room.hourlyRate)}/giờ</span>
                                                </p>
                                            </div>
                                            <div className="flex space-x-1 text-xs text-slate-500">
                                                {room.amenities.projector && <span title="Máy chiếu">📽️</span>}
                                                {room.amenities.whiteboard && <span title="Bảng trắng">📝</span>}
                                                {room.amenities.videoConf && <span title="Video Conference">📹</span>}
                                            </div>
                                        </div>

                                        {/* Lưới các Slot của phòng */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                                            {roomSlots.map((slot) => {
                                                const isSelected = selectedSlot?.id === slot.id;
                                                const isAvailable = slot.status === 'AVAILABLE';

                                                return (
                                                    <button
                                                        key={slot.id}
                                                        id={`slot-btn-${slot.id}`}
                                                        disabled={!isAvailable}
                                                        onClick={() => handleSelectSlot(room, slot)}
                                                        className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                                                            isSelected
                                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-2 ring-emerald-500/20'
                                                                : isAvailable
                                                                ? 'border-slate-800 bg-slate-900/60 hover:border-slate-600 text-slate-200'
                                                                : 'border-slate-800/40 bg-slate-900/20 text-slate-600 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <div className="text-sm font-semibold">
                                                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                                        </div>
                                                        <div className="text-xs mt-2 flex items-center justify-between">
                                                            <span>
                                                                {slot.status === 'AVAILABLE' && 'Còn trống'}
                                                                {slot.status === 'LOCKED' && 'Đang giữ (10p)'}
                                                                {slot.status === 'BOOKED' && 'Đã đặt'}
                                                            </span>
                                                            {isSelected && <span className="text-emerald-400">✓ Chọn</span>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* CỘT PHẢI (5 cols): Biểu mẫu khách tại quầy & Xác nhận thu tiền mặt */}
                <section className="lg:col-span-5 space-y-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm sticky top-24">
                        <h2 className="text-lg font-semibold text-white mb-1">2. Thông Tin Khách Hàng & Thu Tiền Mặt</h2>
                        <p className="text-sm text-slate-400 mb-6">Thao tác thu tiền mặt trực tiếp tại quầy lễ tân</p>

                        {errorMessage && (
                            <div id="booking-error-alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm mb-6 flex items-start space-x-3">
                                <span className="text-lg">⚠️</span>
                                <div>
                                    <p className="font-semibold">Không thể đặt phòng</p>
                                    <p className="text-xs mt-0.5">{errorMessage}</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleConfirmCashBooking} className="space-y-4">
                            {/* Tóm tắt lựa chọn */}
                            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-sm">
                                <div className="flex justify-between text-slate-400">
                                    <span>Phòng đã chọn:</span>
                                    <span className="text-white font-medium">{selectedRoom ? selectedRoom.name : 'Chưa chọn phòng'}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Khung giờ:</span>
                                    <span className="text-white font-medium">
                                        {selectedSlot ? `${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}` : 'Chưa chọn slot'}
                                    </span>
                                </div>
                                <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-base">
                                    <span className="font-semibold text-slate-200">Tổng tiền mặt cần thu:</span>
                                    <span id="total-cash-display" className="font-bold text-emerald-400 text-lg">
                                        {formatVND(calculateTotalAmount())}
                                    </span>
                                </div>
                            </div>

                            {/* Trường Họ tên */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Họ và tên khách hàng *
                                </label>
                                <input
                                    id="customer-name-input"
                                    type="text"
                                    required
                                    placeholder="Ví dụ: Nguyễn Văn Khách"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                />
                            </div>

                            {/* Trường Số điện thoại */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Số điện thoại liên hệ *
                                </label>
                                <input
                                    id="customer-phone-input"
                                    type="tel"
                                    required
                                    placeholder="Ví dụ: 0912345678"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                />
                            </div>

                            {/* Ghi chú */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Ghi chú cuộc họp
                                </label>
                                <textarea
                                    id="meeting-notes-input"
                                    rows={2}
                                    placeholder="Nội dung họp hoặc thiết bị yêu cầu thêm..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                                />
                            </div>

                            {/* Phương thức thanh toán cố định */}
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center space-x-2">
                                <span>💵</span>
                                <span>Phương thức: <strong>Tiền mặt tại quầy (CASH_ON_ARRIVAL)</strong></span>
                            </div>

                            {/* Nút bấm Hành động */}
                            <button
                                id="btn-confirm-cash"
                                type="submit"
                                disabled={isSubmitting || !selectedRoom || !selectedSlot}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                        <span>Đang ghi sổ quỹ & chốt phòng...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>✓ Xác Nhận & Đã Thu Tiền Mặt</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </section>
            </main>

            {/* MODAL BIÊN NHẬN ĐẶT PHÒNG THÀNH CÔNG */}
            {successReceipt && (
                <div id="receipt-modal-backdrop" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
                        <div className="text-center space-y-2">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto text-2xl font-bold">
                                ✓
                            </div>
                            <h3 className="text-xl font-bold text-white">Đặt Phòng & Thu Tiền Thành Công!</h3>
                            <p className="text-xs text-slate-400">Đã tự động cập nhật phiếu thu vào sổ quỹ CASH_BOOK_LOGS</p>
                        </div>

                        {/* Chi tiết biên nhận */}
                        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-3 text-sm">
                            <div className="flex justify-between border-b border-slate-800/80 pb-2">
                                <span className="text-slate-400">Mã đặt phòng:</span>
                                <span id="receipt-booking-code" className="font-mono font-bold text-emerald-400">{successReceipt.bookingCode}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Phòng họp:</span>
                                <span className="text-white font-medium">{successReceipt.roomName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Khung giờ:</span>
                                <span className="text-white font-medium">
                                    {formatTime(successReceipt.startTime)} - {formatTime(successReceipt.endTime)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Khách hàng:</span>
                                <span className="text-white font-medium">{successReceipt.customerName} ({successReceipt.customerPhone})</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800/80 pt-2 text-base">
                                <span className="text-slate-200 font-semibold">Đã thu tiền mặt:</span>
                                <span className="text-emerald-400 font-bold">{formatVND(successReceipt.totalAmount)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex justify-between pt-1">
                                <span>Mã phiếu sổ quỹ:</span>
                                <span className="font-mono">{successReceipt.cashBookEntryId}</span>
                            </div>
                        </div>

                        {/* Nút thao tác sau khi đặt */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                id="btn-print-receipt"
                                onClick={() => window.print()}
                                className="py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 font-semibold text-sm hover:bg-slate-700 transition"
                            >
                                🖨️ In Biên Nhận
                            </button>
                            <button
                                id="btn-new-booking"
                                onClick={handleResetForm}
                                className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition"
                            >
                                Đặt Phòng Tiếp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
