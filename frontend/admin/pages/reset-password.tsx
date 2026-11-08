import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ResetPasswordPage() {
    const router = useRouter();
    const { token, email } = router.query;

    const [newPassword, setNewPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [success, setSuccess] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleReset = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (newPassword.length < 6) {
            setErrorMsg('Mật khẩu mới phải có tối thiểu 6 ký tự.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMsg('Mật khẩu xác nhận không khớp.');
            return;
        }

        setIsLoading(true);

        setTimeout(() => {
            setIsLoading(false);
            setSuccess(true);
        }, 800);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100 font-sans relative overflow-hidden">
            <Head>
                <title>Thiết lập Mật khẩu Mới | Smart Meeting Room</title>
            </Head>

            <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xl mx-auto mb-3">
                        🔐
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Đặt Lại Mật Khẩu Mới</h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Thiết lập mật khẩu an toàn mới cho tài khoản của bạn.
                    </p>
                </div>

                {success ? (
                    <div className="text-center space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                            <p className="font-semibold text-sm mb-1">Mật khẩu đã được cập nhật thành công! 🎉</p>
                            <p className="text-slate-300">
                                Bạn có thể sử dụng mật khẩu mới này để đăng nhập ngay bây giờ.
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/login')}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20"
                        >
                            Đến Trang Đăng Nhập
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="space-y-4">
                        {errorMsg && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                                {errorMsg}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Mật khẩu mới
                            </label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Tối thiểu 6 ký tự"
                                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Xác nhận mật khẩu mới
                            </label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Nhập lại mật khẩu mới"
                                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
                        >
                            {isLoading ? 'Đang cập nhật...' : 'XÁC NHẬN MẬT KHẨU MỚI'}
                        </button>

                        <div className="text-center pt-2">
                            <Link href="/login" className="text-xs text-slate-400 hover:text-white transition-colors">
                                ← Hủy & Quay lại Đăng nhập
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
