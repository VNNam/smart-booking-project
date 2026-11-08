import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Mảng phòng họp tham chiếu để tính giá chính xác tại quầy
 */
const KNOWN_RATES: Record<string, number> = {
    'r0000000-0000-0000-0000-000000000001': 350000,
    'r0000000-0000-0000-0000-000000000002': 650000,
    'r0000000-0000-0000-0000-000000000003': 1200000
};

// Lưu vết các đơn đặt phòng thu tiền mặt thành công trong phiên chạy
interface StoredBooking {
    id: string;
    bookingCode: string;
    roomId: string;
    slotId: string;
    bookingStatus: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: number;
    cashBookEntryId: string;
    customerName: string;
    customerPhone: string;
    notes?: string;
    corporateDebtAccount?: string | null;
    createdAt: string;
}

const bookingsStore: StoredBooking[] = [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        return res.status(200).json({ success: true, data: bookingsStore });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const {
            roomId,
            slotId,
            bookingDate,
            startTime,
            endTime,
            paymentMethod,
            customerName,
            customerPhone,
            notes,
            companyId,
            memberId
        } = req.body || {};

        // 1. Kiểm tra các trường thông tin bắt buộc
        if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_ROOM_ID',
                message: 'Mã phòng họp (roomId) là bắt buộc.'
            });
        }

        if (!paymentMethod || paymentMethod !== 'CASH_ON_ARRIVAL') {
            return res.status(400).json({
                success: false,
                code: 'INVALID_PAYMENT_METHOD',
                message: 'Phương thức thanh toán không hợp lệ cho luồng thu tiền mặt tại quầy.'
            });
        }

        if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_CUSTOMER_NAME',
                message: 'Họ tên khách hàng là bắt buộc.'
            });
        }

        if (!customerPhone || typeof customerPhone !== 'string' || customerPhone.trim().length === 0) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_CUSTOMER_PHONE',
                message: 'Số điện thoại khách hàng là bắt buộc.'
            });
        }

        // 2. Kiểm tra tính hợp lệ của mốc thời gian và chặn khung giờ quá khứ (Real-time Guard)
        let durationHours = 2; // Mặc định 2 tiếng nếu không truyền
        let isPast = false;

        if (startTime) {
            const startTs = new Date(startTime).getTime();
            if (Number.isNaN(startTs)) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_START_TIME',
                    message: 'Thời gian bắt đầu (startTime) không đúng định dạng.'
                });
            }

            // Chặn khung giờ đã trôi qua
            if (startTs <= Date.now()) {
                isPast = true;
                return res.status(409).json({
                    success: false,
                    code: 'SLOT_IN_PAST',
                    message: 'Khung giờ đã bắt đầu hoặc đã qua (theo giờ hệ thống). Không thể thu tiền mặt — vui lòng chọn khung giờ khác.'
                });
            }

            if (endTime) {
                const endTs = new Date(endTime).getTime();
                if (!Number.isNaN(endTs) && endTs > startTs) {
                    durationHours = Math.max(1, Math.round((endTs - startTs) / 3600000));
                }
            }
        }

        // 3. Tính toán tiền phòng chính xác có phụ thu cuối tuần VN
        const baseRate = KNOWN_RATES[roomId] || 500000;
        const refTime = startTime ? new Date(startTime) : new Date();
        const vnDate = new Date(refTime.getTime() + 7 * 3600 * 1000);
        const vnDayOfWeek = vnDate.getUTCDay(); // 0 = CN, 6 = T7
        const isWeekend = vnDayOfWeek === 0 || vnDayOfWeek === 6;
        const weekendMultiplier = isWeekend ? 1.15 : 1.0;
        const totalAmount = Math.round(durationHours * baseRate * weekendMultiplier);

        // 4. Sinh mã đặt phòng & biên lai thu tiền mặt
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        const bookingCode = `BKG-${dateStr}-${randomDigits}`;
        const cashBookEntryId = `CB-${Date.now().toString().slice(-6)}`;
        const bookingId = `bkg-${Date.now()}`;
        const finalSlotId = slotId || `slot-${roomId}-${bookingDate || dateStr}`;

        const newBooking: StoredBooking = {
            id: bookingId,
            bookingCode,
            roomId,
            slotId: finalSlotId,
            bookingStatus: 'CONFIRMED_PAID',
            paymentMethod: 'CASH_ON_ARRIVAL',
            paymentStatus: 'PAID',
            totalAmount,
            cashBookEntryId,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            notes: notes || undefined,
            corporateDebtAccount: companyId || memberId || null,
            createdAt: now.toISOString()
        };

        bookingsStore.unshift(newBooking);

        return res.status(201).json({
            success: true,
            id: newBooking.id,
            bookingCode: newBooking.bookingCode,
            roomId: newBooking.roomId,
            slotId: newBooking.slotId,
            bookingStatus: newBooking.bookingStatus,
            paymentMethod: newBooking.paymentMethod,
            paymentStatus: newBooking.paymentStatus,
            totalAmount: newBooking.totalAmount,
            cashBookEntryId: newBooking.cashBookEntryId,
            corporateDebtAccount: newBooking.corporateDebtAccount,
            createdAt: newBooking.createdAt
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            message: err.message || 'Lỗi xử lý đặt phòng thu tiền mặt tại quầy.'
        });
    }
}

