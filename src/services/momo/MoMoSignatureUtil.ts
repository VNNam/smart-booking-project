/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: MoMo Signature Utility (API v3)
 * FILE: src/services/momo/MoMoSignatureUtil.ts
 * MÔ TẢ: Cung cấp thuật toán ký và xác thực chữ ký số HMAC-SHA256 chuẩn MoMo v3:
 *       1. Sắp xếp tham số theo bảng chữ cái A-Z.
 *       2. Ghép chuỗi chuẩn hóa key1=value1&key2=value2...
 *       3. Băm HMAC-SHA256 với secretKey -> Hexadecimal lowercase.
 *       4. Kiểm tra chữ ký an toàn với timingSafeEqual chống tấn công Timing Attack.
 *       5. Encode/Decode ExtraData (Base64 JSON).
 * ==============================================================================
 */

import * as crypto from 'crypto';

export class MoMoSignatureUtil {
    /**
     * Tạo chuỗi chữ ký số HMAC-SHA256 theo chuẩn MoMo v3
     * Quy tắc:
     * 1. Gom tất cả tham số yêu cầu.
     * 2. Sắp xếp theo thứ tự từ điển A-Z dựa trên key.
     * 3. Nối thành chuỗi dạng key1=value1&key2=value2...
     * 4. Băm HMAC_SHA256 bằng secretKey.
     * 5. Kết quả là chuỗi Hexadecimal viết thường.
     */
    static generateSignature(params: Record<string, any>, secretKey: string): string {
        if (!secretKey) {
            throw new Error('[MoMoSignature] secretKey không được để trống.');
        }

        const sortedKeys = Object.keys(params)
            .filter(key => {
                const val = params[key];
                // Bỏ qua key signature và các giá trị null/undefined
                return key !== 'signature' && val !== undefined && val !== null;
            })
            .sort();

        const rawData = sortedKeys
            .map(key => {
                const val = params[key];
                // Nếu là object phức tạp (ví dụ userInfo, subscriptionInfo), stringify hoặc lấy primitive
                const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                return `${key}=${stringVal}`;
            })
            .join('&');

        return crypto
            .createHmac('sha256', secretKey)
            .update(rawData, 'utf-8')
            .digest('hex')
            .toLowerCase();
    }

    /**
     * Tạo chữ ký thô chuẩn cho MoMo /create endpoint theo format MoMo Gateway v2/v3
     * format: accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
     */
    static generateGatewayCreateSignature(
        accessKey: string,
        secretKey: string,
        data: {
            amount: number;
            extraData: string;
            ipnUrl: string;
            orderId: string;
            orderInfo: string;
            partnerCode: string;
            redirectUrl: string;
            requestId: string;
            requestType: string;
        }
    ): string {
        const rawSignature =
            `accessKey=${accessKey}` +
            `&amount=${data.amount}` +
            `&extraData=${data.extraData}` +
            `&ipnUrl=${data.ipnUrl}` +
            `&orderId=${data.orderId}` +
            `&orderInfo=${data.orderInfo}` +
            `&partnerCode=${data.partnerCode}` +
            `&redirectUrl=${data.redirectUrl}` +
            `&requestId=${data.requestId}` +
            `&requestType=${data.requestType}`;

        return crypto
            .createHmac('sha256', secretKey)
            .update(rawSignature, 'utf-8')
            .digest('hex')
            .toLowerCase();
    }

    /**
     * Xác thực chữ ký IPN / Webhook nhận được từ MoMo
     * Sử dụng crypto.timingSafeEqual để chống Timing Attack.
     */
    static verifyIpnSignature(
        payload: Record<string, any>,
        accessKey: string,
        secretKey: string
    ): boolean {
        try {
            const receivedSignature = payload.signature;
            if (!receivedSignature || typeof receivedSignature !== 'string') {
                return false;
            }

            // Cách 1: Chuẩn A-Z sorted signature
            const sortedCalculatedSignature = this.generateSignature(
                { ...payload, accessKey },
                secretKey
            );

            // Cách 2: Chuẩn MoMo IPN raw string (dành cho Gateway v2/v3)
            // accessKey=$accessKey&amount=$amount&extraData=$extraData&message=$message&orderId=$orderId&orderInfo=$orderInfo&orderType=$orderType&partnerCode=$partnerCode&payType=$payType&requestId=$requestId&responseTime=$responseTime&resultCode=$resultCode&transId=$transId
            const rawIpnString =
                `accessKey=${accessKey}` +
                `&amount=${payload.amount}` +
                `&extraData=${payload.extraData || ''}` +
                `&message=${payload.message}` +
                `&orderId=${payload.orderId}` +
                `&orderInfo=${payload.orderInfo}` +
                `&orderType=${payload.orderType}` +
                `&partnerCode=${payload.partnerCode}` +
                `&payType=${payload.payType}` +
                `&requestId=${payload.requestId}` +
                `&responseTime=${payload.responseTime}` +
                `&resultCode=${payload.resultCode}` +
                `&transId=${payload.transId}`;

            const standardIpnSignature = crypto
                .createHmac('sha256', secretKey)
                .update(rawIpnString, 'utf-8')
                .digest('hex')
                .toLowerCase();

            const receivedBuf = Buffer.from(receivedSignature.toLowerCase(), 'utf-8');
            const sortedBuf = Buffer.from(sortedCalculatedSignature, 'utf-8');
            const standardBuf = Buffer.from(standardIpnSignature, 'utf-8');

            const isMatchSorted =
                receivedBuf.length === sortedBuf.length &&
                crypto.timingSafeEqual(receivedBuf, sortedBuf);

            const isMatchStandard =
                receivedBuf.length === standardBuf.length &&
                crypto.timingSafeEqual(receivedBuf, standardBuf);

            return isMatchSorted || isMatchStandard;
        } catch (error) {
            console.error('[MoMoSignatureUtil] Lỗi xác thực chữ ký IPN:', error);
            return false;
        }
    }

    /**
     * Mã hóa ExtraData sang chuỗi Base64 JSON
     */
    static encodeExtraData(data: Record<string, any>): string {
        try {
            const jsonStr = JSON.stringify(data);
            return Buffer.from(jsonStr, 'utf-8').toString('base64');
        } catch {
            return '';
        }
    }

    /**
     * Giải mã ExtraData từ chuỗi Base64 về Object
     */
    static decodeExtraData<T = Record<string, any>>(extraData: string): T | null {
        try {
            if (!extraData) return null;
            const decodedStr = Buffer.from(extraData, 'base64').toString('utf-8');
            return JSON.parse(decodedStr) as T;
        } catch {
            return null;
        }
    }
}
