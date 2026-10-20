/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: MoMo Payment Strategies & Strategy Factory
 * FILE: src/services/momo/strategies/index.ts
 * MÔ TẢ: Triển khai Design Pattern: Strategy Pattern & Factory Pattern cho 6 phương
 *       thức thanh toán MoMo API v3:
 *       1. CaptureWalletStrategy (Ví MoMo QR / App)
 *       2. PayWithCreditCardStrategy (Thẻ quốc tế Visa/Mastercard)
 *       3. PayWithApplePayStrategy (Apple Pay - Bắt buộc userInfo.email)
 *       4. PayWithGooglePayStrategy (Google Pay)
 *       5. SubscriptionStrategy (Định kỳ - Bắt buộc subscriptionInfo)
 *       6. TokenizationStrategy (payWithMethod - Lưu thẻ/ví token)
 * ==============================================================================
 */

import { IMoMoPaymentStrategy } from './IMoMoPaymentStrategy';
import {
    MoMoCreatePaymentInput,
    MoMoCreatePaymentRequest,
    MoMoRequestType
} from '../types';

/**
 * 1. CHIẾN LƯỢC: VÍ MOMO CƠ BẢN (QR Code / Deep-link App)
 */
export class CaptureWalletStrategy implements IMoMoPaymentStrategy {
    readonly requestType: MoMoRequestType = 'captureWallet';

    validate(input: MoMoCreatePaymentInput): void {
        if (!input.amount || input.amount <= 0) {
            throw new Error('[CaptureWalletStrategy] Số tiền thanh toán phải lớn hơn 0.');
        }
    }

    enrichPayload(
        input: MoMoCreatePaymentInput,
        basePayload: Partial<MoMoCreatePaymentRequest>
    ): Partial<MoMoCreatePaymentRequest> {
        return {
            ...basePayload,
            requestType: this.requestType,
            autoCapture: input.autoCapture !== undefined ? input.autoCapture : true
        };
    }
}

/**
 * 2. CHIẾN LƯỢC: THẺ TÍN DỤNG QUỐC TẾ (Visa/Mastercard/JCB)
 */
export class PayWithCreditCardStrategy implements IMoMoPaymentStrategy {
    readonly requestType: MoMoRequestType = 'payWithCC';

    validate(input: MoMoCreatePaymentInput): void {
        if (!input.amount || input.amount < 10000) {
            throw new Error('[PayWithCreditCardStrategy] Số tiền thanh toán thẻ quốc tế tối thiểu là 10,000 VND.');
        }
    }

    enrichPayload(
        input: MoMoCreatePaymentInput,
        basePayload: Partial<MoMoCreatePaymentRequest>
    ): Partial<MoMoCreatePaymentRequest> {
        return {
            ...basePayload,
            requestType: this.requestType,
            autoCapture: true
        };
    }
}

/**
 * 3. CHIẾN LƯỢC: APPLE PAY
 * Quy tắc: Bắt buộc truyền userInfo.email và yêu cầu FE check canMakePayments()
 */
export class PayWithApplePayStrategy implements IMoMoPaymentStrategy {
    readonly requestType: MoMoRequestType = 'payWithApplePay';

    validate(input: MoMoCreatePaymentInput): void {
        if (!input.userInfo || !input.userInfo.email) {
            throw new Error(
                '[PayWithApplePayStrategy] Phương thức Apple Pay bắt buộc phải cung cấp userInfo.email của khách hàng.'
            );
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.userInfo.email)) {
            throw new Error('[PayWithApplePayStrategy] Email khách hàng không hợp lệ cho Apple Pay.');
        }
    }

    enrichPayload(
        input: MoMoCreatePaymentInput,
        basePayload: Partial<MoMoCreatePaymentRequest>
    ): Partial<MoMoCreatePaymentRequest> {
        return {
            ...basePayload,
            requestType: this.requestType,
            userInfo: input.userInfo
        };
    }
}

/**
 * 4. CHIẾN LƯỢC: GOOGLE PAY
 */
export class PayWithGooglePayStrategy implements IMoMoPaymentStrategy {
    readonly requestType: MoMoRequestType = 'payWithGooglePay';

    validate(input: MoMoCreatePaymentInput): void {
        if (!input.amount || input.amount <= 0) {
            throw new Error('[PayWithGooglePayStrategy] Số tiền thanh toán không hợp lệ.');
        }
    }

    enrichPayload(
        input: MoMoCreatePaymentInput,
        basePayload: Partial<MoMoCreatePaymentRequest>
    ): Partial<MoMoCreatePaymentRequest> {
        return {
            ...basePayload,
            requestType: this.requestType,
            userInfo: input.userInfo
        };
    }
}

/**
 * 5. CHIẾN LƯỢC: THANH TOÁN ĐỊNH KỲ (Subscription)
 * Quy tắc: Bắt buộc truyền subscriptionInfo chứa frequency, recurringAmount, nextPaymentDate
 */
export class SubscriptionStrategy implements IMoMoPaymentStrategy {
    readonly requestType: MoMoRequestType = 'subscription';

    validate(input: MoMoCreatePaymentInput): void {
        if (!input.subscriptionInfo) {
            throw new Error(
                '[SubscriptionStrategy] Thanh toán định kỳ bắt buộc phải cung cấp thông tin subscriptionInfo.'
            );
        }
        const { frequency, recurringAmount, nextPaymentDate } = input.subscriptionInfo;
        if (!frequency || !['WEEKLY', 'MONTHLY', 'ANNUALLY'].includes(frequency)) {
            throw new Error('[SubscriptionStrategy] frequency hợp lệ phải là WEEKLY, MONTHLY hoặc ANNUALLY.');
        }
        if (!recurringAmount || recurringAmount <= 0) {
            throw new Error('[SubscriptionStrategy] recurringAmount phải lớn hơn 0.');
        }
        if (!nextPaymentDate) {
            throw new Error('[SubscriptionStrategy] nextPaymentDate không được để trống.');
        }
    }

    enrichPayload(
        input: MoMoCreatePaymentInput,
        basePayload: Partial<MoMoCreatePaymentRequest>
    ): Partial<MoMoCreatePaymentRequest> {
        return {
            ...basePayload,
            requestType: this.requestType,
            subscriptionInfo: input.subscriptionInfo
        };
    }
}

/**
 * 6. CHIẾN LƯỢC: TOKENIZATION (payWithMethod - Lưu thẻ/ví)
 */
export class TokenizationStrategy implements IMoMoPaymentStrategy {
    readonly requestType: MoMoRequestType = 'payWithMethod';

    validate(input: MoMoCreatePaymentInput): void {
        // Cho phép token rỗng nếu là giao dịch đầu tiên liên kết ví nhận callbackToken từ IPN
        if (!input.amount || input.amount <= 0) {
            throw new Error('[TokenizationStrategy] Số tiền thanh toán tokenization phải lớn hơn 0.');
        }
    }

    enrichPayload(
        input: MoMoCreatePaymentInput,
        basePayload: Partial<MoMoCreatePaymentRequest>
    ): Partial<MoMoCreatePaymentRequest> {
        const payload: Partial<MoMoCreatePaymentRequest> = {
            ...basePayload,
            requestType: this.requestType
        };
        if (input.token) {
            payload.token = input.token;
        }
        return payload;
    }
}

/**
 * FACTORY PATTERN: MoMoPaymentStrategyFactory
 * Quản lý khởi tạo và trả về chiến lược xử lý theo tham số requestType
 */
export class MoMoPaymentStrategyFactory {
    private static strategies: Map<MoMoRequestType, IMoMoPaymentStrategy> = new Map([
        ['captureWallet', new CaptureWalletStrategy()],
        ['payWithCC', new PayWithCreditCardStrategy()],
        ['payWithApplePay', new PayWithApplePayStrategy()],
        ['payWithGooglePay', new PayWithGooglePayStrategy()],
        ['subscription', new SubscriptionStrategy()],
        ['payWithMethod', new TokenizationStrategy()]
    ]);

    static getStrategy(requestType: MoMoRequestType): IMoMoPaymentStrategy {
        const strategy = this.strategies.get(requestType);
        if (!strategy) {
            throw new Error(
                `[MoMoPaymentStrategyFactory] Phương thức thanh toán không được hỗ trợ: ${requestType}. ` +
                `Các phương thức hợp lệ: ${Array.from(this.strategies.keys()).join(', ')}`
            );
        }
        return strategy;
    }
}

export * from './IMoMoPaymentStrategy';
