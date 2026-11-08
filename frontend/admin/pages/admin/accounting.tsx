import React, { useState } from 'react';
import Head from 'next/head';
import AdminHeader from '../../components/AdminHeader';
import { withAuth } from '../../components/withAuth';

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
    status: 'MATCHED' | 'DISCREPANCY' | 'AUTO_REFUNDED';
    createdAt: string;
}

interface CashDrawerLog {
    id: string;
    time: string;
    type: 'IN' | 'OUT';
    amount: number;
    staffName: string;
    notes: string;
}

function AccountingDashboardPage() {
    const [activeTab, setActiveTab] = useState<'RECONCILE' | 'CASH_DRAWER' | 'REVENUE'>('RECONCILE');

    // Dữ liệu đối soát mẫu
    const [reconciliations] = useState<ReconciliationItem[]>([
        { id: 'rec-01', bookingCode: 'BKG-202610-101', channel: 'MOMO', transId: 'MOMO_319847192', orderAmount: 650000, receivedAmount: 650000, status: 'MATCHED', createdAt: '2026-11-08 09:15' },
        { id: 'rec-02', bookingCode: 'BKG-202610-102', channel: 'MOMO', transId: 'MOMO_319847205', orderAmount: 350000, receivedAmount: 350000, status: 'MATCHED', createdAt: '2026-11-08 10:30' },
        { id: 'rec-03', bookingCode: 'BKG-202610-103', channel: 'MOMO', transId: 'MOMO_319847299', orderAmount: 1200000, receivedAmount: 1200000, status: 'AUTO_REFUNDED', createdAt: '2026-11-08 11:45' },
        { id: 'rec-04', bookingCode: 'BKG-202610-104', channel: 'CASH', transId: 'CSH_2026_0901', orderAmount: 700000, receivedAmount: 700000, status: 'MATCHED', createdAt: '2026-11-08 13:00' }
    ]);

    // Dữ liệu quỹ tiền mặt ca trực
    const [cashLogs] = useState<CashDrawerLog[]>([
        { id: 'c-01', time: '08:00', type: 'IN', amount: 2000000, staffName: 'Nguyễn Văn Quản Lý', notes: 'Tiền mặt đầu ca bàn giao' },
        { id: 'c-02', time: '09:20', type: 'IN', amount: 700000, staffName: 'Lễ Tân Ca Trực', notes: 'Thu tiền mặt đơn BKG-202610-104' },
        { id: 'c-03', time: '11:10', type: 'OUT', amount: 280000, staffName: 'Lễ Tân Ca Trực', notes: 'Hoàn tiền mặt 80% hủy đơn BKG-202610-099 (OTP duyệt)' }
    ]);

    const totalCashIn = cashLogs.filter(c => c.type === 'IN').reduce((acc, c) => acc + c.amount, 0);
    const totalCashOut = cashLogs.filter(c => c.type === 'OUT').reduce((acc, c) => acc + c.amount, 0);
    const netCashInDrawer = totalCashIn - totalCashOut;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Kế toán, Đối soát & Báo cáo | Smart Meeting Room</title>
            </Head>

            <AdminHeader />

            <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Kế Toán, Đối Soát Cổng Thanh Toán & Sổ Quỹ</h1>
                    <p className="text-xs text-slate-400">Kiểm toán dòng tiền đa kênh (MoMo, Ví, Tiền mặt quầy), đối soát tự động và chốt quỹ ca trực</p>
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
                        🔄 Đối Soát Giao Dịch MoMo ({reconciliations.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('CASH_DRAWER')}
                        className={`pb-3 px-4 transition-all ${
                            activeTab === 'CASH_DRAWER'
                                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        💵 Sổ Quỹ Ca Trực & Bàn Giao ({cashLogs.length})
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

                {/* TAB 1: ĐỐI SOÁT MOMO */}
                {activeTab === 'RECONCILE' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white">Đối Soát Giao Dịch Cổng MoMo (API v3) & CSDL</h3>
                                <p className="text-xs text-slate-400">Tự động kiểm tra tính toàn vẹn giữa IPN Webhook và số tiền thực nhận</p>
                            </div>
                            <button className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-slate-700">
                                📥 Xuất Báo Cáo Đối Soát (.xlsx)
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="pb-3 font-semibold">Mã Đơn Phòng</th>
                                        <th className="pb-3 font-semibold">Cổng</th>
                                        <th className="pb-3 font-semibold">Mã Giao Dịch MoMo</th>
                                        <th className="pb-3 font-semibold">Số Tiền Đơn</th>
                                        <th className="pb-3 font-semibold">Thực Nhận</th>
                                        <th className="pb-3 font-semibold">Kết Quả Đối Soát</th>
                                        <th className="pb-3 font-semibold">Thời Gian</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {reconciliations.map(rec => (
                                        <tr key={rec.id} className="hover:bg-slate-800/30">
                                            <td className="py-3.5 font-bold text-white">{rec.bookingCode}</td>
                                            <td className="py-3.5 font-bold text-pink-400">{rec.channel}</td>
                                            <td className="py-3.5 font-mono text-slate-400">{rec.transId}</td>
                                            <td className="py-3.5 font-semibold text-slate-200">{formatVND(rec.orderAmount)}</td>
                                            <td className="py-3.5 font-semibold text-emerald-400">{formatVND(rec.receivedAmount)}</td>
                                            <td className="py-3.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                    rec.status === 'MATCHED'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                        : rec.status === 'AUTO_REFUNDED'
                                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                                }`}>
                                                    {rec.status === 'MATCHED' ? '✓ KHỚP 100%' : rec.status === 'AUTO_REFUNDED' ? '↩ SAGA AUTO-REFUND' : '⚠ LỆCH TIỀN'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 text-slate-400">{rec.createdAt}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 2: SỔ QUỸ TIỀN MẶT */}
                {activeTab === 'CASH_DRAWER' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white">Sổ Quỹ Tiền Mặt & Bàn Giao Ca Trực (Two-Man Rule)</h3>
                                <p className="text-xs text-slate-400">Minh bạch dòng tiền mặt tại quầy lễ tân và thủ tục bàn giao kết ca</p>
                            </div>
                            <button className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 text-xs font-bold shadow-md">
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
                                    {cashLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-800/30">
                                            <td className="py-3.5 font-mono text-slate-400">{log.time}</td>
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
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 3: BÁO CÁO DOANH THU */}
                {activeTab === 'REVENUE' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
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

export default withAuth(AccountingDashboardPage);
