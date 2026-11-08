/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Web Admin - Corporate Postpaid Debt Management Page
 * FILE: frontend/admin/pages/corporate-debts.tsx
 * MÔ TẢ: Giao diện quản lý hạn mức công nợ doanh nghiệp (Corporate Credit Limit)
 *       Kiểm soát nghiêm ngặt ràng buộc: current_debt + room_price <= credit_limit
 *       Ngăn chặn vượt hạn mức (HTTP 422 CREDIT_LIMIT_EXCEEDED) và xử lý đối soát.
 * ==============================================================================
 */

import React, { useState } from 'react';
import Head from 'next/head';
import AdminHeader from '../components/AdminHeader';
import { withAuth } from '../components/withAuth';

interface CompanyDebt {
    id: string;
    companyName: string;
    taxCode: string;
    accountCode: string;
    creditLimit: number;
    currentDebt: number;
    contactPerson: string;
    contactPhone: string;
    status: 'ACTIVE' | 'WARNING' | 'SUSPENDED';
}

export interface CorporateMember {
    id: string;
    companyId: string;
    companyName: string;
    fullName: string;
    email: string;
    phone: string;
    department: string;
    quotaType: 'CREDIT' | 'BOOKINGS' | 'HOURS';
    quotaLimit: number;
    quotaUsed: number;
    resetCycle: 'MONTHLY' | 'WEEKLY' | 'MANUAL';
    status: 'ACTIVE' | 'SUSPENDED';
}

export interface MemberUsageLog {
    id: string;
    memberId: string;
    memberName: string;
    companyName: string;
    roomName: string;
    bookingTime: string;
    actualCheckIn: string;
    actualCheckOut: string;
    consumedQuota: string;
    status: 'COMPLETED' | 'CANCELLED';
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

const DEFAULT_MEMBERS: CorporateMember[] = [
    {
        id: 'mem-01',
        companyId: 'c-01',
        companyName: 'FPT Software Corp',
        fullName: 'Lê Hoàng Nam (Tech Lead)',
        email: 'nam.le@fpt.com',
        phone: '0912111222',
        department: 'Engineering Unit 1',
        quotaType: 'CREDIT',
        quotaLimit: 15000000,
        quotaUsed: 9500000,
        resetCycle: 'MONTHLY',
        status: 'ACTIVE'
    },
    {
        id: 'mem-02',
        companyId: 'c-01',
        companyName: 'FPT Software Corp',
        fullName: 'Trần Thị Thu Thảo (Scrum Master)',
        email: 'thao.tran@fpt.com',
        phone: '0912333444',
        department: 'Delivery Project A',
        quotaType: 'HOURS',
        quotaLimit: 30, // 30 giờ/tháng
        quotaUsed: 18,
        resetCycle: 'MONTHLY',
        status: 'ACTIVE'
    },
    {
        id: 'mem-03',
        companyId: 'c-02',
        companyName: 'Viettel Telecom',
        fullName: 'Phạm Minh Đức (Product Owner)',
        email: 'duc.pm@viettel.com.vn',
        phone: '0988555666',
        department: 'Digital Business Center',
        quotaType: 'BOOKINGS',
        quotaLimit: 12, // 12 lượt/tháng
        quotaUsed: 12, // Đã chạm trần
        resetCycle: 'MONTHLY',
        status: 'SUSPENDED'
    }
];

const DEFAULT_USAGE_LOGS: MemberUsageLog[] = [
    {
        id: 'log-01',
        memberId: 'mem-01',
        memberName: 'Lê Hoàng Nam',
        companyName: 'FPT Software Corp',
        roomName: 'Executive Boardroom Tokyo',
        bookingTime: '2026-11-08 09:00 - 11:00',
        actualCheckIn: '2026-11-08 08:58',
        actualCheckOut: '2026-11-08 11:02',
        consumedQuota: '1.300.000 đ',
        status: 'COMPLETED'
    },
    {
        id: 'log-02',
        memberId: 'mem-02',
        memberName: 'Trần Thị Thu Thảo',
        companyName: 'FPT Software Corp',
        roomName: 'Meeting Room Alpha',
        bookingTime: '2026-11-07 14:00 - 16:00',
        actualCheckIn: '2026-11-07 14:05',
        actualCheckOut: '2026-11-07 15:55',
        consumedQuota: '2.0 giờ',
        status: 'COMPLETED'
    },
    {
        id: 'log-03',
        memberId: 'mem-03',
        memberName: 'Phạm Minh Đức',
        companyName: 'Viettel Telecom',
        roomName: 'Grand Boardroom New York',
        bookingTime: '2026-11-06 10:00 - 12:00',
        actualCheckIn: 'Chưa check-in',
        actualCheckOut: 'Chưa check-out',
        consumedQuota: '0 lượt (Hủy trước 24h hoàn quota)',
        status: 'CANCELLED'
    }
];

function CorporateDebtsPage() {
    const [activeTab, setActiveTab] = useState<'COMPANIES' | 'POSTPAID_TEST' | 'USAGE_LOGS'>('COMPANIES');
    const [companies, setCompanies] = useState<CompanyDebt[]>([
        {
            id: 'c-01',
            companyName: 'FPT Software Corp',
            taxCode: '0101234567',
            accountCode: 'CORP-FPT-01',
            creditLimit: 50000000,
            currentDebt: 32000000,
            contactPerson: 'Nguyễn Văn Quản Lý',
            contactPhone: '0912345678',
            status: 'ACTIVE'
        },
        {
            id: 'c-02',
            companyName: 'Viettel Telecom',
            taxCode: '0108889999',
            accountCode: 'CORP-VIETTEL-02',
            creditLimit: 20000000,
            currentDebt: 19500000, // Cận hạn mức (>80%)
            contactPerson: 'Trần Thị Thu',
            contactPhone: '0988776655',
            status: 'WARNING'
        },
        {
            id: 'c-03',
            companyName: 'VNG Games JSC',
            taxCode: '0304445555',
            accountCode: 'CORP-VNG-03',
            creditLimit: 15000000,
            currentDebt: 15000000, // Đã chạm trần 100%
            contactPerson: 'Lê Văn Minh',
            contactPhone: '0903332211',
            status: 'SUSPENDED'
        }
    ]);

    const [members, setMembers] = useState<CorporateMember[]>(DEFAULT_MEMBERS);
    const [usageLogs, setUsageLogs] = useState<MemberUsageLog[]>(DEFAULT_USAGE_LOGS);

    const [selectedCompany, setSelectedCompany] = useState<CompanyDebt | null>(null);
    const [selectedMember, setSelectedMember] = useState<CorporateMember | null>(null);

    // Modal Forms
    const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [editingMemberQuota, setEditingMemberQuota] = useState<CorporateMember | null>(null);

    // Form inputs cho Công ty mới
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newTaxCode, setNewTaxCode] = useState('');
    const [newAccountCode, setNewAccountCode] = useState('');
    const [newCreditLimit, setNewCreditLimit] = useState(30000000);
    const [newContactPerson, setNewContactPerson] = useState('');
    const [newContactPhone, setNewContactPhone] = useState('');

    // Form inputs cho Thành viên mới
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberPhone, setNewMemberPhone] = useState('');
    const [newMemberDept, setNewMemberDept] = useState('Khối Kỹ Thuật');
    const [newMemberQuotaType, setNewMemberQuotaType] = useState<'CREDIT' | 'BOOKINGS' | 'HOURS'>('CREDIT');
    const [newMemberQuotaLimit, setNewMemberQuotaLimit] = useState(10000000);
    const [newMemberResetCycle, setNewMemberResetCycle] = useState<'MONTHLY' | 'WEEKLY' | 'MANUAL'>('MONTHLY');

    // Form inputs sửa hạn mức
    const [editQuotaLimit, setEditQuotaLimit] = useState<number>(0);
    const [editResetCycle, setEditResetCycle] = useState<'MONTHLY' | 'WEEKLY' | 'MANUAL'>('MONTHLY');

    const [bookingAmount, setBookingAmount] = useState<number>(1000000);
    const [bookingRoomName, setBookingRoomName] = useState<string>('Meeting Room Alpha');
    const [bookingError, setBookingError] = useState<string | null>(null);
    const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Mặc định chọn công ty đầu tiên
    React.useEffect(() => {
        if (!selectedCompany && companies.length > 0) {
            setSelectedCompany(companies[0]);
        }
    }, [companies, selectedCompany]);

    // Tính toán tỷ lệ sử dụng công nợ
    const getUsagePercent = (company: CompanyDebt): number => {
        return Math.min(100, Math.round((company.currentDebt / company.creditLimit) * 100));
    };

    // Thêm Doanh Nghiệp Mới (Company Level)
    const handleAddCompany = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCompanyName.trim() || !newTaxCode.trim()) return;

        const newCompany: CompanyDebt = {
            id: `c-0${companies.length + 1}`,
            companyName: newCompanyName.trim(),
            taxCode: newTaxCode.trim(),
            accountCode: newAccountCode.trim() || `CORP-${Date.now().toString().slice(-4)}`,
            creditLimit: Number(newCreditLimit),
            currentDebt: 0,
            contactPerson: newContactPerson.trim(),
            contactPhone: newContactPhone.trim(),
            status: 'ACTIVE'
        };

        setCompanies(prev => [...prev, newCompany]);
        setSelectedCompany(newCompany);
        setShowAddCompanyModal(false);
        setNewCompanyName('');
        setNewTaxCode('');
        setNewAccountCode('');
        setNewContactPerson('');
        setNewContactPhone('');
        setToastMessage(`🏢 Đã thêm doanh nghiệp [${newCompany.companyName}] thành công!`);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Thêm Thành Viên Mới (Member Level)
    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany || !newMemberName.trim() || !newMemberEmail.trim()) return;

        const newMem: CorporateMember = {
            id: `mem-${Date.now().toString().slice(-4)}`,
            companyId: selectedCompany.id,
            companyName: selectedCompany.companyName,
            fullName: newMemberName.trim(),
            email: newMemberEmail.trim(),
            phone: newMemberPhone.trim(),
            department: newMemberDept.trim(),
            quotaType: newMemberQuotaType,
            quotaLimit: Number(newMemberQuotaLimit),
            quotaUsed: 0,
            resetCycle: newMemberResetCycle,
            status: 'ACTIVE'
        };

        setMembers(prev => [...prev, newMem]);
        setShowAddMemberModal(false);
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberPhone('');
        setToastMessage(`👤 Đã liên kết thành viên [${newMem.fullName}] vào [${selectedCompany.companyName}]!`);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Cập nhật Hạn mức thành viên
    const handleSaveMemberQuota = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMemberQuota) return;

        setMembers(prev =>
            prev.map(m =>
                m.id === editingMemberQuota.id
                    ? {
                          ...m,
                          quotaLimit: Number(editQuotaLimit),
                          resetCycle: editResetCycle,
                          status: Number(editQuotaLimit) <= m.quotaUsed ? 'SUSPENDED' : 'ACTIVE'
                      }
                    : m
            )
        );

        setToastMessage(`⚙️ Đã cập nhật hạn mức mới cho [${editingMemberQuota.fullName}] thành công!`);
        setEditingMemberQuota(null);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Kiểm tra tính hợp lệ trước khi tạo booking công nợ
    const handleCreatePostpaidBooking = (e: React.FormEvent) => {
        e.preventDefault();
        setBookingError(null);
        setBookingSuccess(null);

        if (!selectedCompany) return;

        // Nếu có chọn thành viên, kiểm tra thêm hạn mức thành viên (Member Quota Guard)
        if (selectedMember) {
            if (selectedMember.status === 'SUSPENDED') {
                setBookingError(
                    `LỖI MEMBER_QUOTA_EXCEEDED (HTTP 422): Tài khoản thành viên [${selectedMember.fullName}] đã bị tạm khóa hạn mức sử dụng.`
                );
                return;
            }
            if (selectedMember.quotaType === 'CREDIT' && selectedMember.quotaUsed + bookingAmount > selectedMember.quotaLimit) {
                setBookingError(
                    `LỖI MEMBER_CREDIT_EXCEEDED (HTTP 422): Hạn mức thành viên còn lại (${formatVND(
                        selectedMember.quotaLimit - selectedMember.quotaUsed
                    )}) không đủ cho đơn ${formatVND(bookingAmount)}. Cần chuyển sang thanh toán trả trước hoặc tiền mặt.`
                );
                return;
            }
        }

        const newDebt = selectedCompany.currentDebt + bookingAmount;
        if (newDebt > selectedCompany.creditLimit) {
            setBookingError(
                `LỖI CREDIT_LIMIT_EXCEEDED (HTTP 422): Hạn mức công ty khả dụng (${formatVND(
                    selectedCompany.creditLimit - selectedCompany.currentDebt
                )}) không đủ cho đơn đặt phòng (${formatVND(bookingAmount)}). Tổng dư nợ mới (${formatVND(
                    newDebt
                )}) vượt trần ${formatVND(selectedCompany.creditLimit)}.`
            );
            return;
        }

        // Cập nhật công nợ công ty
        setCompanies(prev =>
            prev.map(c =>
                c.id === selectedCompany.id
                    ? {
                          ...c,
                          currentDebt: newDebt,
                          status: newDebt >= c.creditLimit ? 'SUSPENDED' : newDebt >= 0.8 * c.creditLimit ? 'WARNING' : 'ACTIVE'
                      }
                    : c
            )
        );

        // Cập nhật hạn mức thành viên nếu có
        if (selectedMember) {
            setMembers(prev =>
                prev.map(m =>
                    m.id === selectedMember.id
                        ? {
                              ...m,
                              quotaUsed: m.quotaType === 'CREDIT' ? m.quotaUsed + bookingAmount : m.quotaUsed + 1
                          }
                        : m
                )
            );

            // Ghi log lịch sử sử dụng
            const newLog: MemberUsageLog = {
                id: `log-${Date.now().toString().slice(-4)}`,
                memberId: selectedMember.id,
                memberName: selectedMember.fullName,
                companyName: selectedCompany.companyName,
                roomName: bookingRoomName,
                bookingTime: `${new Date().toISOString().split('T')[0]} 14:00 - 16:00`,
                actualCheckIn: 'Vừa check-in',
                actualCheckOut: 'Đang sử dụng',
                consumedQuota: formatVND(bookingAmount),
                status: 'COMPLETED'
            };
            setUsageLogs(prev => [newLog, ...prev]);
        }

        setBookingSuccess(
            `Tạo đơn công nợ CONFIRMED_DEBT thành công! Mã đơn: BKG-CORP-${Date.now().toString().slice(-5)}. Dư nợ công ty mới: ${formatVND(newDebt)}.`
        );
    };

    // Xử lý quyết toán công nợ
    const handleSettleDebt = (companyId: string, settleAmount: number) => {
        setCompanies(prev =>
            prev.map(c => {
                if (c.id === companyId) {
                    const updatedDebt = Math.max(0, c.currentDebt - settleAmount);
                    return {
                        ...c,
                        currentDebt: updatedDebt,
                        status: updatedDebt >= c.creditLimit ? 'SUSPENDED' : updatedDebt >= 0.8 * c.creditLimit ? 'WARNING' : 'ACTIVE'
                    };
                }
                return c;
            })
        );
        setToastMessage(`💵 Đã quyết toán thành công ${formatVND(settleAmount)} cho doanh nghiệp!`);
        setTimeout(() => setToastMessage(null), 3000);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Quản Lý Công Nợ Doanh Nghiệp | Smart Booking Admin</title>
            </Head>

            {/* Header */}
            <AdminHeader />

            <main className="max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                {/* BẢNG DANH SÁCH DOANH NGHIỆP (8 COLS) */}
                <section className="lg:col-span-8 space-y-4">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-bold text-white">Danh Sách Tài Khoản Công Nợ Khách Hàng VIP</h2>
                            <span className="text-xs text-slate-400">Tổng: {companies.length} doanh nghiệp</span>
                        </div>

                        <div className="space-y-4">
                            {companies.map((company) => {
                                const usage = getUsagePercent(company);
                                const available = company.creditLimit - company.currentDebt;
                                const isSelected = selectedCompany?.id === company.id;

                                return (
                                    <div
                                        key={company.id}
                                        onClick={() => {
                                            setSelectedCompany(company);
                                            setBookingError(null);
                                            setBookingSuccess(null);
                                        }}
                                        className={`p-4 rounded-xl border transition cursor-pointer ${
                                            isSelected
                                                ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/30'
                                                : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <h3 className="font-bold text-white text-sm">{company.companyName}</h3>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                                                        {company.accountCode}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">MST: {company.taxCode} • Đại diện: {company.contactPerson} ({company.contactPhone})</p>
                                            </div>

                                            <div>
                                                {company.status === 'ACTIVE' && (
                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        An toàn
                                                    </span>
                                                )}
                                                {company.status === 'WARNING' && (
                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        Cận trần (&gt;80%)
                                                    </span>
                                                )}
                                                {company.status === 'SUSPENDED' && (
                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                        Hết hạn mức (100%)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Progress Bar Hạn Mức */}
                                        <div className="mt-3 space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-400">
                                                    Đã dùng: <strong className="text-white">{formatVND(company.currentDebt)}</strong> / {formatVND(company.creditLimit)}
                                                </span>
                                                <span className={`font-bold ${usage >= 100 ? 'text-rose-400' : usage >= 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {usage}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ${
                                                        usage >= 100 ? 'bg-rose-500' : usage >= 80 ? 'bg-amber-500' : 'bg-indigo-500'
                                                    }`}
                                                    style={{ width: `${usage}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                                                <span>Khả dụng còn lại: <strong className="text-emerald-400">{formatVND(available)}</strong></span>
                                                {company.currentDebt > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSettleDebt(company.id, company.currentDebt);
                                                        }}
                                                        className="text-[10px] text-indigo-400 hover:underline"
                                                    >
                                                        Quyết toán công nợ
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* FORM TẠO ĐƠN CÔNG NỢ & KIỂM TRA HẠN MỨC (4 COLS) */}
                <section className="lg:col-span-4 space-y-4">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
                        <h2 className="text-base font-bold text-white mb-1">Tạo Đơn Phòng Công Nợ</h2>
                        <p className="text-xs text-slate-400 mb-4">Phương thức POSTPAID_DEBT với kiểm soát thời gian thực</p>

                        {bookingError && (
                            <div id="debt-error-alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mb-4">
                                <p className="font-bold">⚠️ Từ chối tạo booking công nợ</p>
                                <p className="mt-1">{bookingError}</p>
                            </div>
                        )}

                        {bookingSuccess && (
                            <div id="debt-success-alert" className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs mb-4">
                                <p className="font-bold">✓ Thành công</p>
                                <p className="mt-1">{bookingSuccess}</p>
                            </div>
                        )}

                        <form onSubmit={handleCreatePostpaidBooking} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Doanh nghiệp đã chọn *</label>
                                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
                                    {selectedCompany ? (
                                        <div className="font-semibold text-white">{selectedCompany.companyName} ({selectedCompany.accountCode})</div>
                                    ) : (
                                        <span className="text-slate-500">Vui lòng nhấp chọn 1 doanh nghiệp bên trái</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Phòng họp *</label>
                                <input
                                    type="text"
                                    value={bookingRoomName}
                                    onChange={(e) => setBookingRoomName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Giá trị đơn phòng (VND) *</label>
                                <input
                                    id="input-debt-amount"
                                    type="number"
                                    step={100000}
                                    value={bookingAmount}
                                    onChange={(e) => setBookingAmount(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-emerald-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <button
                                id="btn-submit-postpaid"
                                type="submit"
                                disabled={!selectedCompany}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Xác Nhận Tạo Đơn Công Nợ
                            </button>
                        </form>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default withAuth(CorporateDebtsPage);
