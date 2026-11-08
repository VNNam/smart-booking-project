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

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import AdminHeader from '../components/AdminHeader';
import { withAuth } from '../components/withAuth';
import { roomStore, RoomItem } from '../lib/roomStore';
import { AuthManager } from '../lib/auth';
import { getVnNow, addDaysToDateStr, dayOfWeekOfDateStr, hhmmToMinutes } from '../lib/vnTime';

/**
 * [BA-FIX CB-01] Chế độ giả lập API chỉ bật khi khai báo tường minh NEXT_PUBLIC_MOCK_API=true.
 * Production: lỗi mạng/backend KHÔNG BAO GIỜ được hiển thị như thu tiền thành công.
 */
const MOCK_API_ENABLED = process.env.NEXT_PUBLIC_MOCK_API === 'true';

/** [BA-FIX CB-02/CB-11] Chu kỳ làm mới đồng hồ nghiệp vụ (ms) để tự loại slot vừa trôi qua. */
const CLOCK_TICK_MS = 30 * 1000;

// ==============================================================================
// 1. KIỂU DỮ LIỆU & INTERFACES
// ==============================================================================
type Room = RoomItem;

interface Slot {
    id: string;
    roomId: string;
    startTime: string; // ISO string
    endTime: string;
    status: 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'MAINTENANCE';
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

function getLocalDateString(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTime(isoOrLocalString: string): string {
    // Trích xuất trực tiếp giờ và phút từ định dạng ISO/Local YYYY-MM-DDTHH:mm:ss tránh lệch múi giờ UTC+7
    if (isoOrLocalString.includes('T')) {
        const timePart = isoOrLocalString.split('T')[1];
        if (timePart) {
            const cleanTime = timePart.replace('Z', '');
            const [hh, mm] = cleanTime.split(':');
            return `${hh}:${mm}`;
        }
    }
    const d = new Date(isoOrLocalString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ==============================================================================
// 3. MAIN COMPONENT: CashBookingPage
// ==============================================================================
function CashBookingPage() {
    // [BA-FIX CB-02/CB-08/CB-11] Đồng hồ nghiệp vụ theo giờ VN, tự tick định kỳ:
    // - "Hôm nay" và phút hiện tại luôn được tính lại → slot vừa trôi qua tự biến mất
    // - Qua 00:00 VN, ngày hôm qua tự trở thành ngày quá khứ
    const [nowTick, setNowTick] = useState<number>(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNowTick(Date.now()), CLOCK_TICK_MS);
        return () => clearInterval(timer);
    }, []);
    const vnNow = getVnNow(new Date(nowTick));
    const todayStr = vnNow.dateStr;

    // --- State quản lý ngày & chi nhánh ---
    const [selectedBranch, setSelectedBranch] = useState('b0000000-0000-0000-0000-000000000001');
    const [selectedDate, setSelectedDate] = useState(() => getVnNow().dateStr);

    // Xác định ngữ cảnh ngày tra cứu theo Business Rules (QIC)
    const isPastDate = selectedDate < todayStr;
    const isToday = selectedDate === todayStr;
    const isFutureDate = selectedDate > todayStr;

    // Phát hiện cuối tuần (Thứ Bảy = 6, Chủ Nhật = 0) theo ngày lịch, không phụ thuộc timezone máy
    const dayOfWeek = dayOfWeekOfDateStr(selectedDate);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayOfWeekLabel = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][dayOfWeek] || '';

    // Các mốc ngày nhanh tiện ích
    const tomorrowStr = addDaysToDateStr(todayStr, 1);

    const nextSaturdayStr = (() => {
        const daysUntilSat = (6 - vnNow.dayOfWeek + 7) % 7 || 7;
        return addDaysToDateStr(todayStr, daysUntilSat);
    })();

    // --- State dữ liệu phòng & bộ lọc ---
    const [rooms, setRooms] = useState<Room[]>([]);
    const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(true);
    const [slots, setSlots] = useState<Slot[]>([]);
    // [BA-FIX CB-06] Lưu các slot đã chốt trong phiên để không bị "hồi sinh" AVAILABLE khi đổi ngày qua lại.
    // (Giải pháp tạm cho dữ liệu giả lập — đích: GET /slots/available từ CSDL, backlog #7.)
    const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(() => new Set());

    // Tải và lắng nghe cập nhật phòng theo thời gian thực từ persistent store
    useEffect(() => {
        const initialRooms = roomStore.getRooms();
        setRooms(initialRooms);

        const unsubscribe = roomStore.subscribe((updatedRooms) => {
            setRooms(updatedRooms);
        });

        return () => unsubscribe();
    }, []);

    // Tự động sinh danh sách Slot cho tất cả phòng dựa trên Core Business Rules (QIC):
    // Rule 1: Nếu là Ngày Hiện Tại (Current Date) -> Chỉ hiển thị khung giờ tính từ current time đến hết ngày. Ẩn/loại bỏ các khung giờ quá khứ.
    // Rule 2: Nếu là Ngày Trong Tương Lai (Future Date) -> Hiển thị toàn bộ các khung giờ trống của cả ngày (08:00 -> 21:00).
    useEffect(() => {
        const generatedSlots: Slot[] = [];
        // [BA-FIX CB-02/CB-08] Phút hiện tại theo giờ VN, cập nhật theo nowTick
        const currentMinutes = vnNow.minutesOfDay;

        // Khung giờ hoạt động tiêu chuẩn (08:00 -> 21:00)
        const standardTimeFrames = [
            { start: '08:00:00', end: '10:00:00', startMinutes: 8 * 60, endMinutes: 10 * 60 },
            { start: '10:00:00', end: '12:00:00', startMinutes: 10 * 60, endMinutes: 12 * 60 },
            { start: '13:00:00', end: '15:00:00', startMinutes: 13 * 60, endMinutes: 15 * 60 },
            { start: '15:00:00', end: '17:00:00', startMinutes: 15 * 60, endMinutes: 17 * 60 },
            { start: '17:00:00', end: '19:00:00', startMinutes: 17 * 60, endMinutes: 19 * 60 },
            { start: '19:00:00', end: '21:00:00', startMinutes: 19 * 60, endMinutes: 21 * 60 }
        ];

        // Áp dụng Rule 1 & Rule 2 để lọc danh sách khung giờ hợp lệ
        const applicableTimeFrames = standardTimeFrames.filter((tf) => {
            if (isPastDate) {
                // Ngày trong quá khứ: Loại bỏ toàn bộ khung giờ
                return false;
            }
            if (isToday) {
                // Rule 1: Ngày Hiện Tại -> Ẩn/loại bỏ các khung giờ trong quá khứ kể từ thời điểm tra cứu
                // Chỉ giữ các khung giờ mà giờ bắt đầu chưa trôi qua (startMinutes > currentMinutes)
                return tf.startMinutes > currentMinutes;
            }
            // Rule 2: Ngày Trong Tương Lai -> Hiển thị toàn bộ khung giờ của ngày đó
            return true;
        });

        rooms.forEach((r, rIdx) => {
            applicableTimeFrames.forEach((tf) => {
                const isUnderMaintenance = !r.isActive;
                // [BA-FIX CB-05] ID ổn định theo (phòng, ngày, giờ bắt đầu) — không phụ thuộc chỉ số sau khi lọc,
                // tránh việc slot "Đã đặt" giả lập bị trượt sang khung giờ khác khi Rule 1 loại bớt slot.
                const slotId = `slot-${r.id}-${selectedDate}-${tf.start.slice(0, 5)}`;
                const isDemoBooked = rIdx === 0 && tf.start === '10:00:00';
                generatedSlots.push({
                    id: slotId,
                    roomId: r.id,
                    startTime: `${selectedDate}T${tf.start}`,
                    endTime: `${selectedDate}T${tf.end}`,
                    status: isUnderMaintenance
                        ? 'MAINTENANCE'
                        : (isDemoBooked || bookedSlotIds.has(slotId) ? 'BOOKED' : 'AVAILABLE')
                });
            });
        });

        setSlots(generatedSlots);

        // Nếu phòng đang chọn bị chuyển sang bảo trì thì bỏ chọn
        if (selectedRoom) {
            const currentSelected = rooms.find(r => r.id === selectedRoom.id);
            if (currentSelected && !currentSelected.isActive) {
                setSelectedRoom(null);
                setSelectedSlot(null);
            }
        }

        // [BA-FIX CB-02] Slot đang chọn vừa trôi qua (hoặc không còn khả dụng) → tự bỏ chọn và cảnh báo
        if (selectedSlot) {
            const stillValid = generatedSlots.find(s => s.id === selectedSlot.id && s.status === 'AVAILABLE');
            if (!stillValid) {
                setSelectedSlot(null);
                setErrorMessage('Khung giờ bạn chọn vừa bắt đầu hoặc không còn khả dụng. Vui lòng chọn khung giờ khác.');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, selectedDate, isToday, isPastDate, vnNow.minutesOfDay, bookedSlotIds]);

    // Khi người dùng đổi ngày: tự động reset slot đã chọn để tránh xung đột dữ liệu
    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        setSelectedSlot(null);
        setErrorMessage(null);
        idempotencyKeyRef.current = null;
    };

    // --- State lựa chọn đặt phòng ---
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    // [BA-FIX CB-07] Idempotency-Key gắn với MỘT lựa chọn slot: giữ nguyên khi bấm lại sau timeout/lỗi mạng,
    // chỉ sinh mới khi đổi slot/đổi ngày hoặc sau khi giao dịch thành công.
    const idempotencyKeyRef = useRef<string | null>(null);

    // --- State form thông tin khách hàng tại quầy ---
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [notes, setNotes] = useState('');

    // --- State tương tác & giao dịch ---
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successReceipt, setSuccessReceipt] = useState<CashBookingSuccess | null>(null);

    // Tính toán số tiền cơ bản (chưa tính phụ thu)
    const getBaseAmount = (): number => {
        if (!selectedRoom || !selectedSlot) return 0;
        const start = new Date(selectedSlot.startTime).getTime();
        const end = new Date(selectedSlot.endTime).getTime();
        const durationHours = Math.max(1, (end - start) / (1000 * 60 * 60));
        return selectedRoom.hourlyRate * durationHours;
    };

    // Tính toán số tiền cần thu có áp dụng bảng giá động (cuối tuần)
    const calculateTotalAmount = (): number => {
        const baseAmount = getBaseAmount();
        if (baseAmount === 0) return 0;

        if (isWeekend) {
            const pricingRules = roomStore.getPricingRules();
            const weekendRule = pricingRules.find(r => r.isActive && (r.applicableDays.includes('Cuối tuần') || r.applicableDays.includes('CN') || r.applicableDays.includes('Thứ 7')));
            const multiplier = weekendRule ? weekendRule.multiplier : 1.15;
            return Math.round(baseAmount * multiplier);
        }

        return baseAmount;
    };

    const handleSelectSlot = (room: Room, slot: Slot) => {
        if (slot.status !== 'AVAILABLE') return;
        if (selectedSlot?.id !== slot.id) {
            // Đổi lựa chọn slot → phiên giao dịch mới → Idempotency-Key mới
            idempotencyKeyRef.current = null;
        }
        setSelectedRoom(room);
        setSelectedSlot(slot);
        setErrorMessage(null);
    };

    /** [BA-FIX CB-03] Kiểm tra lại tại thời điểm bấm xác nhận: slot hôm nay phải chưa bắt đầu (giờ VN hiện tại). */
    const isSlotStillBookable = (slot: Slot): boolean => {
        const liveNow = getVnNow();
        const slotDate = slot.startTime.slice(0, 10);
        if (slotDate < liveNow.dateStr) return false;
        if (slotDate > liveNow.dateStr) return true;
        const startMinutes = hhmmToMinutes(slot.startTime.split('T')[1] || '00:00');
        return startMinutes > liveNow.minutesOfDay;
    };

    /** Chốt slot thành BOOKED trên giao diện (đồng bộ ngay sau khi giao dịch hoàn tất). */
    const markSlotBooked = (slotId: string) => {
        // Bỏ chọn trước để effect không coi slot vừa chốt là "không còn khả dụng"
        setSelectedSlot(null);
        setSlots(prev => prev.map(s => (s.id === slotId ? { ...s, status: 'BOOKED' } : s)));
        setBookedSlotIds(prev => new Set(prev).add(slotId));
        idempotencyKeyRef.current = null;
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

        // [BA-FIX CB-03] Không cho thu tiền mặt cho khung giờ đã bắt đầu/đã qua trong ngày hiện tại
        if (!isSlotStillBookable(selectedSlot)) {
            setSelectedSlot(null);
            setNowTick(Date.now());
            setErrorMessage('Khung giờ đã bắt đầu hoặc đã qua. Không thể thu tiền mặt cho khung giờ này — vui lòng chọn khung giờ khác.');
            return;
        }

        setIsSubmitting(true);

        // [BA-FIX CB-07] Tái sử dụng Idempotency-Key cho cùng lựa chọn slot (retry an toàn sau timeout)
        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = generateUUIDv4();
        }
        const idempotencyKey = idempotencyKeyRef.current;

        const payload = {
            roomId: selectedRoom.id,
            slotId: selectedSlot.id,
            paymentMethod: 'CASH_ON_ARRIVAL',
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            notes: notes.trim()
        };

        const bookedRoom = selectedRoom;
        const bookedSlot = selectedSlot;
        const buildMockReceipt = (): CashBookingSuccess => ({
            bookingCode: `MOCK-WALK-${Date.now().toString().slice(-5)}`,
            roomName: bookedRoom.name,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            startTime: bookedSlot.startTime,
            endTime: bookedSlot.endTime,
            totalAmount: calculateTotalAmount(),
            cashBookEntryId: `MOCK-CB-${Date.now().toString().slice(-6)}`,
            createdAt: new Date().toISOString()
        });

        try {
            // [BA-FIX CB-10] Dùng JWT của phiên đăng nhập thật thay vì token hardcode
            const token = AuthManager.getToken();
            const response = await fetch('/api/v1/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey,
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                setSuccessReceipt({
                    bookingCode: data.bookingCode,
                    roomName: bookedRoom.name,
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    startTime: bookedSlot.startTime,
                    endTime: bookedSlot.endTime,
                    // [BA-FIX CB-09] Biên nhận dùng số tiền do server tính (khớp 100% với sổ quỹ CASH_BOOK_LOGS)
                    totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : Number(data.totalAmount),
                    cashBookEntryId: data.cashBookEntryId,
                    createdAt: data.createdAt || new Date().toISOString()
                });

                // Cập nhật trạng thái slot trên giao diện sang BOOKED
                markSlotBooked(bookedSlot.id);
            } else if (MOCK_API_ENABLED && response.status === 404) {
                // Chỉ dành cho môi trường demo không có backend (NEXT_PUBLIC_MOCK_API=true)
                setSuccessReceipt(buildMockReceipt());
                markSlotBooked(bookedSlot.id);
            } else {
                const errData = await response.json().catch(() => ({}));
                if (response.status === 409 && errData.code === 'SLOT_IN_PAST') {
                    setSelectedSlot(null);
                    setNowTick(Date.now());
                    setErrorMessage('Khung giờ đã bắt đầu hoặc đã qua (theo giờ hệ thống). Không thể thu tiền mặt — vui lòng chọn khung giờ khác.');
                } else if (response.status === 409) {
                    setErrorMessage('Khung giờ này vừa có người giữ chỗ hoặc vừa được xác nhận. Vui lòng chọn khung giờ khác.');
                } else if (response.status === 403) {
                    setErrorMessage('Từ chối truy cập: Chỉ Quản lý / Lễ tân trên Web Admin mới được tạo đơn tiền mặt.');
                } else if (response.status === 401) {
                    setErrorMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi thu tiền.');
                } else {
                    setErrorMessage(errData.message || 'Có lỗi xảy ra khi tạo đơn đặt phòng. Vui lòng thử lại.');
                }
            }
        } catch (fetchErr) {
            if (MOCK_API_ENABLED) {
                // Chỉ dành cho môi trường demo không có backend (NEXT_PUBLIC_MOCK_API=true)
                setSuccessReceipt(buildMockReceipt());
                markSlotBooked(bookedSlot.id);
            } else {
                // [BA-FIX CB-01] Lỗi mạng/backend: TUYỆT ĐỐI không báo thành công, không đánh dấu slot BOOKED.
                // Giữ nguyên Idempotency-Key để bấm lại an toàn (server sẽ trả kết quả cũ nếu đơn đã được tạo).
                setErrorMessage(
                    'Không kết nối được máy chủ — giao dịch CHƯA được ghi nhận. KHÔNG thu tiền của khách. Vui lòng kiểm tra mạng và bấm xác nhận lại.'
                );
            }
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
        idempotencyKeyRef.current = null;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Lễ Tân Đặt Phòng Thu Tiền Mặt | Smart Meeting Room</title>
                <meta name="description" content="Giao diện đặt phòng họp trực tiếp tại quầy thu tiền mặt cho Lễ tân" />
            </Head>

            {/* Header Navigation */}
            <AdminHeader />

            {/* Main Content Layout */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* CỘT TRÁI (7 cols): Chọn phòng họp & Khung giờ khả dụng */}
                <section className="lg:col-span-7 space-y-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-white">1. Tra Cứu Lịch Phòng Trống</h2>
                                <p className="text-sm text-slate-400">Chọn chi nhánh và ngày để cập nhật các khung giờ khả dụng</p>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="flex items-center space-x-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
                                    <button
                                        type="button"
                                        id="btn-quick-today"
                                        onClick={() => handleDateChange(todayStr)}
                                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                                            isToday ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Hôm nay
                                    </button>
                                    <button
                                        type="button"
                                        id="btn-quick-tomorrow"
                                        onClick={() => handleDateChange(tomorrowStr)}
                                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                                            selectedDate === tomorrowStr ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Ngày mai
                                    </button>
                                    <button
                                        type="button"
                                        id="btn-quick-weekend"
                                        onClick={() => handleDateChange(nextSaturdayStr)}
                                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                                            selectedDate === nextSaturdayStr ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Thứ 7 tới
                                    </button>
                                </div>
                                <input
                                    id="date-picker-input"
                                    type="date"
                                    min={todayStr}
                                    value={selectedDate}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Banner ngữ cảnh theo Core Business Rules (QIC) */}
                        {isPastDate && (
                            <div id="past-date-alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2">
                                    <span className="text-base">⚠️</span>
                                    <span>
                                        <strong>Ngày trong quá khứ ({selectedDate}):</strong> Không thể tra cứu hoặc đặt phòng cho ngày đã qua.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDateChange(todayStr)}
                                    className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 font-semibold"
                                >
                                    Quay về hôm nay
                                </button>
                            </div>
                        )}

                        {isToday && (
                            <div id="today-date-info" className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs flex items-center space-x-2 mb-4">
                                <span className="text-base">🕒</span>
                                <span>
                                    <strong>Quy tắc Ngày Hiện Tại (Rule 1):</strong> Hệ thống chỉ hiển thị các khung giờ từ thời điểm hiện tại đến hết ngày. Các khung giờ trong quá khứ đã được tự động ẩn/loại bỏ.
                                </span>
                            </div>
                        )}

                        {isWeekend && !isPastDate && (
                            <div id="weekend-date-info" className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center space-x-2 mb-4">
                                <span className="text-base">🎉</span>
                                <span>
                                    <strong>Ngày Cuối Tuần ({dayOfWeekLabel} - {selectedDate}):</strong> Áp dụng Rule 2 (hiển thị đủ khung giờ) kèm tự động phụ thu cuối tuần (+15%) theo biểu giá động.
                                </span>
                            </div>
                        )}

                        {isFutureDate && !isWeekend && (
                            <div id="future-date-info" className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs flex items-center space-x-2 mb-4">
                                <span className="text-base">📅</span>
                                <span>
                                    <strong>Quy tắc Ngày Tương Lai (Rule 2):</strong> Hiển thị toàn bộ các khung giờ trống của cả ngày ({dayOfWeekLabel} - {selectedDate}) theo giờ hoạt động tiêu chuẩn.
                                </span>
                            </div>
                        )}

                        {/* Bộ lọc hiển thị phòng bảo trì / hoạt động */}
                        <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs gap-2">
                            <span className="text-slate-400">Hiển thị {rooms.filter(r => filterActiveOnly ? r.isActive : true).length} / {rooms.length} phòng họp</span>
                            <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white select-none">
                                <input
                                    type="checkbox"
                                    checked={filterActiveOnly}
                                    onChange={(e) => setFilterActiveOnly(e.target.checked)}
                                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 bg-slate-800"
                                />
                                <span>Chỉ hiển thị phòng đang hoạt động (Ẩn phòng bảo trì)</span>
                            </label>
                        </div>

                        {/* Danh sách phòng họp & các Slot */}
                        <div className="space-y-6">
                            {rooms.filter(r => filterActiveOnly ? r.isActive : true).length === 0 ? (
                                <div className="p-8 rounded-xl border border-slate-800 bg-slate-950/40 text-center space-y-2">
                                    <p className="text-2xl">🚪</p>
                                    <p className="text-sm font-semibold text-slate-300">Không có phòng nào đang mở đón khách</p>
                                    <p className="text-xs text-slate-500">
                                        Tất cả các phòng đang trong thời gian bảo trì. Bạn có thể bỏ chọn ô &quot;Chỉ hiển thị phòng đang hoạt động&quot; hoặc sang trang Quản lý phòng & giá để mở lại phòng.
                                    </p>
                                </div>
                            ) : (
                                rooms.filter(r => filterActiveOnly ? r.isActive : true).map((room) => {
                                    const roomSlots = slots.filter((s) => s.roomId === room.id);
                                    return (
                                        <div
                                            key={room.id}
                                            className={`border rounded-xl p-5 bg-slate-950/50 transition ${
                                                room.isActive
                                                    ? 'border-slate-800/80 hover:border-slate-700'
                                                    : 'border-amber-500/30 bg-amber-950/10'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center space-x-2">
                                                        <h3 className="font-semibold text-white text-base">{room.name}</h3>
                                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">
                                                            {room.roomType}
                                                        </span>
                                                        {!room.isActive && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                                🟡 ĐANG BẢO TRÌ
                                                            </span>
                                                        )}
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

                                            {/* Nếu phòng bảo trì thì hiển thị banner cảnh báo, ngược lại hiển thị slot */}
                                            {!room.isActive ? (
                                                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-base">🛠️</span>
                                                        <span>
                                                            <strong>Phòng đang tạm ngưng bảo trì:</strong> Không thể nhận khách tại quầy ({room.maintenanceReason || 'Bảo dưỡng kỹ thuật'}).
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] uppercase font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/20">
                                                        Khóa đặt chỗ
                                                    </span>
                                                </div>
                                            ) : (
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
                                                                        {slot.status === 'MAINTENANCE' && 'Bảo trì'}
                                                                    </span>
                                                                    {isSelected && <span className="text-emerald-400">✓ Chọn</span>}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
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
                                    <span>Ngày đặt phòng:</span>
                                    <span className="text-white font-medium">{dayOfWeekLabel}, {selectedDate}</span>
                                </div>
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
                                {isWeekend && selectedRoom && selectedSlot && (
                                    <div className="flex justify-between text-xs text-purple-300 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                                        <span>Phụ thu cuối tuần (+15%):</span>
                                        <span className="font-semibold">+{formatVND(calculateTotalAmount() - getBaseAmount())}</span>
                                    </div>
                                )}
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
                                disabled={isSubmitting || !selectedRoom || !selectedSlot || isPastDate}
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

export default withAuth(CashBookingPage);
