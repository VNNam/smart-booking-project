/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: MoMo Payment API v3 - Types & Interfaces
 * FILE: src/services/momo/types.ts
 * MÔ TẢ: Định nghĩa toàn bộ interfaces, types, enums cho cổng thanh toán MoMo API v3:
 *       1. 6 Phương thức thanh toán (captureWallet, payWithCC, payWithApplePay,
 *          payWithGooglePay, subscription, payWithMethod).
 *       2. Request / Response payloads cho API Create, IPN, Query, Refund.
 *       3. Cấu hình bảo mật Credentials (.env).
 * ==============================================================================
 */

export type MoMoRequestType =
    | 'captureWallet'       // Ví MoMo cơ bản (QR / App redirect)
    | 'payWithCC'           // Thẻ quốc tế Visa/Mastercard
    | 'payWithApplePay'     // Apple Pay
    | 'payWithGooglePay'    // Google Pay
    | 'subscription'        // Thanh toán định kỳ (Subscription)
    | 'payWithMethod';      // Tokenization (Lưu thẻ/ví)

export type MoMoEnvironment = 'sandbox' | 'production';

export interface MoMoConfig {
    partnerCode: string;
    accessKey: string;
    secretKey: string;
    endpoint: string;
    redirectUrl: string;
    ipnUrl: string;
    env: MoMoEnvironment;
}

export interface MoMoUserInfo {
    name?: string;
    phoneNumber?: string;
    email?: string;
}

export interface MoMoSubscriptionInfo {
    frequency: 'WEEKLY' | 'MONTHLY' | 'ANNUALLY';
    recurringAmount: number;
    nextPaymentDate: string; // ISO 8601 or YYYY-MM-DD
}

export interface MoMoCreatePaymentInput {
    orderId: string;
    amount: number;
    orderInfo: string;
    requestType: MoMoRequestType;
    extraData?: Record<string, any> | string;
    userInfo?: MoMoUserInfo;
    subscriptionInfo?: MoMoSubscriptionInfo;
    token?: string;          // Token cho payWithMethod
    autoCapture?: boolean;
    lang?: 'vi' | 'en';
}

export interface MoMoCreatePaymentRequest {
    partnerCode: string;
    partnerName?: string;
    storeId?: string;
    requestId: string;
    amount: number;
    orderId: string;
    orderInfo: string;
    redirectUrl: string;
    ipnUrl: string;
    requestType: MoMoRequestType;
    extraData: string;
    autoCapture?: boolean;
    lang?: string;
    signature: string;
    userInfo?: MoMoUserInfo;
    subscriptionInfo?: MoMoSubscriptionInfo;
    token?: string;
}

export interface MoMoCreatePaymentResponse {
    partnerCode: string;
    orderId: string;
    requestId: string;
    amount: number;
    responseTime: number;
    message: string;
    resultCode: number;
    payUrl?: string;
    deeplink?: string;
    qrCodeUrl?: string;
    deeplinkMiniApp?: string;
    signature?: string;
}

export interface MoMoIpnPayload {
    partnerCode: string;
    orderId: string;
    requestId: string;
    amount: number;
    orderInfo: string;
    orderType: string;
    transId: number;
    resultCode: number;
    message: string;
    payType: string;
    responseTime: number;
    extraData: string;
    signature: string;
    callbackToken?: string; // Tokenization trả về từ MoMo
}

export interface MoMoIpnProcessResult {
    statusCode: number;      // 200, 204, 400, 500
    message: string;
    actionTaken: 'BOOKING_CONFIRMED' | 'AUTO_REFUND_TRIGGERED' | 'PAYMENT_FAILED' | 'IGNORED';
    bookingId?: string;
    refundAmount?: number;
    callbackToken?: string;
}

export interface MoMoQueryRequest {
    partnerCode: string;
    requestId: string;
    orderId: string;
    signature: string;
    lang?: string;
}

export interface MoMoQueryResponse {
    partnerCode: string;
    orderId: string;
    requestId: string;
    extraData: string;
    amount: number;
    transId: number;
    payType: string;
    resultCode: number;
    message: string;
    responseTime: number;
    signature?: string;
}

export interface MoMoRefundRequest {
    partnerCode: string;
    orderId: string;
    requestId: string;
    amount: number;
    transId: number;
    description: string;
    signature: string;
    lang?: string;
}

export interface MoMoRefundResponse {
    partnerCode: string;
    orderId: string;
    requestId: string;
    amount: number;
    transId: number;
    resultCode: number;
    message: string;
    responseTime: number;
    signature?: string;
}
