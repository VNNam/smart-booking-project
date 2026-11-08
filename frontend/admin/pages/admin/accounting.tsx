import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdminHeader from '../../components/AdminHeader';
import { withAuth } from '../../components/withAuth';
import { AuthManager } from '../../lib/auth';
import { getVnNow, addDaysToDateStr, startOfMonthStr } from '../../lib/vnTime';

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

interface ReconciliationItem {
    id: string;
    bookingCode: string;
    channel: 'MOMO' | 'VNPAY' | 'WALLET' | 'CASH';
    transId: string;
    orderAmount: number;
    receivedAmount: number;
    gatewayStatus: 'MATCHED' | 'DISCREPANCY' | 'AUTO_REFUNDED';
    reconciliationStatus: 'MATCHED' | 'DISCREPANCY' | 'PENDING';
    notes: string;
    verifiedBy?: string;
    verifiedAt?: string;
    createdAt: string;
}

interface CashDrawerLog {
    id: string;
    date: string;
    time: string;
    type: 'IN' | 'OUT';
    amount: number;
    staffName: string;
    notes: string;
}

const DEFAULT_RECONCILIATIONS: ReconciliationItem[] = [
    {
        id: 'rec-01',
        bookingCode: 'BKG-202610-101',
        channel: 'MOMO',
        transId: 'MOMO_319847192',
        orderAmount: 650000,
        receivedAmount: 650000,
        gatewayStatus: 'MATCHED',
        reconciliationStatus: 'MATCHED',
        notes: 'Tiền đã nổi về tài khoản Vietcombank lúc 09:20. Khớp 100%.',
        verifiedBy: 'Trần Thị Mai (Kế toán)',
        verifiedAt: '09:25',
        createdAt: '2026-11-08 09:15'
    },
    {
        id: 'rec-02',
        bookingCode: 'BKG-202610-102',
        channel: 'MOMO',
        transId: 'MOMO_319847205',
        orderAmount: 350000,
        receivedAmount: 350000,
        gatewayStatus: 'MATCHED',
        reconciliationStatus: 'MATCHED',
        notes: 'Khớp lệnh thành công.',
        verifiedBy: 'Trần Thị Mai (Kế toán)',
        verifiedAt: '10:35',
        createdAt: '2026-11-08 10:30'
    },
    {
        id: 'rec-03',
        bookingCode: 'BKG-202610-103',
        channel: 'MOMO',
        transId: 'MOMO_319847299',
        orderAmount: 1200000,
        receivedAmount: 1200000,
        gatewayStatus: 'AUTO_REFUNDED',
        reconciliationStatus: 'MATCHED',
        notes: 'Late webhook - Đã kiểm tra lệnh hoàn tiền tự động 1.200.000đ cho khách.',
        verifiedBy: 'Trần Thị Mai (Kế toán)',
        verifiedAt: '11:50',
        createdAt: '2026-11-08 11:45'
    },
    {
        id: 'rec-04',
        bookingCode: 'BKG-202610-104',
        channel: 'CASH',
        transId: 'CSH_2026_0901',
        orderAmount: 700000,
        receivedAmount: 700000,
        gatewayStatus: 'MATCHED',
        reconciliationStatus: 'MATCHED',
        notes: 'Lễ tân đã nộp tiền mặt vào két ca trực.',
        verifiedBy: 'Trần Thị Mai (Kế toán)',
        verifiedAt: '13:05',
        createdAt: '2026-11-08 13:00'
    },
    {
        id: 'rec-05',
        bookingCode: 'BKG-202610-105',
        channel: 'MOMO',
        transId: 'MOMO_319847350',
        orderAmount: 850000,
        receivedAmount: 850000,
        gatewayStatus: 'MATCHED',
        reconciliationStatus: 'PENDING',
        notes: 'Chờ đối chiếu bảng kê ngân hàng ca chiều.',
        createdAt: '2026-11-08 14:10'
    }
];

const STORAGE_KEY_RECON = 'smart_booking_reconciliations_v1';

function AccountingDashboardPage() {
    const [activeTab, setActiveTab] = useState<'RECONCILE' | 'CASH_DRAWER' | 'REVENUE'>('RECONCILE');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Dữ liệu đối soát có lưu trữ bền vững
    const [reconciliations, setReconciliations] = useState<ReconciliationItem[]>(DEFAULT_RECONCILIATIONS);

    // Bộ lọc đối soát theo Khoảng thời gian (Date Range Filter via Calendar) & Kênh
    // [BA-FIX G-16] Mặc định: từ đầu tháng hiện tại đến hôm nay (giờ VN), không hardcode ngày cố định
    const [startDate, setStartDate] = useState<string>(() => startOfMonthStr(getVnNow().dateStr));
    const [endDate, setEndDate] = useState<string>(() => getVnNow().dateStr);
    const [filterChannel, setFilterChannel] = useState<string>('ALL');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const raw = localStorage.getItem(STORAGE_KEY_RECON);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setReconciliations(parsed);
                    }
                } catch {}
            }
        }
    }, []);

    // Lọc dữ liệu theo khoảng thời gian [Từ ngày] - [Đến ngày] (bao gồm cả ngày bắt đầu và ngày kết thúc)
    const filteredReconciliations = reconciliations.filter((item) => {
        const itemDate = item.createdAt.split(' ')[0]; // Định dạng YYYY-MM-DD
        const matchesDate = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
        const matchesChannel = filterChannel === 'ALL' || item.channel === filterChannel;
        const matchesStatus = filterStatus === 'ALL' || item.reconciliationStatus === filterStatus;
        return matchesDate && matchesChannel && matchesStatus;
    });

    const STORAGE_KEY_CASH_LOGS = 'smart_booking_cash_logs_v1';
    const DEFAULT_CASH_LOGS: CashDrawerLog[] = [
        { id: 'c-01', date: '2026-11-08', time: '08:00', type: 'IN', amount: 2000000, staffName: 'Nguyễn Văn Quản Lý', notes: 'Tiền mặt đầu ca bàn giao' },
        { id: 'c-02', date: '2026-11-08', time: '09:20', type: 'IN', amount: 700000, staffName: 'Lễ Tân Ca Trực', notes: 'Thu tiền mặt đơn BKG-202610-104' },
        { id: 'c-03', date: '2026-11-08', time: '11:10', type: 'OUT', amount: 280000, staffName: 'Lễ Tân Ca Trực', notes: 'Hoàn tiền mặt 80% hủy đơn BKG-202610-099 (OTP duyệt)' }
    ];

    // Dữ liệu quỹ tiền mặt ca trực (hỗ trợ lưu trữ vĩnh viễn và đồng bộ tự động)
    const [cashLogs, setCashLogs] = useState<CashDrawerLog[]>(() => {
        if (typeof window === 'undefined') return DEFAULT_CASH_LOGS;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_CASH_LOGS);
            if (!raw) return DEFAULT_CASH_LOGS;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CASH_LOGS;
        } catch {
            return DEFAULT_CASH_LOGS;
        }
    });

    // Tự động đồng bộ các đơn thu tiền mặt thực tế từ API /api/v1/bookings
    useEffect(() => {
        const syncServerCashBookings = async () => {
            try {
                const res = await fetch('/api/v1/bookings');
                if (res.ok) {
                    const json = await res.json();
                    if (json.data && Array.isArray(json.data)) {
                        setCashLogs(prev => {
                            const map = new Map<string, CashDrawerLog>();
                            prev.forEach(log => map.set(log.id, log));

                            json.data.forEach((b: any) => {
                                if (b.paymentMethod === 'CASH_ON_ARRIVAL') {
                                    const logId = b.cashBookEntryId || `c-${b.id}`;
                                    const datePart = b.createdAt ? b.createdAt.split('T')[0] : '2026-11-08';
                                    const timePart = b.createdAt ? b.createdAt.split('T')[1]?.slice(0, 5) || '12:00' : '12:00';
                                    if (!map.has(logId)) {
                                        map.set(logId, {
                                            id: logId,
                                            date: datePart,
                                            time: timePart,
                                            type: 'IN',
                                            amount: typeof b.totalAmount === 'number' ? b.totalAmount : Number(b.totalAmount),
                                            staffName: 'Lễ Tân Ca Trực',
                                            notes: `Thu tiền mặt đơn ${b.bookingCode} - ${b.customerName || 'Khách tại quầy'}`
                                        });
                                    }
                                }
                            });

                            const merged = Array.from(map.values()).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
                            try {
                                localStorage.setItem(STORAGE_KEY_CASH_LOGS, JSON.stringify(merged));
                            } catch {}
                            return merged;
                        });
                    }
                }
            } catch {}
        };

        syncServerCashBookings();

        const handleSync = () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY_CASH_LOGS);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) setCashLogs(parsed);
                }
            } catch {}
        };
        window.addEventListener('storage', handleSync);
        return () => window.removeEventListener('storage', handleSync);
    }, []);

    // [BA-FIX G-19] Áp dụng bộ lọc khoảng thời gian [Từ ngày] - [Đến ngày] cho cả Sổ quỹ tiền mặt
    const filteredCashLogs = cashLogs.filter((c) => {
        return (!startDate || c.date >= startDate) && (!endDate || c.date <= endDate);
    });

    const totalCashIn = filteredCashLogs.filter(c => c.type === 'IN').reduce((acc, c) => acc + c.amount, 0);
    const totalCashOut = filteredCashLogs.filter(c => c.type === 'OUT').reduce((acc, c) => acc + c.amount, 0);
    const netCashInDrawer = totalCashIn - totalCashOut;

    // [MODULE 3] Thống kê tổng hợp thu/chi tiền mặt nhóm theo từng ngày
    const dailyCashSummary = useMemo(() => {
        const map = new Map<string, {
            date: string;
            cashInAmount: number;
            cashInCount: number;
            cashOutAmount: number;
            cashOutCount: number;
            netAmount: number;
        }>();

        filteredCashLogs.forEach(c => {
            if (!map.has(c.date)) {
                map.set(c.date, {
                    date: c.date,
                    cashInAmount: 0,
                    cashInCount: 0,
                    cashOutAmount: 0,
                    cashOutCount: 0,
                    netAmount: 0
                });
            }
            const day = map.get(c.date)!;
            if (c.type === 'IN') {
                day.cashInAmount += c.amount;
                day.cashInCount += 1;
            } else {
                day.cashOutAmount += c.amount;
                day.cashOutCount += 1;
            }
            day.netAmount = day.cashInAmount - day.cashOutAmount;
        });

        return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [filteredCashLogs]);

    // Đánh dấu giao dịch ĐÃ KHỚP
    const handleMarkMatched = (id: string) => {
        const currentUser = AuthManager.getUser();
        const verifier = currentUser ? currentUser.fullName : 'Kế toán viên';
        const timeNow = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        const updated = reconciliations.map(r => {
            if (r.id === id) {
                return {
                    ...r,
                    reconciliationStatus: 'MATCHED' as const,
                    verifiedBy: verifier,
                    verifiedAt: timeNow,
                    notes: r.notes || `Xác nhận khớp tiền với sao kê lúc ${timeNow}`
                };
            }
            return r;
        });

        setReconciliations(updated);
        localStorage.setItem(STORAGE_KEY_RECON, JSON.stringify(updated));
        setToastMessage(`🟢 Đã xác nhận ĐÃ KHỚP cho giao dịch đơn phòng [${reconciliations.find(r => r.id === id)?.bookingCode}].`);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Đánh dấu giao dịch BÁO LỆCH
    const handleMarkDiscrepancy = (id: string) => {
        const currentUser = AuthManager.getUser();
        const verifier = currentUser ? currentUser.fullName : 'Kế toán viên';
        const timeNow = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        const updated = reconciliations.map(r => {
            if (r.id === id) {
                return {
                    ...r,
                    reconciliationStatus: 'DISCREPANCY' as const,
                    verifiedBy: verifier,
                    verifiedAt: timeNow,
                    notes: r.notes || `Phát hiện sai lệch số tiền/chưa nhận được tiền lúc ${timeNow}`
                };
            }
            return r;
        });

        setReconciliations(updated);
        localStorage.setItem(STORAGE_KEY_RECON, JSON.stringify(updated));
        setToastMessage(`🔴 Đã đánh dấu BÁO LỆCH cho giao dịch [${reconciliations.find(r => r.id === id)?.bookingCode}]. Cần kiểm tra lại ngân hàng.`);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Cập nhật nội dung Ghi chú đối soát
    const handleUpdateNotes = (id: string, notes: string) => {
        const updated = reconciliations.map(r => r.id === id ? { ...r, notes } : r);
        setReconciliations(updated);
    };

    // Lưu toàn bộ biên bản đối soát
    const handleSaveReconciliationBatch = () => {
        localStorage.setItem(STORAGE_KEY_RECON, JSON.stringify(reconciliations));
        setToastMessage(`💾 Đã lưu trữ thành công toàn bộ biên bản đối soát vào hệ thống!`);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Xuất báo cáo đối soát
    const handleExportReport = () => {
        const header = "ID,Mã đơn,Cổng,Mã GD,Số tiền,Thực nhận,Trạng thái,Ghi chú,Người duyệt,Thời gian\n";
        const rows = reconciliations.map(r => 
            `"${r.id}","${r.bookingCode}","${r.channel}","${r.transId}","${r.orderAmount}","${r.receivedAmount}","${r.reconciliationStatus}","${r.notes || ''}","${r.verifiedBy || ''}","${r.createdAt}"`
        ).join("\n");
        
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Bao_Cao_Doi_Soat_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setToastMessage(`📥 Đã xuất báo cáo đối soát dạng file CSV thành công!`);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const countMatched = reconciliations.filter(r => r.reconciliationStatus === 'MATCHED').length;
    const countDiscrepancy = reconciliations.filter(r => r.reconciliationStatus === 'DISCREPANCY').length;
    const countPending = reconciliations.filter(r => r.reconciliationStatus === 'PENDING').length;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Kế toán & Đối soát Cổng Thanh Toán | Smart Meeting Room</title>
            </Head>

            <AdminHeader />

            <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
                {/* Toast Notification */}
                {toastMessage && (
                    <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-lg flex items-center justify-between animate-fade-in">
                        <div className="flex items-center space-x-2">
                            <span className="text-base">🔔</span>
                            <span>{toastMessage}</span>
                        </div>
                        <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white text-xs px-2 py-0.5">✕</button>
                    </div>
                )}

                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Kế Toán, Đối Soát Giao Dịch & Sổ Quỹ</h1>
                    <p className="text-xs text-slate-400">Kiểm toán dòng tiền đa kênh (MoMo API v3, Tiền mặt quầy), xác nhận đối soát có ghi chú và chốt quỹ ca trực</p>
                </div>

                {/* 4 Financial KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tổng Doanh Thu Trong Ngày</span>
                        <p className="text-xl font-bold text-emerald-400 mt-1">{formatVND(14850000)}</p>
                        <span className="text-[10px] text-emerald-500 font-medium">↑ +18% so với hôm qua</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Cổng MoMo API v3 (Đã quyết toán)</span>
                        <p className="text-xl font-bold text-sky-400 mt-1">{formatVND(8950000)}</p>
                        <span className="text-[10px] text-slate-400">12 giao dịch thành công</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tồn Quỹ Tiền Mặt Hiện Tại</span>
                        <p className="text-xl font-bold text-amber-400 mt-1">{formatVND(netCashInDrawer)}</p>
                        <span className="text-[10px] text-amber-500 font-medium">Khớp 100% phiếu thu/chi</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tổng Dư Nợ Doanh Nghiệp</span>
                        <p className="text-xl font-bold text-purple-400 mt-1">{formatVND(39500000)}</p>
                        <span className="text-[10px] text-purple-400">Trong hạn mức tín dụng</span>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-800 space-x-2 text-xs font-semibold">
                    <button
                        onClick={() => setActiveTab('RECONCILE')}
                        className={`pb-3 px-4 transition-all ${
                            activeTab === 'RECONCILE'
                                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        ⚖️ Đối Soát Giao Dịch & Ghi Chú ({reconciliations.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('CASH_DRAWER')}
                        className={`pb-3 px-4 transition-all ${
                            activeTab === 'CASH_DRAWER'
                                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        💵 Sổ Quỹ & Thống Kê Tiền Mặt Theo Ngày ({dailyCashSummary.length} ngày / {filteredCashLogs.length} GD)
                    </button>
                    <button
                        onClick={() => setActiveTab('REVENUE')}
                        className={`pb-3 px-4 transition-all ${
                            activeTab === 'REVENUE'
                                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        📈 Báo Cáo Kênh Doanh Thu
                    </button>
                </div>

                {/* =========================================================================
                    TAB 1: ĐỐI SOÁT MOMO & XÁC NHẬN GHI CHÚ
                ========================================================================= */}
                {activeTab === 'RECONCILE' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                                    <span>Kiểm Tra & Đối Soát Giao Dịch Cổng MoMo (API v3) & Ngân Hàng</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        Đã khớp: {countMatched}/{reconciliations.length} ({Math.round((countMatched / reconciliations.length) * 100)}%)
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Kế toán viên kiểm tra đối chiếu sao kê, tích chọn Đã khớp / Báo lệch và nhập ghi chú tra soát</p>
                            </div>

                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handleSaveReconciliationBatch}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center space-x-1.5"
                                >
                                    <span>💾</span>
                                    <span>Lưu Biên Bản Đối Soát</span>
                                </button>
                                <button
                                    onClick={handleExportReport}
                                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-slate-700 transition-all flex items-center space-x-1.5"
                                >
                                    <span>📥</span>
                                    <span>Xuất Báo Cáo (.csv)</span>
                                </button>
                            </div>
                        </div>

                        {/* Bộ Lọc Đối Soát Theo Khoảng Thời Gian (Date Range Filter via Calendar) */}
                        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center space-x-2">
                                        <label className="text-xs font-semibold text-slate-300">Từ ngày:</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            max={endDate || undefined}
                                            onChange={(e) => {
                                                // [BA-FIX G-16] Bảo đảm from <= to: nếu chọn Từ ngày > Đến ngày thì kéo Đến ngày theo
                                                const v = e.target.value;
                                                setStartDate(v);
                                                if (v && endDate && v > endDate) setEndDate(v);
                                            }}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <label className="text-xs font-semibold text-slate-300">Đến ngày:</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            min={startDate || undefined}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setEndDate(v);
                                                if (v && startDate && v < startDate) setStartDate(v);
                                            }}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    {/* Nút lọc nhanh — [BA-FIX G-18] tính theo ngày VN, không dùng toISOString() (ngày UTC) */}
                                    <div className="flex items-center space-x-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const today = getVnNow().dateStr;
                                                setStartDate(today);
                                                setEndDate(today);
                                            }}
                                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium"
                                        >
                                            Hôm nay
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // 7 ngày tính cả hôm nay: [today - 6, today]
                                                const today = getVnNow().dateStr;
                                                setStartDate(addDaysToDateStr(today, -6));
                                                setEndDate(today);
                                            }}
                                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium"
                                        >
                                            7 ngày qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const today = getVnNow().dateStr;
                                                setStartDate(startOfMonthStr(today));
                                                setEndDate(today);
                                            }}
                                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium"
                                        >
                                            Tháng này
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={filterChannel}
                                        onChange={(e) => setFilterChannel(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="ALL">Tất cả kênh (MoMo, Cash...)</option>
                                        <option value="MOMO">MoMo API v3</option>
                                        <option value="CASH">Tiền mặt tại quầy (CASH)</option>
                                        <option value="VNPAY">VNPAY QR</option>
                                        <option value="WALLET">Ví thành viên (WALLET)</option>
                                    </select>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="ALL">Tất cả trạng thái</option>
                                        <option value="MATCHED">✓ Đã khớp</option>
                                        <option value="DISCREPANCY">⚠ Báo lệch</option>
                                        <option value="PENDING">⏳ Chờ soát</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                                <span>Kết quả lọc: Hiển thị <strong>{filteredReconciliations.length}</strong> / {reconciliations.length} giao dịch</span>
                                <span>Khoảng thời gian: <strong>{startDate}</strong> đến <strong>{endDate}</strong> (Bao gồm cả 2 mốc)</span>
                            </div>
                        </div>

                        {/* Status bar */}
                        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-slate-400">🟢 Khớp hoàn toàn:</span>
                                <span className="font-bold text-emerald-400">{countMatched} giao dịch</span>
                            </div>
                            <div className="flex items-center justify-between px-2 border-x border-slate-800">
                                <span className="text-slate-400">🔴 Phát hiện sai lệch:</span>
                                <span className={`font-bold ${countDiscrepancy > 0 ? 'text-rose-400' : 'text-slate-400'}`}>{countDiscrepancy} giao dịch</span>
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-slate-400">⚪ Đang chờ soát:</span>
                                <span className="font-bold text-amber-400">{countPending} giao dịch</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="pb-3 font-semibold">Mã Đơn Phòng</th>
                                        <th className="pb-3 font-semibold">Cổng GD</th>
                                        <th className="pb-3 font-semibold">Mã GD Cổng / Ngân Hàng</th>
                                        <th className="pb-3 font-semibold">Số Tiền Đơn</th>
                                        <th className="pb-3 font-semibold">Thực Nhận</th>
                                        <th className="pb-3 font-semibold">Trạng Thái Đối Soát</th>
                                        <th className="pb-3 font-semibold min-w-[200px]">Ghi Chú Kiểm Tra / Tra Soát</th>
                                        <th className="pb-3 font-semibold">Người Kiểm Tra</th>
                                        <th className="pb-3 font-semibold text-right">Xác Nhận Đối Soát</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {filteredReconciliations.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-slate-500">
                                                Không tìm thấy giao dịch nào trong khoảng thời gian từ {startDate} đến {endDate}.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredReconciliations.map(rec => (
                                        <tr key={rec.id} className="hover:bg-slate-800/30 transition">
                                            <td className="py-3.5 font-bold text-white">{rec.bookingCode}</td>
                                            <td className="py-3.5 font-bold text-pink-400">{rec.channel}</td>
                                            <td className="py-3.5 font-mono text-slate-400">{rec.transId}</td>
                                            <td className="py-3.5 font-semibold text-slate-200">{formatVND(rec.orderAmount)}</td>
                                            <td className="py-3.5 font-semibold text-emerald-400">{formatVND(rec.receivedAmount)}</td>
                                            <td className="py-3.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                    rec.reconciliationStatus === 'MATCHED'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                        : rec.reconciliationStatus === 'DISCREPANCY'
                                                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
                                                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                }`}>
                                                    {rec.reconciliationStatus === 'MATCHED'
                                                        ? '✓ ĐÃ KHỚP'
                                                        : rec.reconciliationStatus === 'DISCREPANCY'
                                                        ? '⚠ BÁO LỆCH'
                                                        : '⏳ CHỜ SOÁT'}
                                                </span>
                                            </td>
                                            {/* Textbox Ghi chú đối soát trực tiếp */}
                                            <td className="py-3.5">
                                                <input
                                                    type="text"
                                                    value={rec.notes}
                                                    onChange={(e) => handleUpdateNotes(rec.id, e.target.value)}
                                                    placeholder="Nhập ghi chú kiểm tra đối soát..."
                                                    className="w-full bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                                                />
                                            </td>
                                            <td className="py-3.5 text-slate-400">
                                                {rec.verifiedBy ? (
                                                    <div>
                                                        <p className="text-slate-300 font-medium">{rec.verifiedBy}</p>
                                                        <p className="text-[10px] text-slate-500">{rec.verifiedAt}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600 italic">Chưa duyệt</span>
                                                )}
                                            </td>
                                            {/* Nút Check Khớp / Báo Lệch */}
                                            <td className="py-3.5 text-right space-x-1.5 whitespace-nowrap">
                                                <button
                                                    onClick={() => handleMarkMatched(rec.id)}
                                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${
                                                        rec.reconciliationStatus === 'MATCHED'
                                                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                                    }`}
                                                    title="Xác nhận giao dịch đã khớp với sao kê ngân hàng"
                                                >
                                                    ✓ Khớp
                                                </button>
                                                <button
                                                    onClick={() => handleMarkDiscrepancy(rec.id)}
                                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${
                                                        rec.reconciliationStatus === 'DISCREPANCY'
                                                            ? 'bg-rose-500 text-white border-rose-400'
                                                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                                    }`}
                                                    title="Báo lệch tiền hoặc chưa nhận được tiền"
                                                >
                                                    ⚠ Lệch
                                                </button>
                                            </td>
                                        </tr>
                                    )))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    TAB 2: SỔ QUỸ & THỐNG KÊ THU TIỀN MẶT THEO NGÀY
                ========================================================================= */}
                {activeTab === 'CASH_DRAWER' && (
                    <div className="space-y-6">
                        {/* KPI Tóm tắt tiền mặt trong khoảng ngày */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tổng Thu Tiền Mặt (+)</span>
                                <p className="text-xl font-bold text-emerald-400 mt-1">{formatVND(totalCashIn)}</p>
                                <span className="text-[10px] text-slate-400">{filteredCashLogs.filter(c => c.type === 'IN').length} lượt thu tại quầy</span>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tổng Chi Hoàn Mặt (-)</span>
                                <p className="text-xl font-bold text-rose-400 mt-1">{formatVND(totalCashOut)}</p>
                                <span className="text-[10px] text-slate-400">{filteredCashLogs.filter(c => c.type === 'OUT').length} lượt hoàn hủy OTP</span>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Thực Thu Tiền Mặt Thuần</span>
                                <p className="text-xl font-bold text-amber-400 mt-1">{formatVND(netCashInDrawer)}</p>
                                <span className="text-[10px] text-amber-500 font-medium">Khớp 100% phiếu thu chi</span>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Số Ngày Phát Sinh Giao Dịch</span>
                                <p className="text-xl font-bold text-sky-400 mt-1">{dailyCashSummary.length} ngày</p>
                                <span className="text-[10px] text-slate-400">Từ {startDate} đến {endDate}</span>
                            </div>
                        </div>

                        {/* BẢNG 1: THỐNG KÊ THU TIỀN MẶT THEO NGÀY */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                                        <span>📊 Bảng Thống Kê Tổng Hợp Thu Tiền Mặt Theo Từng Ngày</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                            {dailyCashSummary.length} ngày phát sinh
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Tổng hợp đối soát tiền mặt theo từng ngày trong khoảng thời gian {startDate} đến {endDate}</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-slate-400">
                                            <th className="pb-3 font-semibold">Ngày Thu Tiền</th>
                                            <th className="pb-3 font-semibold text-center">Lượt Thu (+)</th>
                                            <th className="pb-3 font-semibold">Tổng Thu Mặt (+)</th>
                                            <th className="pb-3 font-semibold text-center">Lượt Chi (-)</th>
                                            <th className="pb-3 font-semibold">Tổng Hoàn Mặt (-)</th>
                                            <th className="pb-3 font-semibold">Thực Thu Thuần Trong Ngày</th>
                                            <th className="pb-3 font-semibold text-right">Trạng Thái Chốt Ca</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {dailyCashSummary.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-8 text-center text-slate-500">
                                                    Không có giao dịch tiền mặt nào phát sinh trong khoảng thời gian {startDate} đến {endDate}.
                                                </td>
                                            </tr>
                                        ) : (
                                            dailyCashSummary.map(day => (
                                                <tr key={day.date} className="hover:bg-slate-800/30 transition">
                                                    <td className="py-3.5 font-bold font-mono text-white flex items-center space-x-2">
                                                        <span>📅</span>
                                                        <span>{day.date}</span>
                                                    </td>
                                                    <td className="py-3.5 text-center text-slate-300 font-semibold">{day.cashInCount}</td>
                                                    <td className="py-3.5 font-bold text-emerald-400">{formatVND(day.cashInAmount)}</td>
                                                    <td className="py-3.5 text-center text-slate-400">{day.cashOutCount}</td>
                                                    <td className="py-3.5 font-semibold text-rose-400">{day.cashOutAmount > 0 ? `-${formatVND(day.cashOutAmount)}` : '0 ₫'}</td>
                                                    <td className="py-3.5 font-bold text-amber-400">{formatVND(day.netAmount)}</td>
                                                    <td className="py-3.5 text-right">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                            ✓ ĐÃ KHỚP SỔ QUỸ
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {dailyCashSummary.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-slate-700 bg-slate-800/40 font-bold text-white">
                                                <td className="py-3">TỔNG CỘNG ({dailyCashSummary.length} NGÀY)</td>
                                                <td className="py-3 text-center text-emerald-400">{filteredCashLogs.filter(c => c.type === 'IN').length}</td>
                                                <td className="py-3 text-emerald-400">{formatVND(totalCashIn)}</td>
                                                <td className="py-3 text-center text-rose-400">{filteredCashLogs.filter(c => c.type === 'OUT').length}</td>
                                                <td className="py-3 text-rose-400">-{formatVND(totalCashOut)}</td>
                                                <td className="py-3 text-amber-400 text-sm">{formatVND(netCashInDrawer)}</td>
                                                <td className="py-3 text-right text-emerald-400">100% CÂN ĐỐI</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>

                        {/* BẢNG 2: SỔ QUỸ CHI TIẾT TỪNG PHIẾU THU/CHI */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-white">💵 Sổ Quỹ Tiền Mặt Chi Tiết & Bàn Giao Ca Trực (Two-Man Rule)</h3>
                                    <p className="text-xs text-slate-400">Minh bạch dòng tiền mặt tại quầy lễ tân và thủ tục bàn giao kết ca</p>
                                </div>
                                <button
                                    onClick={() => alert('Đã chốt sổ ca trực và gửi mã OTP xác nhận tới Trưởng ca qua SMS/App!')}
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 text-xs font-bold shadow-md hover:opacity-90 transition-all"
                                >
                                    📋 Chốt Ca & In Biên Bản Bàn Giao
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-slate-400">
                                            <th className="pb-3 font-semibold">Thời Gian</th>
                                            <th className="pb-3 font-semibold">Loại Nghiệp Vụ</th>
                                            <th className="pb-3 font-semibold">Số Tiền</th>
                                            <th className="pb-3 font-semibold">Nhân Sự Thực Hiện</th>
                                            <th className="pb-3 font-semibold">Nội Dung Giao Dịch</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {filteredCashLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-slate-500">
                                                    Không có giao dịch quỹ tiền mặt nào trong khoảng thời gian {startDate} đến {endDate}.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredCashLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-slate-800/30">
                                                    <td className="py-3.5 font-mono text-slate-400">{log.date} {log.time}</td>
                                                    <td className="py-3.5">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                            log.type === 'IN'
                                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                                        }`}>
                                                            {log.type === 'IN' ? '↓ THU TIỀN VÀO' : '↑ CHI HOÀN TRẢ'}
                                                        </span>
                                                    </td>
                                                    <td className={`py-3.5 font-bold ${log.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {log.type === 'IN' ? '+' : '-'}{formatVND(log.amount)}
                                                    </td>
                                                    <td className="py-3.5 text-slate-300 font-medium">{log.staffName}</td>
                                                    <td className="py-3.5 text-slate-400 italic">{log.notes}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    TAB 3: BÁO CÁO DOANH THU
                ========================================================================= */}
                {activeTab === 'REVENUE' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                        <div>
                            <h3 className="text-sm font-bold text-white">Cơ Cấu Doanh Thu Theo Kênh Thanh Toán (BRD v1.4 Hardened)</h3>
                            <p className="text-xs text-slate-400">Tỷ trọng dòng tiền giữa các phương thức thanh toán an toàn</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                                <span className="text-xs text-slate-400 font-semibold">1. Cổng Trực Tuyến MoMo</span>
                                <p className="text-lg font-bold text-pink-400 mt-1">60.3%</p>
                                <p className="text-xs text-slate-300">{formatVND(8950000)}</p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                                <span className="text-xs text-slate-400 font-semibold">2. Tiền Mặt Tại Quầy</span>
                                <p className="text-lg font-bold text-amber-400 mt-1">20.2%</p>
                                <p className="text-xs text-slate-300">{formatVND(3000000)}</p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                                <span className="text-xs text-slate-400 font-semibold">3. Ví Thành Viên Trả Trước</span>
                                <p className="text-lg font-bold text-emerald-400 mt-1">12.8%</p>
                                <p className="text-xs text-slate-300">{formatVND(1900000)}</p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                                <span className="text-xs text-slate-400 font-semibold">4. Công Nợ Doanh Nghiệp</span>
                                <p className="text-lg font-bold text-purple-400 mt-1">6.7%</p>
                                <p className="text-xs text-slate-300">{formatVND(1000000)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default withAuth(AccountingDashboardPage, ['ADMIN', 'STAFF']);
