import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminHeader from '../components/AdminHeader';
import { withAuth } from '../components/withAuth';
import { AuthManager, AdminUser } from '../lib/auth';

function ProfilePage() {
    const [user, setUser] = useState<AdminUser | null>(null);

    // Form cập nhật thông tin cá nhân & Email
    const [formFullName, setFormFullName] = useState<string>('');
    const [formEmail, setFormEmail] = useState<string>('');
    const [formPhone, setFormPhone] = useState<string>('');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form đổi mật khẩu
    const [currentPassword, setCurrentPassword] = useState<string>('');
    const [newPassword, setNewPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);
    const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const currentUser = AuthManager.getUser();
        if (currentUser) {
            setUser(currentUser);
            setFormFullName(currentUser.fullName || '');
            setFormEmail(currentUser.email || '');
            setFormPhone(currentUser.phone || '');
        }
    }, []);

    // Xử lý cập nhật thông tin hồ sơ & email
    const handleUpdateProfile = (e: React.FormEvent) => {
        e.preventDefault();
        setProfileMsg(null);

        if (!formEmail.trim() || !formEmail.includes('@') || !formEmail.includes('.')) {
            setProfileMsg({ type: 'error', text: 'Vui lòng nhập định dạng email hợp lệ (ví dụ: user@smartbooking.vn).' });
            return;
        }

        if (!formFullName.trim()) {
            setProfileMsg({ type: 'error', text: 'Họ và tên không được để trống.' });
            return;
        }

        setIsUpdatingProfile(true);

        setTimeout(() => {
            if (user) {
                const updated: AdminUser = {
                    ...user,
                    fullName: formFullName.trim(),
                    email: formEmail.trim(),
                    phone: formPhone.trim()
                };
                AuthManager.setUser(updated);
                setUser(updated);
            }
            setIsUpdatingProfile(false);
            setProfileMsg({ type: 'success', text: 'Cập nhật email và thông tin tài khoản thành công!' });
            setTimeout(() => setProfileMsg(null), 4000);
        }, 500);
    };

    // Xử lý đổi mật khẩu
    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMsg(null);

        if (newPassword.length < 6) {
            setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        setIsSavingPassword(true);
        setTimeout(() => {
            setIsSavingPassword(false);
            setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu tài khoản thành công!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordMsg(null), 4000);
        }, 600);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Hồ sơ Quản trị & Thông tin Email | Smart Meeting Room</title>
            </Head>

            <AdminHeader />

            <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Hồ Sơ Cá Nhân & Quản Trị Tài Khoản</h1>
                    <p className="text-xs text-slate-400">Xem và cập nhật thông tin định danh ca trực, email liên hệ và bảo mật mật khẩu</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Cột trái: Thẻ tóm tắt tài khoản */}
                    <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-xl shadow-emerald-500/20 text-3xl mx-auto">
                            {user?.fullName?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">{user?.fullName || 'Cán bộ nhân viên'}</h2>
                            <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                            <div className="mt-2.5 inline-block">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                    user?.role === 'ADMIN'
                                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                        : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                                }`}>
                                    {user?.role === 'ADMIN' ? '👑 TỔNG QUẢN TRỊ (ADMIN)' : '💁‍♀️ NHÂN VIÊN CA TRỰC (STAFF)'}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-800 text-left space-y-2.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Email:</span>
                                <span className="font-medium text-slate-200 truncate max-w-[170px]" title={user?.email}>{user?.email}</span>
                            </div>
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
                                <span className="font-semibold text-emerald-400">Đang hoạt động 🟢</span>
                            </div>
                        </div>
                    </div>

                    {/* Cột phải: 2 biểu mẫu Cập nhật Thông tin Email & Đổi Mật khẩu */}
                    <div className="md:col-span-2 space-y-6">
                        {/* FORM 1: CẬP NHẬT THÔNG TIN EMAIL & HỒ SƠ */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                            <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center space-x-2">
                                <span>📧</span>
                                <span>Thông Tin Định Danh & Email Liên Hệ</span>
                            </h2>

                            {profileMsg && (
                                <div className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 ${
                                    profileMsg.type === 'success'
                                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                                }`}>
                                    <span>{profileMsg.type === 'success' ? '✅' : '⚠️'}</span>
                                    <span>{profileMsg.text}</span>
                                </div>
                            )}

                            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Địa chỉ Email (Dùng nhận thông báo & reset mật khẩu)</label>
                                    <input
                                        type="email"
                                        required
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        placeholder="admin@smartbooking.vn"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Email này sẽ nhận các thông báo khôi phục mật khẩu và biên bản đối soát ca trực.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold text-slate-300 mb-1">Họ và tên</label>
                                        <input
                                            type="text"
                                            required
                                            value={formFullName}
                                            onChange={(e) => setFormFullName(e.target.value)}
                                            placeholder="Nguyễn Văn Quản Lý"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-300 mb-1">Số điện thoại liên hệ</label>
                                        <input
                                            type="text"
                                            required
                                            value={formPhone}
                                            onChange={(e) => setFormPhone(e.target.value)}
                                            placeholder="0909000001"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isUpdatingProfile}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                                >
                                    {isUpdatingProfile ? 'Đang lưu...' : 'Lưu Thay Đổi Thông Tin'}
                                </button>
                            </form>
                        </div>

                        {/* FORM 2: ĐỔI MẬT KHẨU TRUY CẬP */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                            <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center space-x-2">
                                <span>🔐</span>
                                <span>Đổi Mật Khẩu Truy Cập</span>
                            </h2>

                            {passwordMsg && (
                                <div className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 ${
                                    passwordMsg.type === 'success'
                                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                                }`}>
                                    <span>{passwordMsg.type === 'success' ? '✅' : '⚠️'}</span>
                                    <span>{passwordMsg.text}</span>
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
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSavingPassword}
                                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold shadow-md transition-all disabled:opacity-50"
                                >
                                    {isSavingPassword ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default withAuth(ProfilePage);
