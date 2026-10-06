/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Sprint 3 QA - End-to-End (E2E) Test Suite
 * FILE: test/e2e/admin_cash_refund.cy.ts
 * MÔ TẢ: Kịch bản kiểm thử E2E tự động hóa bằng Cypress cho quy trình Quản trị
 *       viên/Lễ tân hủy đơn và hoàn tiền mặt tại quầy (Two-Man Rule):
 *       - Case 1: Chặn hoàn tiền mặt khi thiếu mã OTP Quản lý ca trực (Shift Supervisor)
 *       - Case 2: Từ chối hoàn tiền khi nhập sai mã OTP Quản lý
 *       - Case 3: Xác thực OTP thành công, sinh phiếu chi CASH_OUT_REFUND vào sổ quỹ
 *       - Case 4: Kiểm chứng chính sách phạt hủy phân tầng (>24h, 2h-24h, <2h)
 *       - Case 5: Kiểm chứng giới hạn 2 lần hủy miễn phạt trong tháng (Cap 70%)
 * ==============================================================================
 */

describe('Sprint 3: Web Admin Cash Booking & Two-Man Rule Cash Refund E2E Tests', () => {
    const mockCashBooking = {
        id: 'bkg-cash-001',
        bookingCode: 'BKG-WALK-89211',
        roomName: 'Meeting Room Alpha',
        customerName: 'Nguyễn Văn Test',
        customerPhone: '0988776655',
        startTime: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(), // > 24h (Hoàn 100%)
        endTime: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString(),
        totalAmount: 700000,
        paymentMethod: 'CASH_ON_ARRIVAL',
        monthlyCancelCount: 0
    };

    const mockNearMeetingBooking = {
        id: 'bkg-cash-002',
        bookingCode: 'BKG-WALK-89212',
        roomName: 'Executive Boardroom Tokyo',
        customerName: 'Lê Thị Thu',
        customerPhone: '0911223344',
        startTime: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(), // 10h (2h - 24h: Hoàn 80%)
        endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        totalAmount: 1600000,
        paymentMethod: 'CASH_ON_ARRIVAL',
        monthlyCancelCount: 0
    };

    const mockUrgentMeetingBooking = {
        id: 'bkg-cash-003',
        bookingCode: 'BKG-WALK-89213',
        roomName: 'Meeting Room Alpha',
        customerName: 'Hoàng Văn Sát Giờ',
        customerPhone: '0933445566',
        startTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1h (< 2h: Hoàn 0%)
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        totalAmount: 350000,
        paymentMethod: 'CASH_ON_ARRIVAL',
        monthlyCancelCount: 0
    };

    beforeEach(() => {
        // Mock API GET thông tin phòng & slots
        cy.intercept('GET', '/api/v1/rooms*', {
            statusCode: 200,
            body: [
                {
                    id: 'r0000000-0000-0000-0000-000000000001',
                    name: 'Meeting Room Alpha',
                    roomType: 'STANDARD',
                    capacity: 8,
                    hourlyRate: 350000
                }
            ]
        }).as('getRooms');
    });

    /**
     * TEST SUITE 1: CASH WALK-IN BOOKING (LỄ TÂN THU TIỀN MẶT)
     */
    it('1. Tạo đơn đặt phòng trực tiếp tại quầy thành công kèm Idempotency-Key', () => {
        // Mock POST API đặt phòng thu tiền mặt
        cy.intercept('POST', '/api/v1/bookings', (req) => {
            expect(req.headers).to.have.property('idempotency-key');
            expect(req.body.paymentMethod).to.equal('CASH_ON_ARRIVAL');
            req.reply({
                statusCode: 201,
                body: {
                    bookingCode: 'BKG-WALK-99001',
                    cashBookEntryId: 'CB-20261006-0001',
                    totalAmount: 700000,
                    status: 'CONFIRMED'
                }
            });
        }).as('createCashBooking');

        // Mở trang Web Admin Cash Booking
        cy.visit('/cash-booking');

        // Chọn slot phòng còn trống
        cy.get('[id^="slot-btn-"]').first().click();

        // Điền form thông tin khách hàng tại quầy
        cy.get('#customer-name-input').type('Đặng Văn Lâm');
        cy.get('#customer-phone-input').type('0909123456');
        cy.get('#meeting-notes-input').type('Họp ban quản trị công ty');

        // Bấm xác nhận thu tiền mặt
        cy.get('#btn-confirm-cash').click();

        // Chờ API hoàn tất và xác thực modal biên nhận
        cy.wait('@createCashBooking');
        cy.get('#receipt-modal-backdrop').should('be.visible');
        cy.get('#receipt-booking-code').should('contain', 'BKG-WALK-99001');
    });

    /**
     * TEST SUITE 2: TWO-MAN RULE FOR CASH REFUND (QUY TẮC PHÊ DUYỆT 2 NGƯỜI)
     */
    describe('Two-Man Rule & Tiered Refund Modal Tests', () => {
        beforeEach(() => {
            // Thiết lập mock router hoặc mock component container cho RefundModal
            cy.visit('/admin/bookings');
        });

        it('2. Chặn hoàn tiền mặt nếu Lễ tân không nhập mã OTP của Quản lý ca trực (OTP_REQUIRED)', () => {
            // Mock API từ chối nếu thiếu OTP
            cy.intercept('POST', '/api/v1/bookings/*/cancel', (req) => {
                if (!req.body.supervisorOtp) {
                    req.reply({
                        statusCode: 400,
                        body: {
                            errorCode: 'OTP_REQUIRED',
                            message: 'Hủy đơn hoàn tiền mặt yêu cầu mã OTP xác thực từ Quản lý ca trực (Two-Man Rule).'
                        }
                    });
                }
            }).as('cancelWithoutOtp');

            // Giả lập mở modal hoàn tiền cho đơn bkg-cash-001 (>24h)
            cy.window().then((win: any) => {
                if (win.openRefundModal) {
                    win.openRefundModal(mockCashBooking);
                }
            });

            cy.get('#refund-modal-backdrop').should('be.visible');
            cy.get('#refund-booking-code').should('contain', mockCashBooking.bookingCode);

            // Nhập lý do hủy nhưng để trống OTP Quản lý
            cy.get('#refund-reason-input').type('Khách báo bận công tác');
            cy.get('#btn-confirm-refund').click();

            // Kiểm tra cảnh báo lỗi Two-Man Rule xuất hiện
            cy.get('#refund-error-alert').should('be.visible');
            cy.get('#refund-error-alert').should('contain', 'Two-Man Rule');
        });

        it('3. Từ chối hoàn tiền khi nhập sai mã OTP Quản lý ca trực (INVALID_OTP)', () => {
            // Mock API trả về mã lỗi INVALID_OTP
            cy.intercept('POST', '/api/v1/bookings/*/cancel', {
                statusCode: 400,
                body: {
                    errorCode: 'INVALID_OTP',
                    message: 'Mã OTP của Quản lý ca trực không chính xác hoặc đã hết hạn.'
                }
            }).as('cancelWithInvalidOtp');

            cy.get('#refund-modal-backdrop').should('be.visible');
            cy.get('#refund-reason-input').clear().type('Khách đổi ý hủy lịch');

            // Nhập mã OTP không đúng
            cy.get('#refund-otp-input').type('000111');
            cy.get('#btn-confirm-refund').click();

            cy.wait('@cancelWithInvalidOtp');

            // Hiển thị thông báo mã OTP không hợp lệ
            cy.get('#refund-error-alert').should('be.visible');
            cy.get('#refund-error-alert').should('contain', 'Mã OTP của Quản lý ca trực không chính xác');
        });

        it('4. Phê duyệt OTP thành công (Two-Man Rule): Hoàn 100% tiền mặt và xuất phiếu chi CASH_OUT_REFUND', () => {
            // Mock API hủy và duyệt hoàn tiền mặt thành công
            cy.intercept('POST', '/api/v1/bookings/*/cancel', (req) => {
                expect(req.body.supervisorOtp).to.equal('888999');
                req.reply({
                    statusCode: 200,
                    body: {
                        bookingId: mockCashBooking.id,
                        bookingCode: mockCashBooking.bookingCode,
                        refundAmount: 700000,
                        penaltyFee: 0,
                        refundPercentage: 100,
                        cashBookEntryId: 'CASH-OUT-202610-0991',
                        status: 'CANCELLED'
                    }
                });
            }).as('cancelSuccess');

            // Yêu cầu phát sinh OTP
            cy.get('#btn-request-supervisor-otp').click();

            // Nhập mã OTP hợp lệ
            cy.get('#refund-otp-input').clear().type('888999');
            cy.get('#btn-confirm-refund').click();

            cy.wait('@cancelSuccess');

            // Kiểm tra biên nhận hoàn tiền hiển thị đầy đủ thông tin
            cy.get('#refund-success-receipt').should('be.visible');
            cy.get('#receipt-booking-code').should('contain', mockCashBooking.bookingCode);
            cy.get('#refund-amount-display').should('contain', '700.000');
            cy.get('#refund-cash-book-entry').should('contain', 'CASH-OUT-202610-0991');

            // Nút in phiếu chi hoạt động
            cy.get('#btn-print-refund-receipt').should('be.visible');
            cy.get('#btn-done-refund').click();
            cy.get('#refund-modal-backdrop').should('not.exist');
        });
    });

    /**
     * TEST SUITE 3: KIỂM CHỨNG CHÍNH SÁCH PHẠT HỦY PHÂN TẦNG (TIERED CANCELLATION)
     */
    describe('Chính sách phạt hủy phân tầng (>24h: 100%, 2h-24h: 80%, <2h: 0%)', () => {
        it('5. Đơn hủy từ 2h đến 24h: Tự động trừ phí phạt 20%, chỉ hoàn 80%', () => {
            cy.window().then((win: any) => {
                if (win.openRefundModal) {
                    win.openRefundModal(mockNearMeetingBooking);
                }
            });

            // Tỷ lệ hoàn 80%, Phạt 20%
            cy.get('#refund-percentage').should('contain', '80%');
            // Số tiền hoàn: 1.600.000 * 80% = 1.280.000 VNĐ
            cy.get('#refund-amount-display').should('contain', '1.280.000');
            // Phí phạt: 1.600.000 * 20% = 320.000 VNĐ
            cy.get('#refund-penalty-display').should('contain', '320.000');
        });

        it('6. Đơn hủy sát giờ (< 2 giờ): Phạt 100%, hoàn tiền 0 VNĐ và không yêu cầu OTP Two-Man Rule', () => {
            cy.window().then((win: any) => {
                if (win.openRefundModal) {
                    win.openRefundModal(mockUrgentMeetingBooking);
                }
            });

            // Tỷ lệ hoàn 0%
            cy.get('#refund-percentage').should('contain', '0%');
            cy.get('#refund-amount-display').should('contain', '0');
            cy.get('#refund-penalty-display').should('contain', '350.000');

            // Khi số tiền hoàn = 0 VNĐ, không yêu cầu nhập mã OTP Quản lý chi quỹ
            cy.get('#refund-otp-input').should('not.exist');
        });

        it('7. Người dùng vượt quá 2 lần hủy trong tháng: Bị phạt thêm 30% (Hoàn tối đa 70%)', () => {
            const frequentCancelBooking = {
                ...mockCashBooking,
                id: 'bkg-frequent-01',
                monthlyCancelCount: 3 // Đã hủy 3 lần trong tháng
            };

            cy.window().then((win: any) => {
                if (win.openRefundModal) {
                    win.openRefundModal(frequentCancelBooking);
                }
            });

            // Mặc dù trước > 24h (vốn là 100%), nhưng do đã hủy > 2 lần nên bị cap lại ở 70%
            cy.get('#refund-percentage').should('contain', '70%');
            cy.get('#refund-tier-badge').should('contain', 'vượt quá 2 lần');
        });
    });
});
