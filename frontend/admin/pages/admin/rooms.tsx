import React, { useState } from 'react';
import Head from 'next/head';
import AdminHeader from '../../components/AdminHeader';
import { withAuth } from '../../components/withAuth';

interface RoomItem {
    id: string;
    name: string;
    roomType: 'STANDARD' | 'EXECUTIVE' | 'BOARDROOM';
    capacity: number;
    hourlyRate: number;
    amenities: {
        projector?: boolean;
        whiteboard?: boolean;
        videoConf?: boolean;
        soundSystem?: boolean;
        smartTv?: boolean;
        highSpeedWifi?: boolean;
    };
    isActive: boolean;
}

interface EquipmentItem {
    id: string;
    roomId: string;
    roomName: string;
    equipmentName: string;
    serialNumber: string;
    status: 'OPERATIONAL' | 'MAINTENANCE' | 'DEFECTIVE';
    notes?: string;
}

interface PricingRuleItem {
    id: string;
    roomName: string;
    ruleName: string;
    timeRange: string;
    multiplier: number;
    isActive: boolean;
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function RoomManagementPage() {
    const [activeTab, setActiveTab] = useState<'ROOMS' | 'PRICING' | 'EQUIPMENT'>('ROOMS');

    // 1. Dữ liệu phòng họp
    const [rooms, setRooms] = useState<RoomItem[]>([
        {
            id: 'r-01',
            name: 'Meeting Room Alpha',
            roomType: 'STANDARD',
            capacity: 8,
            hourlyRate: 350000,
            amenities: { projector: true, whiteboard: true, highSpeedWifi: true },
            isActive: true
        },
        {
            id: 'r-02',
            name: 'Executive Room Tokyo',
            roomType: 'EXECUTIVE',
            capacity: 16,
            hourlyRate: 650000,
            amenities: { projector: true, whiteboard: true, videoConf: true, soundSystem: true, highSpeedWifi: true },
            isActive: true
        },
        {
            id: 'r-03',
            name: 'Boardroom New York',
            roomType: 'BOARDROOM',
            capacity: 24,
            hourlyRate: 1200000,
            amenities: { projector: true, whiteboard: true, videoConf: true, soundSystem: true, smartTv: true, highSpeedWifi: true },
            isActive: false // Đang bảo trì
        }
    ]);

    // 2. Dữ liệu thiết bị
    const [equipments, setEquipments] = useState<EquipmentItem[]>([
        { id: 'eq-01', roomId: 'r-01', roomName: 'Meeting Room Alpha', equipmentName: 'Máy chiếu Epson 1080p', serialNumber: 'EPS-2026-001', status: 'OPERATIONAL' },
        { id: 'eq-02', roomId: 'r-01', roomName: 'Meeting Room Alpha', equipmentName: 'Bảng kính từ tính 2.4m', serialNumber: 'GLS-2026-002', status: 'OPERATIONAL' },
        { id: 'eq-03', roomId: 'r-02', roomName: 'Executive Room Tokyo', equipmentName: 'Camera Hội Nghị Logitech Rally 4K', serialNumber: 'LOG-4K-9901', status: 'OPERATIONAL' },
        { id: 'eq-04', roomId: 'r-02', roomName: 'Executive Room Tokyo', equipmentName: 'Loa hội nghị Jabra Speak 710', serialNumber: 'JAB-710-332', status: 'MAINTENANCE', notes: 'Chờ thay cáp nguồn' },
        { id: 'eq-05', roomId: 'r-03', roomName: 'Boardroom New York', equipmentName: 'Màn hình cảm ứng tương tác Maxhub 86"', serialNumber: 'MAX-86-888', status: 'DEFECTIVE', notes: 'Bị lỗi cảm ứng góc trái' }
    ]);

    // 3. Dữ liệu bảng giá động
    const [pricingRules, setPricingRules] = useState<PricingRuleItem[]>([
        { id: 'pr-01', roomName: 'Tất cả các phòng', ruleName: 'Giờ Vàng Cao Điểm Buổi Sáng', timeRange: '09:00 - 11:00', multiplier: 1.25, isActive: true },
        { id: 'pr-02', roomName: 'Tất cả các phòng', ruleName: 'Giờ Vàng Cao Điểm Buổi Chiều', timeRange: '14:00 - 16:00', multiplier: 1.25, isActive: true },
        { id: 'pr-03', roomName: 'Executive & Boardroom', ruleName: 'Phụ thu Ngoài giờ & Cuối tuần', timeRange: 'Sau 18:00 & Thứ 7, CN', multiplier: 1.15, isActive: true }
    ]);

    // Modal state thêm/sửa phòng
    const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    const [formName, setFormName] = useState<string>('');
    const [formType, setFormType] = useState<'STANDARD' | 'EXECUTIVE' | 'BOARDROOM'>('STANDARD');
    const [formCapacity, setFormCapacity] = useState<number>(8);
    const [formRate, setFormRate] = useState<number>(350000);
    const [formAmenities, setFormAmenities] = useState<any>({ projector: true, whiteboard: true, videoConf: false, highSpeedWifi: true });

    const openCreateModal = () => {
        setEditingRoomId(null);
        setFormName('');
        setFormType('STANDARD');
        setFormCapacity(8);
        setFormRate(350000);
        setFormAmenities({ projector: true, whiteboard: true, videoConf: false, highSpeedWifi: true });
        setIsRoomModalOpen(true);
    };

    const openEditModal = (room: RoomItem) => {
        setEditingRoomId(room.id);
        setFormName(room.name);
        setFormType(room.roomType);
        setFormCapacity(room.capacity);
        setFormRate(room.hourlyRate);
        setFormAmenities(room.amenities);
        setIsRoomModalOpen(true);
    };

    const handleSaveRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingRoomId) {
            setRooms(rooms.map(r => r.id === editingRoomId ? {
                ...r,
                name: formName,
                roomType: formType,
                capacity: formCapacity,
                hourlyRate: formRate,
                amenities: formAmenities
            } : r));
        } else {
            const newRoom: RoomItem = {
                id: `r-${Date.now()}`,
                name: formName,
                roomType: formType,
                capacity: formCapacity,
                hourlyRate: formRate,
                amenities: formAmenities,
                isActive: true
            };
            setRooms([...rooms, newRoom]);
        }
        setIsRoomModalOpen(false);
    };

    const toggleMaintenance = (roomId: string) => {
        setRooms(rooms.map(r => r.id === roomId ? { ...r, isActive: !r.isActive } : r));
    };

    const handleUpdateEquipmentStatus = (id: string, newStatus: 'OPERATIONAL' | 'MAINTENANCE' | 'DEFECTIVE') => {
        setEquipments(equipments.map(eq => eq.id === id ? { ...eq, status: newStatus } : eq));
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Quản lý Phòng, Giá & Thiết bị | Smart Meeting Room</title>
            </Head>

            <AdminHeader />

            <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
                {/* Header Title & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Quản Trị Danh Mục Cơ Sở Vật Chất & Bảng Giá</h1>
                        <p className="text-xs text-slate-400">Thiết lập danh mục phòng họp, định giá theo giờ cao điểm và kiểm kê tài sản thiết bị</p>
                    </div>

                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-1.5"
                    >
                        <span>➕</span>
                        <span>Thêm Phòng Họp Mới</span>
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-800 space-x-2 text-xs font-semibold">
                    <button
                        onClick={() => setActiveTab('ROOMS')}
                        className={`pb-3 px-4 transition-all relative ${
                            activeTab === 'ROOMS'
                                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        🚪 Danh Mục Phòng Họp ({rooms.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('PRICING')}
                        className={`pb-3 px-4 transition-all relative ${
                            activeTab === 'PRICING'
                                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        📈 Bảng Giá Động & Khung Giờ ({pricingRules.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('EQUIPMENT')}
                        className={`pb-3 px-4 transition-all relative ${
                            activeTab === 'EQUIPMENT'
                                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        📽️ Tài Sản & Trang Thiết Bị ({equipments.length})
                    </button>
                </div>

                {/* TAB 1: DANH MỤC PHÒNG HỌP */}
                {activeTab === 'ROOMS' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {rooms.map(room => (
                                <div key={room.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
                                    <div>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="text-base font-bold text-white">{room.name}</h3>
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${
                                                    room.roomType === 'BOARDROOM'
                                                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                                        : room.roomType === 'EXECUTIVE'
                                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                }`}>
                                                    {room.roomType}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-emerald-400">{formatVND(room.hourlyRate)}</p>
                                                <p className="text-[10px] text-slate-400">mỗi giờ</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-800 text-xs space-y-1.5">
                                            <div className="flex justify-between text-slate-400">
                                                <span>Sức chứa:</span>
                                                <span className="font-semibold text-slate-200">{room.capacity} người</span>
                                            </div>
                                            <div className="flex justify-between text-slate-400">
                                                <span>Trạng thái:</span>
                                                <span className={`font-semibold ${room.isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {room.isActive ? '🟢 Đang hoạt động' : '🟡 Đang bảo trì'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Amenities badges */}
                                        <div className="mt-4 flex flex-wrap gap-1.5">
                                            {room.amenities.projector && <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">📽️ Máy chiếu</span>}
                                            {room.amenities.whiteboard && <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">📋 Bảng viết</span>}
                                            {room.amenities.videoConf && <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">📹 Video 4K</span>}
                                            {room.amenities.soundSystem && <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">🔊 Âm thanh</span>}
                                            {room.amenities.smartTv && <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">📺 Smart TV</span>}
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                        <button
                                            onClick={() => toggleMaintenance(room.id)}
                                            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                                room.isActive
                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                                            }`}
                                        >
                                            {room.isActive ? 'Tạm ngưng bảo trì' : 'Mở lại phòng'}
                                        </button>
                                        <button
                                            onClick={() => openEditModal(room)}
                                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium"
                                        >
                                            ✏️ Chỉnh sửa
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 2: BẢNG GIÁ ĐỘNG */}
                {activeTab === 'PRICING' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white">Quy Tắc Định Giá Động Theo Khung Giờ (Dynamic Pricing Engine)</h3>
                                <p className="text-xs text-slate-400">Tự động nhân hệ số giá vào các khung giờ vàng cao điểm hoặc ngày nghỉ cuối tuần</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="pb-3 font-semibold">Tên Quy Tắc</th>
                                        <th className="pb-3 font-semibold">Phạm Vi Áp Dụng</th>
                                        <th className="pb-3 font-semibold">Khung Thời Gian</th>
                                        <th className="pb-3 font-semibold">Hệ Số Phụ Thu</th>
                                        <th className="pb-3 font-semibold">Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {pricingRules.map(rule => (
                                        <tr key={rule.id} className="hover:bg-slate-800/30">
                                            <td className="py-3.5 font-bold text-white">{rule.ruleName}</td>
                                            <td className="py-3.5 text-slate-300">{rule.roomName}</td>
                                            <td className="py-3.5 text-emerald-400 font-mono">{rule.timeRange}</td>
                                            <td className="py-3.5 font-bold text-amber-400">+{((rule.multiplier - 1) * 100).toFixed(0)}% ({rule.multiplier}x)</td>
                                            <td className="py-3.5">
                                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                                    ĐANG ÁP DỤNG
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 3: TRANG THIẾT BỊ / TÀI SẢN */}
                {activeTab === 'EQUIPMENT' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white">Kiểm Kê Tài Sản & Trang Thiết Bị Phòng Họp</h3>
                                <p className="text-xs text-slate-400">Theo dõi vòng đời hoạt động, bảo dưỡng và xử lý sự cố thiết bị tại từng phòng</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="pb-3 font-semibold">Tên Thiết Bị</th>
                                        <th className="pb-3 font-semibold">Mã Serial / Tài Sản</th>
                                        <th className="pb-3 font-semibold">Phòng Lắp Đặt</th>
                                        <th className="pb-3 font-semibold">Tình Trạng</th>
                                        <th className="pb-3 font-semibold">Ghi Chú</th>
                                        <th className="pb-3 font-semibold">Hành Động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {equipments.map(eq => (
                                        <tr key={eq.id} className="hover:bg-slate-800/30">
                                            <td className="py-3.5 font-bold text-white">{eq.equipmentName}</td>
                                            <td className="py-3.5 font-mono text-slate-400">{eq.serialNumber}</td>
                                            <td className="py-3.5 text-slate-300">{eq.roomName}</td>
                                            <td className="py-3.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                    eq.status === 'OPERATIONAL'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                        : eq.status === 'MAINTENANCE'
                                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                                }`}>
                                                    {eq.status === 'OPERATIONAL' ? '🟢 Tốt' : eq.status === 'MAINTENANCE' ? '🟡 Đang sửa' : '🔴 Hỏng'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 text-slate-400 italic">{eq.notes || '—'}</td>
                                            <td className="py-3.5 space-x-1.5">
                                                <button
                                                    onClick={() => handleUpdateEquipmentStatus(eq.id, 'OPERATIONAL')}
                                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                                                >
                                                    Đánh dấu Tốt
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateEquipmentStatus(eq.id, 'DEFECTIVE')}
                                                    className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-[10px] text-rose-400 border border-rose-500/30"
                                                >
                                                    Báo Hỏng
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* MODAL THÊM / SỬA PHÒNG */}
            {isRoomModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h2 className="text-base font-bold text-white">
                                {editingRoomId ? 'Chỉnh Sửa Thông Tin Phòng' : 'Thêm Phòng Họp Mới'}
                            </h2>
                            <button
                                onClick={() => setIsRoomModalOpen(false)}
                                className="text-slate-400 hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveRoom} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Tên phòng họp</label>
                                <input
                                    type="text"
                                    required
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Meeting Room Gamma"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Loại phòng</label>
                                    <select
                                        value={formType}
                                        onChange={(e: any) => setFormType(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    >
                                        <option value="STANDARD">STANDARD</option>
                                        <option value="EXECUTIVE">EXECUTIVE</option>
                                        <option value="BOARDROOM">BOARDROOM</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Sức chứa (người)</label>
                                    <input
                                        type="number"
                                        required
                                        min={1}
                                        value={formCapacity}
                                        onChange={(e) => setFormCapacity(parseInt(e.target.value, 10))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Đơn giá cơ bản (VND/giờ)</label>
                                <input
                                    type="number"
                                    required
                                    step={10000}
                                    value={formRate}
                                    onChange={(e) => setFormRate(parseFloat(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-2">Trang thiết bị & Tiện ích sẵn có</label>
                                <div className="grid grid-cols-2 gap-2 text-slate-300">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formAmenities.projector || false}
                                            onChange={(e) => setFormAmenities({ ...formAmenities, projector: e.target.checked })}
                                            className="rounded bg-slate-800 border-slate-700 text-emerald-500"
                                        />
                                        <span>📽️ Máy chiếu</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formAmenities.whiteboard || false}
                                            onChange={(e) => setFormAmenities({ ...formAmenities, whiteboard: e.target.checked })}
                                            className="rounded bg-slate-800 border-slate-700 text-emerald-500"
                                        />
                                        <span>📋 Bảng viết</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formAmenities.videoConf || false}
                                            onChange={(e) => setFormAmenities({ ...formAmenities, videoConf: e.target.checked })}
                                            className="rounded bg-slate-800 border-slate-700 text-emerald-500"
                                        />
                                        <span>📹 Video Conference</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formAmenities.soundSystem || false}
                                            onChange={(e) => setFormAmenities({ ...formAmenities, soundSystem: e.target.checked })}
                                            className="rounded bg-slate-800 border-slate-700 text-emerald-500"
                                        />
                                        <span>🔊 Hệ thống âm thanh</span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRoomModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold"
                                >
                                    Lưu Thay Đổi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withAuth(RoomManagementPage);

