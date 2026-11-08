import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminHeader from '../components/AdminHeader';
import { withAuth } from '../components/withAuth';
import { AuthManager, AdminUser } from '../lib/auth';

function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<AdminUser | null>(null);

    // Form đổi mật khẩu
    const [currentPassword, setCurrentPassword] = useState<string>('');
    const [newPassword, setNewPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        setUser(AuthManager.getUser());
    }, []);

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);

        if (newPassword.length < 6) {
            setMsg({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            setMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }, 700);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Hồ sơ Quản trị | Smart Meeting Room</title>
            </Head>

            <AdminHeader />

            <main className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Hồ Sơ Tài Khoản Quản Trị</h1>
                    <p className="text-xs text-slate-400">Xem thông tin định danh ca trực và quản lý bảo mật mật khẩu tài khoản</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* User Card */}
                    <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-xl shadow-emerald-500/20 text-3xl mx-auto">
                            {user?.fullName?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">{user?.fullName || 'Nhân viên'}</h2>
                            <p className="text-xs text-slate-400">{user?.email}</p>
                            <div className="mt-2 inline-block">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                    user?.role === 'ADMIN'
                                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                        : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                                }`}>
                                    {user?.role === 'ADMIN' ? '👑 TỔNG QUẢN TRỊ (ADMIN)' : '💁‍♀️ LỄ TÂN CA TRỰC (STAFF)'}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-800 text-left space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Số điện thoại:</span>
                                <span className="font-medium text-slate-200">{user?.phone || '0909000001'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Chi nhánh trực:</span>
                                <span className="font-medium text-emerald-400">Landmark 81 HQ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Trạng thái:</span>
                                <span className="font-medium text-emerald-400">Đang hoạt động 🟢</span>
                            </div>
                        </div>
                    </div>

                    {/* Change Password & Security */}
                    <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center space-x-2">
                            <span>🔐</span>
                            <span>Đổi Mật Khẩu Truy Cập</span>
                        </h2>

                        {msg && (
                            <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                                msg.type === 'success'
                                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                            }`}>
                                <span>{msg.type === 'success' ? '✅' : '⚠️'}</span>
                                <span>{msg.text}</span>
                            </div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Mật khẩu hiện tại</label>
                                <input
                                    type="password"
                                    required
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Mật khẩu mới</label>
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Tối thiểu 6 ký tự"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Xác nhận mật khẩu mới</label>
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Nhập lại mật khẩu mới"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Đang cập nhật...' : 'Cập nhật Mật khẩu'}
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default withAuth(ProfilePage);

