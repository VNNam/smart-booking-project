import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthManager, AdminUser } from '../lib/auth';

export default function AdminHeader() {
    const router = useRouter();
    const [user, setUser] = useState<AdminUser | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

    useEffect(() => {
        setUser(AuthManager.getUser());
    }, []);

    const handleLogout = () => {
        AuthManager.clearSession();
        router.push('/login');
    };

    const navLinks = [
        { href: '/', label: '📅 Lịch Master', active: router.pathname === '/' },
        { href: '/cash-booking', label: '💵 Thu tiền mặt', active: router.pathname === '/cash-booking' },
        { href: '/corporate-debts', label: '🏢 Công nợ', active: router.pathname === '/corporate-debts' },
        { href: '/admin/rooms', label: '🚪 Quản lý Phòng & Giá', active: router.pathname.startsWith('/admin/rooms') },
        { href: '/admin/accounting', label: '📊 Kế toán & Đối soát', active: router.pathname.startsWith('/admin/accounting') },
    ];

    const getRoleBadge = (role?: string) => {
        switch (role) {
            case 'ADMIN':
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">ADMIN</span>;
            case 'STAFF':
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40">LỄ TÂN</span>;
            default:
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/40">{role || 'STAFF'}</span>;
        }
    };

    return (
        <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
            {/* Logo & Title */}
            <div className="flex items-center space-x-3">
                <Link href="/" className="flex items-center space-x-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 text-lg group-hover:scale-105 transition-all">
                        SB
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-white tracking-tight leading-tight">Smart Meeting Room</h1>
                        <p className="text-[11px] text-slate-400">Web Admin v1.4 Hardened</p>
                    </div>
                </Link>
            </div>

            {/* Main Navigation Links */}
            <nav className="flex items-center gap-1.5 flex-wrap">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            link.active
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent'
                        }`}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>

            {/* User Profile Badge & Menu */}
            <div className="relative">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800 hover:border-slate-600 transition-all text-left"
                >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-xs">
                        {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div className="hidden sm:block">
                        <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-semibold text-white">{user?.fullName || 'Nhân viên trực ca'}</span>
                            {getRoleBadge(user?.role)}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{user?.email || 'receptionist@smartbooking.vn'}</p>
                    </div>
                    <span className="text-slate-400 text-xs">▾</span>
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                    <div
                        className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 text-xs z-50 animate-in fade-in zoom-in-95 duration-100"
                        onMouseLeave={() => setIsMenuOpen(false)}
                    >
                        <div className="px-3 py-2 border-b border-slate-800 mb-1">
                            <p className="font-semibold text-white truncate">{user?.fullName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                        </div>
                        <Link
                            href="/profile"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                        >
                            <span>👤</span>
                            <span>Hồ sơ tài khoản</span>
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all text-left mt-1 border-t border-slate-800/60"
                        >
                            <span>🚪</span>
                            <span>Đăng xuất (Logout)</span>
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}

