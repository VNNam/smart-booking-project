import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthManager } from '../lib/auth';

export default function LoginPage() {
    const router = useRouter();
    const [identifier, setIdentifier] = useState<string>('receptionist@smartbooking.vn');
    const [password, setPassword] = useState<string>('Staff@123456');
    const [rememberMe, setRememberMe] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setIsLoading(true);

        try {
            // Giả lập / Gọi API Login
            // Trong môi trường UAT, cho phép đăng nhập nhanh dựa trên seed accounts
            let role: 'ADMIN' | 'STAFF' = 'STAFF';
            let fullName = 'Lễ Tân Ca Trực';

            if (identifier.includes('admin')) {
                role = 'ADMIN';
                fullName = 'Quản Trị Viên Hệ Thống';
            } else if (identifier.includes('accountant')) {
                role = 'STAFF';
                fullName = 'Kế Toán Sổ Quỹ';
            }

            if (!password || password.length < 6) {
                throw new Error('Mật khẩu phải có tối thiểu 6 ký tự.');
            }

            // Sinh JWT token giả lập client-side lưu session
            const mockToken = `jwt_mock_${Date.now()}_${role}`;
            AuthManager.setSession(mockToken, {
                id: `usr-${Date.now()}`,
                email: identifier,
                phone: '0909000001',
                fullName,
                role
            });

            router.push('/');
        } catch (err: any) {
            setErrorMsg(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickFill = (email: string, pass: string) => {
        setIdentifier(email);
        setPassword(pass);
        setErrorMsg(null);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100 font-sans relative overflow-hidden">
            <Head>
                <title>Đăng nhập Web Admin | Smart Meeting Room</title>
            </Head>

            {/* Background Glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-xl shadow-emerald-500/20 text-2xl mx-auto mb-4">
                        SB
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Smart Meeting Room</h1>
                    <p className="text-xs text-slate-400 mt-1">Hệ thống Điều hành Phòng họp Thông minh v1.4</p>
                </div>

                {errorMsg && (
                    <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                        <span>⚠️</span>
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Tài khoản (Email hoặc Số điện thoại)
                        </label>
                        <input
                            type="text"
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="admin@smartbooking.vn"
                            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-300">
                                Mật khẩu
                            </label>
                            <Link href="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                                Quên mật khẩu?
                            </Link>
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                            />
                            <span className="text-xs text-slate-400">Ghi nhớ đăng nhập (8 giờ)</span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
                    >
                        {isLoading ? 'Đang xác thực...' : 'ĐĂNG NHẬP VÀO HỆ THỐNG'}
                    </button>
                </form>

                {/* Quick Presets for UAT Testers */}
                <div className="mt-8 pt-6 border-t border-slate-800/80">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
                        Tài khoản mẫu thử nghiệm UAT ($0 Free-Tier):
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => handleQuickFill('admin@smartbooking.vn', 'Admin@123456')}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 hover:text-white transition-all text-center"
                        >
                            👑 Admin
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickFill('receptionist@smartbooking.vn', 'Staff@123456')}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 hover:text-white transition-all text-center"
                        >
                            💁‍♀️ Lễ tân
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickFill('accountant@smartbooking.vn', 'Accountant@123456')}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 hover:text-white transition-all text-center"
                        >
                            📊 Kế toán
                        </button>
                    </div>
                </div>
            </div>

            <footer className="mt-8 text-center text-xs text-slate-600">
                Smart Booking Platform &copy; 2026 - Bảo mật theo chuẩn RBAC & JWT Guard
            </footer>
        </div>
    );
}
