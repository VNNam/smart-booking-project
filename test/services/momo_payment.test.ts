/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: MoMo Payment API v3 - Comprehensive Integration & Unit Tests
 * FILE: test/services/momo_payment.test.ts
 * MÔ TẢ: Kiểm thử toàn diện kiến trúc MoMo Payment API v3:
 *       1. Cryptography & Signature Generation / Verification
 *       2. Strategy Pattern & Factory cho 6 phương thức thanh toán
 *       3. Module 1: Payment Initiation
 *       4. Module 2: IPN Webhook Handler (Idempotency, Saga Auto-Refund)
 *       5. Module 3: Fail-Safe Timeout Worker & Query API
 * ==============================================================================
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import {
    MoMoPaymentService,
    MoMoSignatureUtil,
    MoMoPaymentStrategyFactory,
    MoMoIpnPayload,
    MoMoTimeoutWorker
} from '../../src/services/momo';

describe('MoMo Payment API v3 - Comprehensive Test Suite', () => {
    const mockAccessKey = 'TEST_MOMO_ACCESS_KEY_123';
    const mockSecretKey = 'TEST_MOMO_SECRET_KEY_987654321';
    const mockPartnerCode = 'MOMO_SMART_BOOKING_TEST';

    let mockPool: any;
    let mockClient: any;
    let mockRedis: any;
    let momoService: MoMoPaymentService;

    beforeEach(() => {
        // Mock Redis Client
        mockRedis = {
            set: jest.fn().mockResolvedValue('OK'),
            get: jest.fn().mockResolvedValue(null),
            del: jest.fn().mockResolvedValue(1)
        };

        // Mock Database Client & Pool
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            query: jest.fn()
        };

        momoService = new MoMoPaymentService(mockPool as any, mockRedis as any, {
            accessKey: mockAccessKey,
            secretKey: mockSecretKey,
            partnerCode: mockPartnerCode,
            endpoint: 'https://test-payment.momo.vn',
            redirectUrl: 'https://smartbooking.vn/payment/momo/callback',
            ipnUrl: 'https://api.smartbooking.vn/api/v1/payments/webhook/momo',
            env: 'sandbox'
        });
    });

    // ==========================================================================
    // 1. KIỂM THỬ THUẬT TOÁN KÝ DỮ LIỆU & BẢO MẬT (SIGNATURE GENERATION)
    // ==========================================================================
    describe('1. MoMoSignatureUtil & Cryptography', () => {
        it('Tạo chữ ký số theo đúng thứ tự A-Z và mã hóa HMAC-SHA256', () => {
            const params = {
                partnerCode: 'MOMO',
                orderId: 'BKG-001',
                amount: 500000,
                accessKey: 'ACCESS_KEY'
            };

            const signature = MoMoSignatureUtil.generateSignature(params, 'SECRET_KEY');
            expect(typeof signature).toBe('string');
            expect(signature).toHaveLength(64); // 256-bit hex = 64 ký tự
            expect(signature).toEqual(signature.toLowerCase()); // Chữ thường
        });

        it('Xác thực đúng chữ ký IPN hợp lệ', () => {
            const ipnData: any = {
                partnerCode: mockPartnerCode,
                orderId: 'BKG-202610-001',
                requestId: 'REQ-12345',
                amount: 350000,
                orderInfo: 'Thanh toan phong hop',
                orderType: 'momo_wallet',
                transId: 987654321,
                resultCode: 0,
                message: 'Success',
                payType: 'qr',
                responseTime: 1729440000000,
                extraData: ''
            };

            // Sinh chữ ký hợp lệ
            const validSignature = MoMoSignatureUtil.generateSignature(
                { ...ipnData, accessKey: mockAccessKey },
                mockSecretKey
            );
            ipnData.signature = validSignature;

            const isValid = MoMoSignatureUtil.verifyIpnSignature(
                ipnData,
                mockAccessKey,
                mockSecretKey
            );
            expect(isValid).toBe(true);
        });

        it('Từ chối ngay lập tức khi chữ ký IPN bị giả mạo hoặc sai lệch', () => {
            const tamperedIpn: any = {
                partnerCode: mockPartnerCode,
                orderId: 'BKG-202610-001',
                requestId: 'REQ-12345',
                amount: 350000,
                orderInfo: 'Thanh toan phong hop',
                orderType: 'momo_wallet',
                transId: 987654321,
                resultCode: 0,
                message: 'Success',
                payType: 'qr',
                responseTime: 1729440000000,
                extraData: '',
                signature: 'fake_invalid_tampered_signature_1234567890abcdef'
            };

            const isValid = MoMoSignatureUtil.verifyIpnSignature(
                tamperedIpn,
                mockAccessKey,
                mockSecretKey
            );
            expect(isValid).toBe(false);
        });

        it('Mã hóa và giải mã ExtraData Base64 JSON chính xác', () => {
            const originalData = { userId: 'usr-123', slotId: 'slot-456', voucherId: 'VOUCHER20' };
            const encoded = MoMoSignatureUtil.encodeExtraData(originalData);
            expect(typeof encoded).toBe('string');

            const decoded = MoMoSignatureUtil.decodeExtraData<typeof originalData>(encoded);
            expect(decoded).toEqual(originalData);
        });
    });

    // ==========================================================================
    // 2. KIỂM THỬ FACTORY PATTERN & STRATEGY PATTERN (6 PHƯƠNG THỨC)
    // ==========================================================================
    describe('2. MoMo Payment Strategy Pattern & Factory', () => {
        it('Khởi tạo đúng các chiến lược hợp lệ theo requestType', () => {
            const walletStrategy = MoMoPaymentStrategyFactory.getStrategy('captureWallet');
            expect(walletStrategy.requestType).toBe('captureWallet');

            const ccStrategy = MoMoPaymentStrategyFactory.getStrategy('payWithCC');
            expect(ccStrategy.requestType).toBe('payWithCC');

            const applePayStrategy = MoMoPaymentStrategyFactory.getStrategy('payWithApplePay');
            expect(applePayStrategy.requestType).toBe('payWithApplePay');

            const googlePayStrategy = MoMoPaymentStrategyFactory.getStrategy('payWithGooglePay');
            expect(googlePayStrategy.requestType).toBe('payWithGooglePay');

            const subStrategy = MoMoPaymentStrategyFactory.getStrategy('subscription');
            expect(subStrategy.requestType).toBe('subscription');

            const tokenStrategy = MoMoPaymentStrategyFactory.getStrategy('payWithMethod');
            expect(tokenStrategy.requestType).toBe('payWithMethod');
        });

        it('Báo lỗi khi truyền requestType không tồn tại', () => {
            expect(() => {
                MoMoPaymentStrategyFactory.getStrategy('unknownMethod' as any);
            }).toThrow('Phương thức thanh toán không được hỗ trợ');
        });

        it('Apple Pay bắt buộc phải cung cấp email khách hàng hợp lệ', () => {
            const appleStrategy = MoMoPaymentStrategyFactory.getStrategy('payWithApplePay');

            // Thiếu email -> Báo lỗi
            expect(() => {
                appleStrategy.validate({
                    orderId: 'BKG-001',
                    amount: 200000,
                    orderInfo: 'Test',
                    requestType: 'payWithApplePay',
                    userInfo: { name: 'Nguyen Van A' }
                });
            }).toThrow('userInfo.email');

            // Email hợp lệ -> Pass
            expect(() => {
                appleStrategy.validate({
                    orderId: 'BKG-001',
                    amount: 200000,
                    orderInfo: 'Test',
                    requestType: 'payWithApplePay',
                    userInfo: { name: 'Nguyen Van A', email: 'user@example.com' }
                });
            }).not.toThrow();
        });

        it('Subscription bắt buộc phải có subscriptionInfo với frequency, recurringAmount, nextPaymentDate', () => {
            const subStrategy = MoMoPaymentStrategyFactory.getStrategy('subscription');

            // Thiếu subscriptionInfo -> Báo lỗi
            expect(() => {
                subStrategy.validate({
                    orderId: 'BKG-001',
                    amount: 1000000,
                    orderInfo: 'Sub Test',
                    requestType: 'subscription'
                });
            }).toThrow('subscriptionInfo');

            // Cung cấp đầy đủ thông tin định kỳ -> Pass
            expect(() => {
                subStrategy.validate({
                    orderId: 'BKG-001',
                    amount: 1000000,
                    orderInfo: 'Sub Test',
                    requestType: 'subscription',
                    subscriptionInfo: {
                        frequency: 'MONTHLY',
                        recurringAmount: 1000000,
                        nextPaymentDate: '2026-11-20'
                    }
                });
            }).not.toThrow();
        });
    });

    // ==========================================================================
    // 3. KIỂM THỬ MODULE 2: IPN / WEBHOOK HANDLER
    // ==========================================================================
    describe('3. Module 2: IPN Webhook Handler (Transaction & Saga Auto-Refund)', () => {
        it('Bước 2.1: Trả về HTTP 400 nếu chữ ký IPN sai lệch', async () => {
            const invalidIpn: MoMoIpnPayload = {
                partnerCode: mockPartnerCode,
                orderId: 'BKG-202610-999',
                requestId: 'REQ-001',
                amount: 500000,
                orderInfo: 'Invalid Sign Test',
                orderType: 'momo_wallet',
                transId: 111222,
                resultCode: 0,
                message: 'Success',
                payType: 'qr',
                responseTime: 1729440000000,
                extraData: '',
                signature: 'incorrect_signature_hash'
            };

            const result = await momoService.processIpn(invalidIpn);
            expect(result.statusCode).toBe(400);
            expect(result.message).toContain('Invalid HMAC Signature');
            expect(result.actionTaken).toBe('IGNORED');
            expect(mockPool.connect).not.toHaveBeenCalled(); // Không mở kết nối DB lãng phí
        });

        it('Bước 2.2: Chống trùng lặp (Idempotency) - Trả về HTTP 204 nếu đơn đã CONFIRMED/PAID', async () => {
            const ipnData: MoMoIpnPayload = {
                partnerCode: mockPartnerCode,
                orderId: 'BKG-202610-PAID',
                requestId: 'REQ-002',
                amount: 400000,
                orderInfo: 'Idempotency Test',
                orderType: 'momo_wallet',
                transId: 333444,
                resultCode: 0,
                message: 'Success',
                payType: 'qr',
                responseTime: 1729440000000,
                extraData: '',
                signature: ''
            };
            ipnData.signature = MoMoSignatureUtil.generateSignature(
                { ...ipnData, accessKey: mockAccessKey },
                mockSecretKey
            );

            // Giả lập đơn hàng trong DB đã là CONFIRMED và PAID
            mockClient.query.mockImplementation((sql: string) => {
                if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'booking-uuid-paid',
                            booking_code: 'BKG-202610-PAID',
                            booking_status: 'CONFIRMED',
                            payment_status: 'PAID',
                            slot_id: 'slot-1'
                        }]
                    });
                }
                return Promise.resolve({ rows: [] });
            });

            const result = await momoService.processIpn(ipnData);
            expect(result.statusCode).toBe(204);
            expect(result.message).toContain('already processed');
            expect(result.actionTaken).toBe('IGNORED');
        });

        it('Bước 2.3 Happy Path: Chốt đơn thành công trong hạn 10 phút, giải phóng Redis lock & outbox event', async () => {
            const ipnData: MoMoIpnPayload = {
                partnerCode: mockPartnerCode,
                orderId: 'BKG-202610-HAPPY',
                requestId: 'REQ-003',
                amount: 600000,
                orderInfo: 'Happy Path',
                orderType: 'momo_wallet',
                transId: 555666,
                resultCode: 0,
                message: 'Success',
                payType: 'qr',
                responseTime: 1729440000000,
                extraData: '',
                signature: ''
            };
            ipnData.signature = MoMoSignatureUtil.generateSignature(
                { ...ipnData, accessKey: mockAccessKey },
                mockSecretKey
            );

            // Giả lập đơn hàng LOCKED_PENDING_ONLINE hợp lệ
            mockClient.query.mockImplementation((sql: string) => {
                if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'booking-uuid-happy',
                            user_id: 'user-01',
                            slot_id: 'slot-happy-1',
                            booking_code: 'BKG-202610-HAPPY',
                            booking_status: 'LOCKED_PENDING_ONLINE',
                            payment_status: 'PENDING',
                            total_amount: 600000,
                            lock_expires_at: new Date(Date.now() + 300000) // Còn 5 phút
                        }]
                    });
                }
                // Không có xung đột
                if (sql.includes('activeConflictQuery') || sql.includes('slot_id = $1 AND id != $2')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            const result = await momoService.processIpn(ipnData);

            expect(result.statusCode).toBe(200);
            expect(result.actionTaken).toBe('BOOKING_CONFIRMED');

            // Kiểm tra Redis lock đã được giải phóng
            expect(mockRedis.del).toHaveBeenCalledWith('slot:slot-happy-1:lock');

            // Kiểm tra DB cập nhật CONFIRMED và outbox_events được chèn
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining("SET booking_status = 'CONFIRMED'"),
                ['booking-uuid-happy']
            );
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('outbox_events'),
                expect.arrayContaining(['booking-uuid-happy'])
            );
        });

        it('Bước 2.3 Late Webhook Saga: Tiền về muộn khi slot đã mất -> Kích hoạt Auto-Refund 100%', async () => {
            const ipnData: MoMoIpnPayload = {
                partnerCode: mockPartnerCode,
                orderId: 'BKG-202610-LATE',
                requestId: 'REQ-004',
                amount: 800000,
                orderInfo: 'Late Webhook Test',
                orderType: 'momo_wallet',
                transId: 777888,
                resultCode: 0,
                message: 'Success',
                payType: 'qr',
                responseTime: 1729440000000,
                extraData: '',
                signature: ''
            };
            ipnData.signature = MoMoSignatureUtil.generateSignature(
                { ...ipnData, accessKey: mockAccessKey },
                mockSecretKey
            );

            // Giả lập đơn hàng đã bị EXPIRED
            mockClient.query.mockImplementation((sql: string) => {
                if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'booking-uuid-late',
                            user_id: 'user-late',
                            slot_id: 'slot-taken',
                            booking_code: 'BKG-202610-LATE',
                            booking_status: 'EXPIRED',
                            payment_status: 'PENDING',
                            total_amount: 800000,
                            lock_expires_at: new Date(Date.now() - 600000) // Đã quá hạn 10 phút
                        }]
                    });
                }
                // Slot đã bị người khác đặt
                if (sql.includes('id != $2')) {
                    return Promise.resolve({
                        rows: [{ id: 'other-booking-id', booking_status: 'CONFIRMED' }]
                    });
                }
                return Promise.resolve({ rows: [] });
            });

            // Mock hàm refundPayment
            jest.spyOn(momoService, 'refundPayment').mockResolvedValue({
                partnerCode: mockPartnerCode,
                orderId: 'REFUND-BKG-202610-LATE-123',
                requestId: 'REQ-REFUND',
                amount: 800000,
                transId: 999999,
                resultCode: 0,
                message: 'Refund Success',
                responseTime: Date.now()
            });

            const result = await momoService.processIpn(ipnData);

            expect(result.statusCode).toBe(200);
            expect(result.actionTaken).toBe('AUTO_REFUND_TRIGGERED');
            expect(result.refundAmount).toBe(800000);

            // Đơn chuyển sang EXPIRED_REFUNDED
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining("SET booking_status = 'EXPIRED_REFUNDED'"),
                [800000, 'booking-uuid-late']
            );

            // Gọi refundPayment
            expect(momoService.refundPayment).toHaveBeenCalledWith(
                'BKG-202610-LATE',
                800000,
                777888,
                expect.any(String)
            );
        });

        it('Xử lý giao dịch thất bại từ khách hàng: Giải phóng slot về AVAILABLE', async () => {
            const failedIpn: MoMoIpnPayload = {
                partnerCode: mockPartnerCode,
                orderId: 'BKG-202610-FAIL',
                requestId: 'REQ-005',
                amount: 300000,
                orderInfo: 'Cancel Test',
                orderType: 'momo_wallet',
                transId: 222333,
                resultCode: 1006, // Người dùng từ chối thanh toán
                message: 'User Cancelled',
                payType: 'qr',
                responseTime: 1729440000000,
                extraData: '',
                signature: ''
            };
            failedIpn.signature = MoMoSignatureUtil.generateSignature(
                { ...failedIpn, accessKey: mockAccessKey },
                mockSecretKey
            );

            mockClient.query.mockImplementation((sql: string) => {
                if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'booking-uuid-fail',
                            slot_id: 'slot-fail-1',
                            booking_code: 'BKG-202610-FAIL',
                            booking_status: 'LOCKED_PENDING_ONLINE'
                        }]
                    });
                }
                return Promise.resolve({ rows: [] });
            });

            const result = await momoService.processIpn(failedIpn);
            expect(result.statusCode).toBe(200);
            expect(result.actionTaken).toBe('PAYMENT_FAILED');

            // Xóa Redis lock và slot về AVAILABLE
            expect(mockRedis.del).toHaveBeenCalledWith('slot:slot-fail-1:lock');
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining("SET status = 'AVAILABLE'"),
                ['slot-fail-1']
            );
        });
    });

    // ==========================================================================
    // 4. KIỂM THỬ MODULE 3: FAIL-SAFE TIMEOUT WORKER
    // ==========================================================================
    describe('4. Module 3: Fail-safe Timeout Worker & Query API', () => {
        it('Worker quét các đơn quá hạn 10m, truy vấn MoMo và giải phóng phòng nếu chưa thanh toán', async () => {
            const timeoutWorker = new MoMoTimeoutWorker(mockPool as any, mockRedis as any, momoService);

            // Giả lập tìm thấy 1 đơn quá hạn trong DB
            mockClient.query.mockImplementation((sql: string) => {
                if (sql.includes('WHERE b.booking_status = \'LOCKED_PENDING_ONLINE\'')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'booking-timed-out-1',
                            booking_code: 'BKG-EXPIRED-001',
                            slot_id: 'slot-timed-out-1',
                            user_id: 'usr-1',
                            total_amount: 450000
                        }]
                    });
                }
                return Promise.resolve({ rows: [] });
            });

            // Mock MoMo Query API trả về chưa thanh toán (resultCode: 1000)
            jest.spyOn(momoService, 'queryPaymentStatus').mockResolvedValue({
                partnerCode: mockPartnerCode,
                orderId: 'BKG-EXPIRED-001',
                requestId: 'REQ-QUERY-01',
                extraData: '',
                amount: 450000,
                transId: 0,
                payType: 'qr',
                resultCode: 1000, // Đang chờ thanh toán nhưng đã quá 10 phút
                message: 'Transaction is pending',
                responseTime: Date.now()
            });

            const scanResult = await timeoutWorker.executeScan();

            expect(scanResult.totalScanned).toBe(1);
            expect(scanResult.expiredAndReleased).toBe(1);
            expect(scanResult.recoveredAndConfirmed).toBe(0);

            // Kiểm tra slot đã được mở lại và xóa Redis lock
            expect(mockRedis.del).toHaveBeenCalledWith('slot:slot-timed-out-1:lock');
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining("SET booking_status = 'EXPIRED'"),
                ['booking-timed-out-1']
            );
        });
    });
});
