import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminHeader from '../../components/AdminHeader';
import { withAuth } from '../../components/withAuth';
import { userStore, ManagedUser, AccountRole, AccountStatus, DEFAULT_USERS } from '../../lib/userStore';

function UsersManagementPage() {
    const [users, setUsers] = useState<ManagedUser[]>(DEFAULT_USERS);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [filterRole, setFilterRole] = useState<string>('ALL');

    // Modal state Thêm / Sửa
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [formFullName, setFormFullName] = useState<string>('');
    const [formEmail, setFormEmail] = useState<string>('');
    const [formPhone, setFormPhone] = useState<string>('');
    const [formRole, setFormRole] = useState<AccountRole>('STAFF_RECEPTION');
    const [formPassword, setFormPassword] = useState<string>('Staff@123456');

    useEffect(() => {
        setUsers(userStore.getUsers());
        const unsubscribe = userStore.subscribe((updated) => setUsers(updated));
        return () => unsubscribe();
    }, []);

    const openCreateModal = () => {
        setEditingUserId(null);
        setFormFullName('');
        setFormEmail('');
        setFormPhone('');
        setFormRole('STAFF_RECEPTION');
        setFormPassword('Staff@123456');
        setIsModalOpen(true);
    };

    const openEditModal = (u: ManagedUser) => {
        setEditingUserId(u.id);
        setFormFullName(u.fullName);
        setFormEmail(u.email);
        setFormPhone(u.phone);
        setFormRole(u.role);
        setFormPassword('');
        setIsModalOpen(true);
    };

    const handleSaveUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingUserId) {
            userStore.updateUser(editingUserId, {
                fullName: formFullName.trim(),
                email: formEmail.trim(),
                phone: formPhone.trim(),
                role: formRole
            });
            setToastMessage(`✅ Đã cập nhật thành công thông tin tài khoản [${formFullName}].`);
        } else {
            userStore.addUser({
                fullName: formFullName.trim(),
                email: formEmail.trim(),
                phone: formPhone.trim(),
                role: formRole,
                status: 'ACTIVE',
                lastLogin: 'Chưa đăng nhập'
            });
            setToastMessage(`✅ Đã cấp mới tài khoản [${formFullName}] với quyền [${formRole}]. Mật khẩu: ${formPassword}`);
        }
        setUsers(userStore.getUsers());
        setIsModalOpen(false);
        setTimeout(() => setToastMessage(null), 4000);
    };

    const handleToggleLock = (userId: string, userName: string) => {
        try {
            const updated = userStore.toggleLockUser(userId);
            if (updated) {
                setUsers(userStore.getUsers());
                const msg = updated.status === 'LOCKED'
                    ? `🔒 ĐÃ KHÓA TÀI KHOẢN [${userName}]. Người dùng này sẽ bị chặn truy cập hệ thống ngay lập tức.`
                    : `🟢 ĐÃ MỞ KHÓA TÀI KHOẢN [${userName}]. Quyền truy cập đã được phục hồi bình thường.`;
                setToastMessage(msg);
                setTimeout(() => setToastMessage(null), 5000);
            }
        } catch (err: any) {
            alert(err.message || 'Không thể thực hiện thao tác.');
        }
    };

    const handleResetPassword = (userId: string, userName: string) => {
        if (confirm(`Bạn có chắc chắn muốn đặt lại mật khẩu cho [${userName}] về mặc định "Staff@123456"?`)) {
            userStore.resetPassword(userId);
            setToastMessage(`🔑 Đã reset mật khẩu của [${userName}] về: Staff@123456`);
            setTimeout(() => setToastMessage(null), 4000);
        }
    };

    const handleDeleteUser = (userId: string, userName: string) => {
        try {
            if (confirm(`Bạn có chắc chắn muốn xóa tài khoản [${userName}] khỏi hệ thống?`)) {
                userStore.deleteUser(userId);
                setUsers(userStore.getUsers());
                setToastMessage(`Đã xóa tài khoản [${userName}].`);
                setTimeout(() => setToastMessage(null), 3000);
            }
        } catch (err: any) {
            alert(err.message || 'Không thể xóa.');
        }
    };

    const filteredUsers = filterRole === 'ALL'
        ? users
        : users.filter(u => u.role === filterRole);

    const countActive = users.filter(u => u.status === 'ACTIVE').length;
    const countLocked = users.filter(u => u.status === 'LOCKED').length;
    const countStaff = users.filter(u => u.role === 'STAFF_RECEPTION' || u.role === 'STAFF_ACCOUNTANT').length;
    const countAdmin = users.filter(u => u.role === 'ADMIN').length;

    const getRoleBadge = (role: AccountRole) => {
        switch (role) {
            case 'ADMIN':
                return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">👑 ADMIN</span>;
            case 'STAFF_RECEPTION':
                return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40">💁‍♀️ LỄ TÂN</span>;
            case 'STAFF_ACCOUNTANT':
                return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">📊 KẾ TOÁN</span>;
            case 'MEMBER':
                return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">⭐ THÀNH VIÊN</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Quản lý Tài khoản & Phân quyền | Smart Meeting Room</title>
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

                {/* Header Title & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Quản Trị Tài Khoản & Kiểm Soát Quyền Truy Cập</h1>
                        <p className="text-xs text-slate-400">Khóa/mở khóa tài khoản nhân viên (Lễ tân, Kế toán), cấp quyền và đặt lại mật khẩu</p>
                    </div>

                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-1.5"
                    >
                        <span>➕</span>
                        <span>Cấp Tài Khoản Nhân Viên Mới</span>
                    </button>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase">Tổng Tài Khoản</span>
                        <p className="text-xl font-bold text-white mt-1">{users.length}</p>
                        <span className="text-[10px] text-emerald-400">{countActive} đang hoạt động</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase">Tổng Quản Trị (Admin)</span>
                        <p className="text-xl font-bold text-rose-400 mt-1">{countAdmin}</p>
                        <span className="text-[10px] text-slate-400">Toàn quyền hệ thống</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase">Nhân Viên Ca Trực (Staff)</span>
                        <p className="text-xl font-bold text-sky-400 mt-1">{countStaff}</p>
                        <span className="text-[10px] text-slate-400">Lễ tân & Kế toán</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase">Tài Khoản Đang Khóa</span>
                        <p className={`text-xl font-bold mt-1 ${countLocked > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {countLocked}
                        </p>
                        <span className="text-[10px] text-slate-400">Bị vô hiệu hóa truy cập</span>
                    </div>
                </div>

                {/* Filter and Table Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
                        <div>
                            <h2 className="text-sm font-bold text-white">Danh Sách Người Dùng & Trạng Thái Khóa</h2>
                            <p className="text-xs text-slate-400">Quản lý đóng mở quyền đăng nhập và phân quyền chức năng</p>
                        </div>

                        <div className="flex items-center space-x-2 text-xs">
                            <span className="text-slate-400">Lọc theo vai trò:</span>
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white outline-none"
                            >
                                <option value="ALL">Tất cả ({users.length})</option>
                                <option value="ADMIN">Chỉ Admin</option>
                                <option value="STAFF_RECEPTION">Lễ tân</option>
                                <option value="STAFF_ACCOUNTANT">Kế toán</option>
                                <option value="MEMBER">Thành viên</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-400">
                                    <th className="pb-3 font-semibold">Cán Bộ / Người Dùng</th>
                                    <th className="pb-3 font-semibold">Email Liên Hệ</th>
                                    <th className="pb-3 font-semibold">Số Điện Thoại</th>
                                    <th className="pb-3 font-semibold">Vai Trò Quyền Hạn</th>
                                    <th className="pb-3 font-semibold">Trạng Thái Đăng Nhập</th>
                                    <th className="pb-3 font-semibold">Đăng Nhập Gần Nhất</th>
                                    <th className="pb-3 font-semibold text-right">Hành Động Quản Trị</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                                        <td className="py-3.5 font-bold text-white flex items-center space-x-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-xs">
                                                {u.fullName.charAt(0).toUpperCase()}
                                            </div>
                                            <span>{u.fullName}</span>
                                        </td>
                                        <td className="py-3.5 text-slate-300 font-mono">{u.email}</td>
                                        <td className="py-3.5 text-slate-400 font-mono">{u.phone}</td>
                                        <td className="py-3.5">{getRoleBadge(u.role)}</td>
                                        <td className="py-3.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                u.status === 'ACTIVE'
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                            }`}>
                                                {u.status === 'ACTIVE' ? '🟢 HOẠT ĐỘNG' : '🔴 ĐÃ KHÓA'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 text-slate-400">{u.lastLogin || '—'}</td>
                                        <td className="py-3.5 text-right space-x-1.5">
                                            {/* Nút Khóa / Mở khóa tài khoản */}
                                            {u.email !== 'admin@smartbooking.vn' && (
                                                <button
                                                    onClick={() => handleToggleLock(u.id, u.fullName)}
                                                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                                                        u.status === 'ACTIVE'
                                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                                    }`}
                                                >
                                                    {u.status === 'ACTIVE' ? '🔒 Khóa Tài Khoản' : '🔓 Mở Khóa'}
                                                </button>
                                            )}

                                            {/* Nút Reset Mật khẩu */}
                                            <button
                                                onClick={() => handleResetPassword(u.id, u.fullName)}
                                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 font-medium"
                                                title="Đặt lại mật khẩu mặc định: Staff@123456"
                                            >
                                                🔑 Reset MK
                                            </button>

                                            {/* Nút Sửa */}
                                            <button
                                                onClick={() => openEditModal(u)}
                                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] border border-slate-700 font-medium"
                                            >
                                                ✏️ Sửa
                                            </button>

                                            {/* Nút Xóa (Trừ Super Admin) */}
                                            {u.email !== 'admin@smartbooking.vn' && (
                                                <button
                                                    onClick={() => handleDeleteUser(u.id, u.fullName)}
                                                    className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] border border-rose-500/30"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* MODAL THÊM / SỬA TÀI KHOẢN */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h2 className="text-base font-bold text-white">
                                {editingUserId ? 'Chỉnh Sửa Thông Tin & Phân Quyền' : 'Cấp Tài Khoản Cán Bộ Nhân Viên Mới'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Họ và tên cán bộ</label>
                                <input
                                    type="text"
                                    required
                                    value={formFullName}
                                    onChange={(e) => setFormFullName(e.target.value)}
                                    placeholder="Lê Văn Hùng"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Địa chỉ Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        placeholder="hung.le@smartbooking.vn"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Số điện thoại</label>
                                    <input
                                        type="text"
                                        required
                                        value={formPhone}
                                        onChange={(e) => setFormPhone(e.target.value)}
                                        placeholder="0908889999"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Vai trò quyền hạn</label>
                                <select
                                    value={formRole}
                                    onChange={(e: any) => setFormRole(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                >
                                    <option value="STAFF_RECEPTION">💁‍♀️ Lễ Tân Ca Trực (STAFF - Thu tiền mặt & Đặt phòng)</option>
                                    <option value="STAFF_ACCOUNTANT">📊 Kế Toán Viên (STAFF - Đối soát & Quản lý công nợ)</option>
                                    <option value="ADMIN">👑 Quản Trị Viên (ADMIN - Toàn quyền cấu hình & Quản trị tài khoản)</option>
                                    <option value="MEMBER">⭐ Khách Hàng Thành Viên (MEMBER)</option>
                                </select>
                            </div>

                            {!editingUserId && (
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Mật khẩu khởi tạo ban đầu</label>
                                    <input
                                        type="text"
                                        required
                                        value={formPassword}
                                        onChange={(e) => setFormPassword(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono"
                                    />
                                </div>
                            )}

                            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                                >
                                    Lưu Thông Tin Tài Khoản
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withAuth(UsersManagementPage, ['ADMIN']);

