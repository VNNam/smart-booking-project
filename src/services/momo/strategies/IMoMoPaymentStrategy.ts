/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: MoMo Payment Strategy Interface
 * FILE: src/services/momo/strategies/IMoMoPaymentStrategy.ts
 * ==============================================================================
 */

import { MoMoCreatePaymentInput, MoMoCreatePaymentRequest, MoMoRequestType } from '../types';

export interface IMoMoPaymentStrategy {
    readonly requestType: MoMoRequestType;

    /**
     * Kiểm tra tính hợp lệ của tham số đầu vào đặc thù theo từng phương thức
     */
    validate(input: MoMoCreatePaymentInput): void;

    /**
     * Bổ sung các tham số đặc thù vào payload gửi sang MoMo API v3
     */
    enrichPayload(
        input: MoMoCreatePaymentInput,
        basePayload: Partial<MoMoCreatePaymentRequest>
    ): Partial<MoMoCreatePaymentRequest>;
}
