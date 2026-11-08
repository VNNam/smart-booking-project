/**
 * Shared Business Errors to avoid Circular Dependency
 */
export class BusinessError extends Error {
    constructor(public code: string, message: string, public statusCode: number = 400) {
        super(message);
        this.name = 'BusinessError';
    }
}

export class SlotConflictError extends BusinessError {
    constructor(message = 'Phòng họp đã được người khác giữ chỗ hoặc vừa được xác nhận. Vui lòng chọn khung giờ khác.') {
        super('ROOM_SLOT_UNAVAILABLE', message, 409);
    }
}

export class InsufficientWalletBalanceError extends BusinessError {
    constructor(message = 'Số dư ví thành viên không đủ để thanh toán phòng họp. Vui lòng nạp thêm tiền.') {
        super('INSUFFICIENT_WALLET_BALANCE', message, 402);
    }
}

export class ForbiddenError extends BusinessError {
    constructor(message = 'Bạn không có quyền sử dụng phương thức thanh toán này.') {
        super('PAYMENT_METHOD_FORBIDDEN', message, 403);
    }
}

export class CreditLimitExceededError extends BusinessError {
    constructor(message = 'Hạn mức công nợ hiện tại của doanh nghiệp không đủ để thanh toán đơn đặt phòng này.') {
        super('CREDIT_LIMIT_EXCEEDED', message, 422);
    }
}

export class SlotInPastError extends BusinessError {
    constructor(message = 'Khung giờ đã bắt đầu hoặc đã qua. Không thể đặt phòng hoặc thu tiền cho khung giờ này.') {
        super('SLOT_IN_PAST', message, 409);
    }
}

