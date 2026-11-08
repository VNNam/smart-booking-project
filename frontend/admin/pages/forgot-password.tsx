import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState<string>('');
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);

        // Mô phỏng gửi email đặt lại mật khẩu
        setTimeout(() => {
            setIsLoading(false);
            setIsSubmitted(true);
        }, 800);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100 font-sans relative overflow-hidden">
            <Head>
                <title>Quên mật khẩu | Smart Meeting Room</title>
            </Head>

            <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xl mx-auto mb-3">
                        🔑
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Khôi phục Mật khẩu</h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Nhập email tài khoản của bạn để nhận hướng dẫn và đường dẫn đặt lại mật khẩu an toàn.
                    </p>
                </div>

                {isSubmitted ? (
                    <div className="text-center space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                            <p className="font-semibold text-sm mb-1">Đã gửi yêu cầu thành công! 📩</p>
                            <p className="text-slate-300">
                                Chúng tôi đã gửi hướng dẫn tới hòm thư <span className="font-bold text-white">{email}</span>. Vui lòng kiểm tra hộp thư đến (hoặc thư rác) trong vòng 15 phút.
                            </p>
                        </div>
                        <div className="pt-2">
                            <Link
                                href="/reset-password?token=mock_sample_token_uat&email="
                                className="block w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-emerald-400 transition-all text-center mb-2"
                            >
                                🧪 Thử nghiệm màn hình Đặt lại Mật khẩu (UAT Demo)
                            </Link>
                            <Link
                                href="/login"
                                className="block text-xs text-slate-400 hover:text-white transition-colors"
                            >
                                ← Quay lại Đăng nhập
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errorMsg && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                                {errorMsg}
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Email đăng ký
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@smartbooking.vn"
                                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
                        >
                            {isLoading ? 'Đang gửi yêu cầu...' : 'GỬI ĐƯỜNG DẪN ĐẶT LẠI MẬT KHẨU'}
                        </button>

                        <div className="text-center pt-2">
                            <Link href="/login" className="text-xs text-slate-400 hover:text-white transition-colors">
                                ← Quay lại Đăng nhập
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
