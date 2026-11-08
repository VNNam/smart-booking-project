/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * FILE: frontend/admin/lib/vnTime.ts
 * MÔ TẢ: Helper ngày/giờ theo múi giờ nghiệp vụ Asia/Ho_Chi_Minh (UTC+7, không DST)
 *       cho Web Admin. Đồng bộ quy ước với backend `src/utils/businessTime.ts`.
 *       KHÔNG dùng `toISOString().split('T')[0]` để lấy "hôm nay" (trả ngày UTC →
 *       sai trong khung 00:00–06:59 giờ VN).
 * ==============================================================================
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface VnNow {
    dateStr: string; // YYYY-MM-DD theo giờ VN
    minutesOfDay: number; // số phút từ 00:00 VN
    dayOfWeek: number; // 0 = CN ... 6 = Thứ 7
}

export function getVnNow(now: Date = new Date()): VnNow {
    const shifted = new Date(now.getTime() + VN_OFFSET_MS);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return {
        dateStr: `${y}-${m}-${d}`,
        minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
        dayOfWeek: shifted.getUTCDay()
    };
}

/** Cộng/trừ số ngày trên chuỗi ngày lịch YYYY-MM-DD (không phụ thuộc timezone máy). */
export function addDaysToDateStr(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Ngày đầu tháng (YYYY-MM-01) của một ngày lịch. */
export function startOfMonthStr(dateStr: string): string {
    return `${dateStr.slice(0, 7)}-01`;
}

/** Thứ trong tuần (0 = CN) của một ngày lịch YYYY-MM-DD. */
export function dayOfWeekOfDateStr(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
}

/** "HH:mm[:ss]" → số phút trong ngày. */
export function hhmmToMinutes(hhmm: string): number {
    const [h, mi] = hhmm.split(':').map(Number);
    return h * 60 + (mi || 0);
}

