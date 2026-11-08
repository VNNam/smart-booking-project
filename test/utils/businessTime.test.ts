/**
 * Unit tests: src/utils/businessTime.ts
 * Bao phủ: Calendar "hôm nay" theo giờ VN, phụ thu cuối tuần, khoảng ngày đối soát inclusive.
 */
import {
    getVnDateParts,
    getVnTodayStr,
    isVnWeekend,
    toVnDayRange,
    computeBookingAmount,
    WEEKEND_SURCHARGE_MULTIPLIER
} from '../../src/utils/businessTime';

describe('businessTime - VN timezone', () => {
    it('00:30 VN (17:30 UTC hôm trước) phải là ngày VN, không phải ngày UTC', () => {
        // 2026-11-07T17:30:00Z = 2026-11-08 00:30 VN
        expect(getVnTodayStr(new Date('2026-11-07T17:30:00Z'))).toBe('2026-11-08');
    });

    it('trích xuất giờ/phút theo VN', () => {
        const p = getVnDateParts('2026-11-08T09:32:00Z'); // 16:32 VN
        expect(p.hour).toBe(16);
        expect(p.minute).toBe(32);
        expect(p.dateStr).toBe('2026-11-08');
    });

    it('xác định cuối tuần theo ngày VN (2026-11-07 là Thứ 7)', () => {
        expect(isVnWeekend('2026-11-07T03:00:00Z')).toBe(true);
        // 2026-11-08 là Chủ Nhật
        expect(isVnWeekend('2026-11-08T03:00:00Z')).toBe(true);
        // 2026-11-09 là Thứ Hai — nhưng 2026-11-08T18:00Z đã là 01:00 VN Thứ Hai
        expect(isVnWeekend('2026-11-08T18:00:00Z')).toBe(false);
    });
});

describe('businessTime - toVnDayRange (Accounting Date Range Filter)', () => {
    it('bao gồm cả ngày bắt đầu và ngày kết thúc theo giờ VN', () => {
        const { startTs, endTs } = toVnDayRange('2026-11-01', '2026-11-30');
        expect(startTs.toISOString()).toBe('2026-10-31T17:00:00.000Z'); // 01/11 00:00 VN
        expect(endTs.toISOString()).toBe('2026-11-30T17:00:00.000Z');   // 01/12 00:00 VN (exclusive)

        const inRange = (iso: string) => {
            const t = new Date(iso).getTime();
            return t >= startTs.getTime() && t < endTs.getTime();
        };
        expect(inRange('2026-10-31T17:00:00.000Z')).toBe(true);  // 01/11 00:00:00 VN
        expect(inRange('2026-11-30T16:59:59.999Z')).toBe(true);  // 30/11 23:59:59.999 VN
        expect(inRange('2026-11-30T17:00:00.000Z')).toBe(false); // 01/12 00:00 VN
        expect(inRange('2026-10-31T23:30:00.000Z')).toBe(true);  // 01/11 06:30 VN (TC-F02)
    });

    it('from = to là một ngày trọn vẹn', () => {
        const { startTs, endTs } = toVnDayRange('2026-11-08', '2026-11-08');
        expect(endTs.getTime() - startTs.getTime()).toBe(24 * 3600 * 1000);
    });

    it('từ chối from > to (TC-F03)', () => {
        expect(() => toVnDayRange('2026-11-10', '2026-11-01')).toThrow('INVALID_DATE_RANGE');
    });

    it('từ chối định dạng / giá trị ngày sai', () => {
        expect(() => toVnDayRange('2026/11/01', '2026-11-02')).toThrow('INVALID_DATE_FORMAT');
        expect(() => toVnDayRange('2026-02-30', '2026-03-01')).toThrow('INVALID_DATE_VALUE');
    });

    it('từ chối khoảng quá 366 ngày', () => {
        expect(() => toVnDayRange('2025-01-01', '2026-11-08')).toThrow('INVALID_DATE_RANGE');
    });
});

describe('businessTime - computeBookingAmount (CB-09)', () => {
    it('ngày thường: không phụ thu', () => {
        // Thứ Năm 2026-11-12 13:00-15:00 VN
        const r = computeBookingAmount(350000, '2026-11-12T06:00:00Z', '2026-11-12T08:00:00Z');
        expect(r.isWeekend).toBe(false);
        expect(r.totalAmount).toBe(700000);
    });

    it('Thứ 7: phụ thu theo hệ số cuối tuần, server = biên nhận', () => {
        // Thứ 7 2026-11-14 13:00-15:00 VN
        const r = computeBookingAmount(350000, '2026-11-14T06:00:00Z', '2026-11-14T08:00:00Z');
        expect(r.isWeekend).toBe(true);
        expect(r.totalAmount).toBe(Math.round(700000 * WEEKEND_SURCHARGE_MULTIPLIER));
        expect(r.totalAmount).toBe(805000);
        expect(r.surchargeAmount).toBe(105000);
    });

    it('thời lượng tối thiểu 1 giờ', () => {
        const r = computeBookingAmount(350000, '2026-11-12T06:00:00Z', '2026-11-12T06:30:00Z');
        expect(r.baseAmount).toBe(350000);
    });
});

