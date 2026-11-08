/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Shared Business Time & Pricing Utilities
 * FILE: src/utils/businessTime.ts
 * MÔ TẢ: Chuẩn hóa múi giờ nghiệp vụ (Asia/Ho_Chi_Minh) dùng chung cho:
 *       - Calendar Logic (xác định "hôm nay", chặn slot quá khứ)
 *       - Pricing (phụ thu cuối tuần tính theo ngày VN, không theo giờ server)
 *       - Accounting Date Range Filter ([from 00:00 VN, to+1 00:00 VN))
 *       Không phụ thuộc timezone của process Node hay session PostgreSQL.
 * ==============================================================================
 */

export const BUSINESS_TIMEZONE = 'Asia/Ho_Chi_Minh';
/** Việt Nam không áp dụng DST → offset cố định UTC+7 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Hệ số phụ thu cuối tuần (Thứ 7, CN). Có thể override qua ENV. */
export const WEEKEND_SURCHARGE_MULTIPLIER = Number(process.env.WEEKEND_SURCHARGE_MULTIPLIER || '1.15');

export interface VnDateParts {
    year: number;
    month: number; // 1-12
    day: number;
    hour: number;
    minute: number;
    dayOfWeek: number; // 0 = CN ... 6 = Thứ 7
    dateStr: string; // YYYY-MM-DD
}

/** Trích xuất các thành phần ngày/giờ theo giờ Việt Nam từ một mốc thời gian tuyệt đối. */
export function getVnDateParts(instant: Date | string | number): VnDateParts {
    const t = new Date(instant).getTime();
    if (Number.isNaN(t)) {
        throw new Error(`INVALID_DATE: ${instant}`);
    }
    const shifted = new Date(t + VN_OFFSET_MS);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth() + 1;
    const day = shifted.getUTCDate();
    return {
        year,
        month,
        day,
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
        dayOfWeek: shifted.getUTCDay(),
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
}

/** Ngày hôm nay (YYYY-MM-DD) theo giờ Việt Nam. */
export function getVnTodayStr(now: Date = new Date()): string {
    return getVnDateParts(now).dateStr;
}

export function isVnWeekend(instant: Date | string | number): boolean {
    const dow = getVnDateParts(instant).dayOfWeek;
    return dow === 0 || dow === 6;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Mốc 00:00 giờ VN của một ngày lịch YYYY-MM-DD (trả về Date tuyệt đối). */
export function vnStartOfDay(dateStr: string): Date {
    if (!DATE_RE.test(dateStr)) {
        throw new Error(`INVALID_DATE_FORMAT: ${dateStr} (expected YYYY-MM-DD)`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    const utcMidnight = Date.UTC(y, m - 1, d);
    const check = new Date(utcMidnight);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
        throw new Error(`INVALID_DATE_VALUE: ${dateStr}`);
    }
    return new Date(utcMidnight - VN_OFFSET_MS);
}

export interface VnDayRange {
    /** inclusive */
    startTs: Date;
    /** exclusive (= 00:00 VN ngày to + 1) */
    endTs: Date;
}

/** Số ngày tối đa cho một truy vấn đối soát (chống full-scan). */
export const MAX_RANGE_DAYS = 366;

/**
 * Chuyển khoảng ngày lịch [from, to] (bao gồm cả 2 đầu) thành nửa khoảng thời gian tuyệt đối
 * [from 00:00 VN, (to + 1) 00:00 VN). Dùng cho mọi WHERE lọc kế toán:
 *   created_at >= $startTs AND created_at < $endTs
 */
export function toVnDayRange(from: string, to: string): VnDayRange {
    const startTs = vnStartOfDay(from);
    const toStart = vnStartOfDay(to);
    if (toStart.getTime() < startTs.getTime()) {
        throw new Error('INVALID_DATE_RANGE: from must be <= to');
    }
    const endTs = new Date(toStart.getTime() + 24 * 60 * 60 * 1000);
    const days = (endTs.getTime() - startTs.getTime()) / (24 * 60 * 60 * 1000);
    if (days > MAX_RANGE_DAYS) {
        throw new Error(`INVALID_DATE_RANGE: range exceeds ${MAX_RANGE_DAYS} days`);
    }
    return { startTs, endTs };
}

/**
 * Tính tổng tiền booking theo nguồn duy nhất phía server (Single Source of Truth).
 * - Thời lượng tối thiểu 1 giờ.
 * - Phụ thu cuối tuần xác định theo ngày VN của start_time.
 * - Làm tròn về đồng (VND không có số lẻ).
 */
export function computeBookingAmount(
    hourlyRate: number,
    startTime: Date | string,
    endTime: Date | string
): { baseAmount: number; surchargeAmount: number; totalAmount: number; isWeekend: boolean } {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationHours = Math.max(1, (end - start) / (1000 * 60 * 60));
    const baseAmount = Math.round(hourlyRate * durationHours);
    const weekend = isVnWeekend(startTime);
    const totalAmount = weekend ? Math.round(baseAmount * WEEKEND_SURCHARGE_MULTIPLIER) : baseAmount;
    return { baseAmount, surchargeAmount: totalAmount - baseAmount, totalAmount, isWeekend: weekend };
}

