/**
 * Unit Tests: Cash Walk-in Booking & B2B Member Linkage
 * Bao phủ các kịch bản kiểm thử chặn lỗi Bad Request 400 và đảm bảo quy tắc nghiệp vụ:
 * 1. TC-CASH-01: Khách vãng lai đặt phòng thu tiền mặt (Happy Path + Chặn slot quá khứ)
 * 2. TC-CASH-02: Thành viên công ty đặt phòng thu tiền mặt (B2B Cash Walk-in Linkage)
 */

import { BookingService, SlotInPastError, SlotConflictError } from '../../src/services/BookingService';
import { UserContext } from '../../src/services/BookingService';

describe('Cash Walk-in Booking & Corporate Linkage (TC-CASH-01 & TC-CASH-02)', () => {
    let mockPool: any;
    let mockClient: any;
    let mockRedis: any;
    let bookingService: BookingService;

    const receptionistUser: UserContext = {
        id: 'u2222222-2222-2222-2222-222222222222',
        role: 'STAFF',
        fullName: 'Lễ Tân Ca Trực'
    };

    beforeEach(() => {
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            query: jest.fn()
        };
        mockRedis = {
            set: jest.fn()
        };
        bookingService = new BookingService(mockPool, mockRedis);
    });

    describe('TC-CASH-01: Khách vãng lai đặt phòng thu tiền mặt (Walk-in Cash)', () => {
        it('1.1. Thành công khi đặt khung giờ tương lai hợp lệ', async () => {
            const validRoomId = 'r0000000-0000-0000-0000-000000000002';
            const validSlotId = 's0000000-0000-0000-0000-000000000006';

            // Mock query tìm slot hợp lệ trong tương lai
            mockClient.query
                // Query slot
                .mockResolvedValueOnce({
                    rows: [
                        {
                            room_id: validRoomId,
                            room_name: 'Executive Room Tokyo',
                            hourly_rate: '650000',
                            slot_id: validSlotId,
                            start_time: '2026-11-08T18:00:00Z',
                            end_time: '2026-11-08T20:00:00Z',
                            slot_status: 'AVAILABLE',
                            is_past: false
                        }
                    ]
                })
                // BEGIN
                .mockResolvedValueOnce({})
                // INSERT bookings
                .mockResolvedValueOnce({
                    rows: [{ id: 'bkg-1', booking_code: 'BKG-202611-001', created_at: new Date().toISOString() }]
                })
                // UPDATE slots
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT cash_book_logs
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT outbox_events
                .mockResolvedValueOnce({ rowCount: 1 })
                // COMMIT
                .mockResolvedValueOnce({});

            const res = await bookingService.createBooking(
                {
                    roomId: validRoomId,
                    slotId: validSlotId,
                    paymentMethod: 'CASH_ON_ARRIVAL',
                    customerName: 'Trần Vãng Lai',
                    customerPhone: '0901234567',
                    notes: 'Khách họp khẩn cấp'
                },
                receptionistUser,
                'idem-cash-01'
            );

            expect(res.bookingStatus).toBe('CONFIRMED_PAID');
            expect(res.paymentMethod).toBe('CASH_ON_ARRIVAL');
            expect(res.paymentStatus).toBe('PAID');
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO cash_book_logs'),
                expect.arrayContaining([expect.any(String), expect.any(String), receptionistUser.id, 1300000])
            );
        });

        it('1.2. Chặn đặt phòng và ném SlotInPastError nếu slot thuộc quá khứ (10:00-12:00)', async () => {
            const validRoomId = 'r0000000-0000-0000-0000-000000000002';
            const pastSlotId = 's0000000-0000-0000-0000-000000000002';

            mockClient.query.mockResolvedValueOnce({
                rows: [
                    {
                        room_id: validRoomId,
                        room_name: 'Executive Room Tokyo',
                        hourly_rate: '650000',
                        slot_id: pastSlotId,
                        start_time: '2026-11-08T03:00:00Z', // 10:00 VN
                        end_time: '2026-11-08T05:00:00Z',   // 12:00 VN
                        slot_status: 'AVAILABLE',
                        is_past: true // Đã trôi qua!
                    }
                ]
            });

            await expect(
                bookingService.createBooking(
                    {
                        roomId: validRoomId,
                        slotId: pastSlotId,
                        paymentMethod: 'CASH_ON_ARRIVAL',
                        customerName: 'Nam Nguyễn',
                        customerPhone: '0888237961',
                        notes: 'hgoj cong ty'
                    },
                    receptionistUser,
                    'idem-cash-past'
                )
            ).rejects.toThrow(SlotInPastError);
        });
    });

    describe('TC-CASH-02: Thành viên công ty đặt phòng thu tiền mặt (B2B Cash Walk-in Linkage)', () => {
        it('2.1. Gắn chính xác user_id của thành viên và liên kết corporate_debt_account', async () => {
            const validRoomId = 'r0000000-0000-0000-0000-000000000002';
            const validSlotId = 's0000000-0000-0000-0000-000000000007';
            const memberId = 'u0000000-0000-0000-0000-000000000003';
            const companyId = 'c0000000-0000-0000-0000-000000000001';

            mockClient.query
                // Query slot
                .mockResolvedValueOnce({
                    rows: [
                        {
                            room_id: validRoomId,
                            room_name: 'Executive Room Tokyo',
                            hourly_rate: '650000',
                            slot_id: validSlotId,
                            start_time: '2026-11-08T18:00:00Z',
                            end_time: '2026-11-08T20:00:00Z',
                            slot_status: 'AVAILABLE',
                            is_past: false
                        }
                    ]
                })
                // Query member existence
                .mockResolvedValueOnce({
                    rows: [{ id: memberId, company_id: companyId, full_name: 'Nam Nguyễn (Thành viên VIP)' }]
                })
                // BEGIN
                .mockResolvedValueOnce({})
                // INSERT bookings with user_id = memberId and corporate_debt_account = companyId
                .mockResolvedValueOnce({
                    rows: [{ id: 'bkg-corp-cash-1', booking_code: 'BKG-CORP-CASH-01', created_at: new Date().toISOString() }]
                })
                // UPDATE slots
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT cash_book_logs
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT outbox_events
                .mockResolvedValueOnce({ rowCount: 1 })
                // COMMIT
                .mockResolvedValueOnce({});

            const res = await bookingService.createBooking(
                {
                    roomId: validRoomId,
                    slotId: validSlotId,
                    bookingDate: '2026-11-08',
                    startTime: '2026-11-08T18:00:00Z',
                    endTime: '2026-11-08T20:00:00Z',
                    paymentMethod: 'CASH_ON_ARRIVAL',
                    companyId: companyId,
                    memberId: memberId,
                    customerName: 'Nam Nguyễn',
                    customerPhone: '0888237961',
                    notes: 'Họp công ty - Thành viên trả tiền mặt tại quầy'
                },
                receptionistUser,
                'idem-corp-cash-01'
            );

            expect(res.bookingStatus).toBe('CONFIRMED_PAID');
            expect(res.paymentMethod).toBe('CASH_ON_ARRIVAL');
            expect(res.corporateDebtAccount).toBe(companyId);

            // Kiểm tra INSERT bookings được gán cho memberId thay vì ID của lễ tân
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO bookings'),
                expect.arrayContaining([memberId, validRoomId, validSlotId])
            );
        });

        it('2.2. Tự động cấp phát slot động khi truyền startTime và endTime hợp lệ', async () => {
            const validRoomId = 'r0000000-0000-0000-0000-000000000002';
            const futureStart = '2026-11-09T14:00:00.000Z';
            const futureEnd = '2026-11-09T16:00:00.000Z';

            mockClient.query
                // Query slot theo thời gian chưa có sẵn
                .mockResolvedValueOnce({ rows: [] })
                // Query room info
                .mockResolvedValueOnce({
                    rows: [{ id: validRoomId, name: 'Executive Room Tokyo', hourly_rate: '650000', is_active: true }]
                })
                // INSERT slots
                .mockResolvedValueOnce({ rowCount: 1 })
                // BEGIN
                .mockResolvedValueOnce({})
                // INSERT bookings
                .mockResolvedValueOnce({
                    rows: [{ id: 'bkg-dyn-1', booking_code: 'BKG-DYN-01', created_at: new Date().toISOString() }]
                })
                // UPDATE slots
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT cash_book_logs
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT outbox_events
                .mockResolvedValueOnce({ rowCount: 1 })
                // COMMIT
                .mockResolvedValueOnce({});

            const res = await bookingService.createBooking(
                {
                    roomId: validRoomId,
                    bookingDate: '2026-11-09',
                    startTime: futureStart,
                    endTime: futureEnd,
                    paymentMethod: 'CASH_ON_ARRIVAL',
                    customerName: 'Khách Đặt Khung Mới',
                    customerPhone: '0912345678'
                },
                receptionistUser,
                'idem-dynamic-slot-01'
            );

            expect(res.bookingStatus).toBe('CONFIRMED_PAID');
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO slots'),
                expect.arrayContaining([expect.any(String), validRoomId, futureStart, futureEnd])
            );
        });

        it('2.3. Chấp nhận roomId dạng r-1794125428360 từ Web Admin Store và hoàn tất thu tiền mặt 100%', async () => {
            const adminRoomId = 'r-1794125428360';
            const syntheticSlotId = 'slot-r-1794125428360-2026-11-09-19:00';
            const futureStart = '2026-11-09T19:00:00.000Z';
            const futureEnd = '2026-11-09T21:00:00.000Z';

            mockClient.query
                // Query slot theo synthetic slotId -> không thấy vì không phải UUID
                // Query slot theo (roomId, startTime, endTime)
                .mockResolvedValueOnce({ rows: [] })
                // Query room info theo (id::text = $1 OR name = $1)
                .mockResolvedValueOnce({
                    rows: [{ id: 'r0000000-0000-0000-0000-000000000002', name: 'Executive Boardroom Tokyo', hourly_rate: '650000', is_active: true }]
                })
                // INSERT slots
                .mockResolvedValueOnce({ rowCount: 1 })
                // BEGIN
                .mockResolvedValueOnce({})
                // INSERT bookings
                .mockResolvedValueOnce({
                    rows: [{ id: 'bkg-admin-room-1', booking_code: 'BKG-ADMIN-01', created_at: new Date().toISOString() }]
                })
                // UPDATE slots
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT cash_book_logs
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT outbox_events
                .mockResolvedValueOnce({ rowCount: 1 })
                // COMMIT
                .mockResolvedValueOnce({});

            const res = await bookingService.createBooking(
                {
                    roomId: adminRoomId,
                    slotId: syntheticSlotId,
                    bookingDate: '2026-11-09',
                    startTime: futureStart,
                    endTime: futureEnd,
                    paymentMethod: 'CASH_ON_ARRIVAL',
                    customerName: 'gjyoisvglksanfljsalj;',
                    customerPhone: '0888237961',
                    notes: 'học aoisjf;osajlkfsalkm'
                },
                receptionistUser,
                'idem-admin-custom-room-01'
            );

            expect(res.bookingStatus).toBe('CONFIRMED_PAID');
            expect(res.paymentMethod).toBe('CASH_ON_ARRIVAL');
            expect(res.paymentStatus).toBe('PAID');
            expect(res.totalAmount).toBe(1300000);
        });
    });
});

