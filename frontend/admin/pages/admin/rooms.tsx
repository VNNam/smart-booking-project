import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminHeader from '../../components/AdminHeader';
import { withAuth } from '../../components/withAuth';
import {
    roomStore,
    RoomItem,
    PricingRuleItem,
    EquipmentItem,
    DEFAULT_ROOMS,
    DEFAULT_PRICING_RULES,
    DEFAULT_EQUIPMENTS
} from '../../lib/roomStore';

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function RoomManagementPage() {
    const [activeTab, setActiveTab] = useState<'ROOMS' | 'PRICING' | 'EQUIPMENT'>('ROOMS');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // =========================================================================
    // 1. DATA STATES - LOAD TỪ PERSISTENT STORE
    // =========================================================================
    const [rooms, setRooms] = useState<RoomItem[]>(DEFAULT_ROOMS);
    const [pricingRules, setPricingRules] = useState<PricingRuleItem[]>(DEFAULT_PRICING_RULES);
    const [equipments, setEquipments] = useState<EquipmentItem[]>(DEFAULT_EQUIPMENTS);

    useEffect(() => {
        setRooms(roomStore.getRooms());
        setPricingRules(roomStore.getPricingRules());
        setEquipments(roomStore.getEquipments());

        const unsubscribe = roomStore.subscribe((updatedRooms) => {
            setRooms(updatedRooms);
        });

        return () => unsubscribe();
    }, []);

    // =========================================================================
    // 2. MODAL & FORM STATE: PHÒNG HỌP (ROOMS)
    // =========================================================================
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
            roomStore.updateRoom(editingRoomId, {
                name: formName,
                roomType: formType,
                capacity: formCapacity,
                hourlyRate: formRate,
                amenities: formAmenities
            });
            setToastMessage(`✅ Đã cập nhật thành công thông tin phòng [${formName}].`);
        } else {
            const added = roomStore.addRoom({
                name: formName,
                roomType: formType,
                capacity: formCapacity,
                hourlyRate: formRate,
                amenities: formAmenities,
                isActive: true
            });
            setToastMessage(`✅ Đã thêm phòng họp mới [${added.name}]. Dữ liệu đã lưu trữ bền vững.`);
        }
        setRooms(roomStore.getRooms());
        setIsRoomModalOpen(false);
        setTimeout(() => setToastMessage(null), 4000);
    };

    const toggleMaintenance = async (roomId: string) => {
        const updated = await roomStore.toggleMaintenance(roomId);
        if (updated) {
            setRooms(roomStore.getRooms());
            const msg = updated.isActive
                ? `🟢 ĐÃ MỞ LẠI PHÒNG [${updated.name}]: Phòng đã sẵn sàng đón khách và được hiển thị tại chức năng Thu tiền mặt.`
                : `🟡 ĐÃ TẠM NGƯNG BẢO TRÌ [${updated.name}]: Phòng đã được chuyển sang chế độ bảo trì, các slot trống đã khóa và đã cập nhật sang chức năng Thu tiền mặt.`;
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 5000);
        }
    };

    // =========================================================================
    // 3. MODAL & FORM STATE: QUY TẮC GIÁ ĐỘNG & KHUNG GIỜ (PRICING)
    // =========================================================================
    const [isPricingModalOpen, setIsPricingModalOpen] = useState<boolean>(false);
    const [editingPricingId, setEditingPricingId] = useState<string | null>(null);
    const [formRuleName, setFormRuleName] = useState<string>('');
    const [formRuleRoomName, setFormRuleRoomName] = useState<string>('Tất cả các phòng');
    const [formRuleStartTime, setFormRuleStartTime] = useState<string>('09:00');
    const [formRuleEndTime, setFormRuleEndTime] = useState<string>('11:00');
    const [formRuleDays, setFormRuleDays] = useState<string>('Thứ 2 - Thứ 6');
    const [formRuleMultiplier, setFormRuleMultiplier] = useState<number>(1.25);

    const openCreatePricingModal = () => {
        setEditingPricingId(null);
        setFormRuleName('');
        setFormRuleRoomName('Tất cả các phòng');
        setFormRuleStartTime('09:00');
        setFormRuleEndTime('11:00');
        setFormRuleDays('Thứ 2 - Thứ 6');
        setFormRuleMultiplier(1.25);
        setIsPricingModalOpen(true);
    };

    const openEditPricingModal = (rule: PricingRuleItem) => {
        setEditingPricingId(rule.id);
        setFormRuleName(rule.ruleName);
        setFormRuleRoomName(rule.roomName);
        setFormRuleStartTime(rule.startTime || '09:00');
        setFormRuleEndTime(rule.endTime || '11:00');
        setFormRuleDays(rule.applicableDays || 'Thứ 2 - Thứ 6');
        setFormRuleMultiplier(rule.multiplier);
        setIsPricingModalOpen(true);
    };

    const handleSavePricingRule = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingPricingId) {
            roomStore.updatePricingRule(editingPricingId, {
                ruleName: formRuleName,
                roomName: formRuleRoomName,
                startTime: formRuleStartTime,
                endTime: formRuleEndTime,
                applicableDays: formRuleDays,
                multiplier: formRuleMultiplier
            });
            setToastMessage(`✅ Đã cập nhật quy tắc giá & khung giờ [${formRuleName}].`);
        } else {
            roomStore.addPricingRule({
                ruleName: formRuleName,
                roomName: formRuleRoomName,
                startTime: formRuleStartTime,
                endTime: formRuleEndTime,
                applicableDays: formRuleDays,
                multiplier: formRuleMultiplier,
                isActive: true
            });
            setToastMessage(`✅ Đã thêm quy tắc giá & khung giờ mới [${formRuleName}].`);
        }
        setPricingRules(roomStore.getPricingRules());
        setIsPricingModalOpen(false);
        setTimeout(() => setToastMessage(null), 4000);
    };

    const handleTogglePricingRule = (id: string) => {
        const updated = roomStore.togglePricingRule(id);
        if (updated) {
            setPricingRules(roomStore.getPricingRules());
            setToastMessage(`Đã ${updated.isActive ? 'KÍCH HOẠT' : 'TẠM TẮT'} quy tắc giá [${updated.ruleName}].`);
            setTimeout(() => setToastMessage(null), 3000);
        }
    };

    const handleDeletePricingRule = (id: string, name: string) => {
        if (confirm(`Bạn có chắc chắn muốn xóa quy tắc giá [${name}]?`)) {
            roomStore.deletePricingRule(id);
            setPricingRules(roomStore.getPricingRules());
            setToastMessage(`Đã xóa quy tắc giá [${name}].`);
            setTimeout(() => setToastMessage(null), 3000);
        }
    };

    // =========================================================================
    // 4. MODAL & FORM STATE: TÀI SẢN & THIẾT BỊ (EQUIPMENT)
    // =========================================================================
    const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState<boolean>(false);
    const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
    const [formEqRoomId, setFormEqRoomId] = useState<string>('');
    const [formEqName, setFormEqName] = useState<string>('');
    const [formEqSerial, setFormEqSerial] = useState<string>('');
    const [formEqQuantity, setFormEqQuantity] = useState<number>(1);
    const [formEqStatus, setFormEqStatus] = useState<'OPERATIONAL' | 'MAINTENANCE' | 'DEFECTIVE'>('OPERATIONAL');
    const [formEqNotes, setFormEqNotes] = useState<string>('');

    const openCreateEquipmentModal = () => {
        setEditingEquipmentId(null);
        setFormEqRoomId(rooms[0]?.id || '');
        setFormEqName('');
        setFormEqSerial(`SN-${Date.now().toString().slice(-6)}`);
        setFormEqQuantity(1);
        setFormEqStatus('OPERATIONAL');
        setFormEqNotes('');
        setIsEquipmentModalOpen(true);
    };

    const openEditEquipmentModal = (eq: EquipmentItem) => {
        setEditingEquipmentId(eq.id);
        setFormEqRoomId(eq.roomId);
        setFormEqName(eq.equipmentName);
        setFormEqSerial(eq.serialNumber);
        setFormEqQuantity(eq.quantity || 1);
        setFormEqStatus(eq.status);
        setFormEqNotes(eq.notes || '');
        setIsEquipmentModalOpen(true);
    };

    const handleSaveEquipment = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedRoom = rooms.find(r => r.id === formEqRoomId) || rooms[0];
        const roomName = selectedRoom ? selectedRoom.name : 'Phòng chung';

        if (editingEquipmentId) {
            roomStore.updateEquipment(editingEquipmentId, {
                roomId: formEqRoomId,
                roomName,
                equipmentName: formEqName,
                serialNumber: formEqSerial,
                quantity: formEqQuantity,
                status: formEqStatus,
                notes: formEqNotes
            });
            setToastMessage(`✅ Đã cập nhật thiết bị [${formEqName}].`);
        } else {
            roomStore.addEquipment({
                roomId: formEqRoomId,
                roomName,
                equipmentName: formEqName,
                serialNumber: formEqSerial,
                quantity: formEqQuantity,
                status: formEqStatus,
                notes: formEqNotes
            });
            setToastMessage(`✅ Đã thêm thiết bị mới [${formEqName}] vào phòng [${roomName}].`);
        }
        setEquipments(roomStore.getEquipments());
        setIsEquipmentModalOpen(false);
        setTimeout(() => setToastMessage(null), 4000);
    };

    const handleUpdateEquipmentStatus = (id: string, newStatus: 'OPERATIONAL' | 'MAINTENANCE' | 'DEFECTIVE') => {
        const updated = roomStore.updateEquipmentStatus(id, newStatus);
        if (updated) {
            setEquipments(roomStore.getEquipments());
            setToastMessage(`Đã cập nhật tình trạng thiết bị [${updated.equipmentName}] sang: ${newStatus === 'OPERATIONAL' ? '🟢 TỐT' : newStatus === 'MAINTENANCE' ? '🟡 BẢO DƯỠNG' : '🔴 HỎNG'}`);
            setTimeout(() => setToastMessage(null), 3000);
        }
    };

    const handleDeleteEquipment = (id: string, name: string) => {
        if (confirm(`Bạn có chắc chắn muốn xóa thiết bị [${name}] khỏi danh mục kiểm kê?`)) {
            roomStore.deleteEquipment(id);
            setEquipments(roomStore.getEquipments());
            setToastMessage(`Đã xóa thiết bị [${name}].`);
            setTimeout(() => setToastMessage(null), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <Head>
                <title>Quản lý Phòng, Giá & Thiết bị | Smart Meeting Room</title>
            </Head>

            <AdminHeader />

            <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
                {/* Thông báo trạng thái thời gian thực */}
                {toastMessage && (
                    <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-lg flex items-center justify-between animate-fade-in">
                        <div className="flex items-center space-x-2">
                            <span className="text-base">🔔</span>
                            <span>{toastMessage}</span>
                        </div>
                        <button
                            onClick={() => setToastMessage(null)}
                            className="text-slate-400 hover:text-white text-xs px-2 py-0.5"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Header Title & Dynamic Actions theo Tab */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Quản Trị Danh Mục Cơ Sở Vật Chất & Bảng Giá</h1>
                        <p className="text-xs text-slate-400">Thiết lập danh mục phòng họp, định giá theo khung giờ cao điểm và kiểm kê tài sản thiết bị</p>
                    </div>

                    {activeTab === 'ROOMS' && (
                        <button
                            onClick={openCreateModal}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-1.5"
                        >
                            <span>➕</span>
                            <span>Thêm Phòng Họp Mới</span>
                        </button>
                    )}

                    {activeTab === 'PRICING' && (
                        <button
                            onClick={openCreatePricingModal}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-1.5"
                        >
                            <span>➕</span>
                            <span>Thêm Khung Giờ & Giá Mới</span>
                        </button>
                    )}

                    {activeTab === 'EQUIPMENT' && (
                        <button
                            onClick={openCreateEquipmentModal}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-1.5"
                        >
                            <span>➕</span>
                            <span>Thêm Thiết Bị / Tài Sản</span>
                        </button>
                    )}
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
                        ⚡ Bảng Giá Động & Khung Giờ ({pricingRules.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('EQUIPMENT')}
                        className={`pb-3 px-4 transition-all relative ${
                            activeTab === 'EQUIPMENT'
                                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        🛠️ Tài Sản & Trang Thiết Bị ({equipments.length})
                    </button>
                </div>

                {/* =========================================================================
                    TAB 1: DANH MỤC PHÒNG HỌP (ROOMS)
                ========================================================================= */}
                {activeTab === 'ROOMS' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {rooms.map(room => (
                                <div
                                    key={room.id}
                                    className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all ${
                                        room.isActive ? 'border-slate-800 hover:border-slate-700' : 'border-amber-500/40 bg-slate-900/60'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                                    {room.roomType}
                                                </span>
                                                <h3 className="text-base font-bold text-white mt-1.5">{room.name}</h3>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-emerald-400 font-bold text-sm">{formatVND(room.hourlyRate)}</p>
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

                                    <div className="pt-3 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
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

                {/* =========================================================================
                    TAB 2: BẢNG GIÁ ĐỘNG & KHUNG GIỜ (PRICING)
                ========================================================================= */}
                {activeTab === 'PRICING' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-white">Quy Tắc Định Giá Động Theo Khung Giờ (Dynamic Pricing Engine)</h3>
                                <p className="text-xs text-slate-400">Tự động điều chỉnh hệ số giá theo khung giờ vàng cao điểm, buổi tối hoặc ngày nghỉ cuối tuần</p>
                            </div>
                            <button
                                onClick={openCreatePricingModal}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold flex items-center space-x-1.5 self-start"
                            >
                                <span>➕</span>
                                <span>Thêm Quy Tắc Giá</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="pb-3 font-semibold">Tên Quy Tắc</th>
                                        <th className="pb-3 font-semibold">Phạm Vi Áp Dụng</th>
                                        <th className="pb-3 font-semibold">Khung Giờ</th>
                                        <th className="pb-3 font-semibold">Ngày Áp Dụng</th>
                                        <th className="pb-3 font-semibold">Hệ Số Phụ Thu</th>
                                        <th className="pb-3 font-semibold">Trạng Thái</th>
                                        <th className="pb-3 font-semibold text-right">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {pricingRules.map(rule => (
                                        <tr key={rule.id} className="hover:bg-slate-800/30">
                                            <td className="py-3.5 font-bold text-white">{rule.ruleName}</td>
                                            <td className="py-3.5 text-slate-300">{rule.roomName}</td>
                                            <td className="py-3.5 text-emerald-400 font-mono font-semibold">
                                                {rule.startTime} - {rule.endTime}
                                            </td>
                                            <td className="py-3.5 text-slate-400">{rule.applicableDays}</td>
                                            <td className="py-3.5 font-bold text-amber-400">
                                                +{((rule.multiplier - 1) * 100).toFixed(0)}% ({rule.multiplier}x)
                                            </td>
                                            <td className="py-3.5">
                                                <button
                                                    onClick={() => handleTogglePricingRule(rule.id)}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                                        rule.isActive
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                                    }`}
                                                >
                                                    {rule.isActive ? '🟢 ĐANG ÁP DỤNG' : '⚪ TẠM TẮT'}
                                                </button>
                                            </td>
                                            <td className="py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => openEditPricingModal(rule)}
                                                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 font-medium"
                                                >
                                                    ✏️ Sửa
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePricingRule(rule.id, rule.ruleName)}
                                                    className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-[11px] text-rose-400 border border-rose-500/30 font-medium"
                                                >
                                                    🗑️ Xóa
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    TAB 3: TÀI SẢN & TRANG THIẾT BỊ (EQUIPMENT)
                ========================================================================= */}
                {activeTab === 'EQUIPMENT' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-white">Kiểm Kê Tài Sản & Trang Thiết Bị Phòng Họp</h3>
                                <p className="text-xs text-slate-400">Theo dõi vòng đời hoạt động, số lượng, bảo dưỡng và xử lý sự cố thiết bị tại từng phòng</p>
                            </div>
                            <button
                                onClick={openCreateEquipmentModal}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold flex items-center space-x-1.5 self-start"
                            >
                                <span>➕</span>
                                <span>Thêm Thiết Bị</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="pb-3 font-semibold">Tên Thiết Bị</th>
                                        <th className="pb-3 font-semibold">Mã Serial / Tài Sản</th>
                                        <th className="pb-3 font-semibold">Phòng Lắp Đặt</th>
                                        <th className="pb-3 font-semibold">Số Lượng</th>
                                        <th className="pb-3 font-semibold">Tình Trạng</th>
                                        <th className="pb-3 font-semibold">Ghi Chú</th>
                                        <th className="pb-3 font-semibold text-right">Hành Động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {equipments.map(eq => (
                                        <tr key={eq.id} className="hover:bg-slate-800/30">
                                            <td className="py-3.5 font-bold text-white">{eq.equipmentName}</td>
                                            <td className="py-3.5 font-mono text-slate-400">{eq.serialNumber}</td>
                                            <td className="py-3.5 text-slate-300">{eq.roomName}</td>
                                            <td className="py-3.5 font-semibold text-slate-200">{eq.quantity || 1}</td>
                                            <td className="py-3.5">
                                                <select
                                                    value={eq.status}
                                                    onChange={(e: any) => handleUpdateEquipmentStatus(eq.id, e.target.value)}
                                                    className={`px-2 py-1 rounded text-[11px] font-bold border outline-none bg-slate-900 cursor-pointer ${
                                                        eq.status === 'OPERATIONAL'
                                                            ? 'text-emerald-400 border-emerald-500/40'
                                                            : eq.status === 'MAINTENANCE'
                                                            ? 'text-amber-400 border-amber-500/40'
                                                            : 'text-rose-400 border-rose-500/40'
                                                    }`}
                                                >
                                                    <option value="OPERATIONAL">🟢 Tốt (Hoạt động)</option>
                                                    <option value="MAINTENANCE">🟡 Bảo dưỡng / Sửa</option>
                                                    <option value="DEFECTIVE">🔴 Hỏng hóc</option>
                                                </select>
                                            </td>
                                            <td className="py-3.5 text-slate-400 italic max-w-xs truncate">{eq.notes || '—'}</td>
                                            <td className="py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => openEditEquipmentModal(eq)}
                                                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 font-medium"
                                                >
                                                    ✏️ Sửa
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEquipment(eq.id, eq.equipmentName)}
                                                    className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-[11px] text-rose-400 border border-rose-500/30 font-medium"
                                                >
                                                    🗑️ Xóa
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

            {/* =========================================================================
                MODAL 1: THÊM / SỬA PHÒNG HỌP
            ========================================================================= */}
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

                            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRoomModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                                >
                                    Lưu Thay Đổi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL 2: THÊM / SỬA QUY TẮC GIÁ & KHUNG GIỜ
            ========================================================================= */}
            {isPricingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h2 className="text-base font-bold text-white">
                                {editingPricingId ? 'Chỉnh Sửa Quy Tắc Giá & Khung Giờ' : 'Thêm Quy Tắc Giá & Khung Giờ Mới'}
                            </h2>
                            <button
                                onClick={() => setIsPricingModalOpen(false)}
                                className="text-slate-400 hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSavePricingRule} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Tên quy tắc định giá</label>
                                <input
                                    type="text"
                                    required
                                    value={formRuleName}
                                    onChange={(e) => setFormRuleName(e.target.value)}
                                    placeholder="Giờ Cao Điểm Sáng / Phụ thu Cuối tuần"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Phạm vi phòng áp dụng</label>
                                <select
                                    value={formRuleRoomName}
                                    onChange={(e) => setFormRuleRoomName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                >
                                    <option value="Tất cả các phòng">Tất cả các phòng</option>
                                    <option value="Executive & Boardroom">Executive & Boardroom</option>
                                    {rooms.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Giờ bắt đầu</label>
                                    <input
                                        type="time"
                                        required
                                        value={formRuleStartTime}
                                        onChange={(e) => setFormRuleStartTime(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Giờ kết thúc</label>
                                    <input
                                        type="time"
                                        required
                                        value={formRuleEndTime}
                                        onChange={(e) => setFormRuleEndTime(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Ngày trong tuần áp dụng</label>
                                    <select
                                        value={formRuleDays}
                                        onChange={(e) => setFormRuleDays(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    >
                                        <option value="Tất cả các ngày">Tất cả các ngày</option>
                                        <option value="Thứ 2 - Thứ 6">Thứ 2 - Thứ 6 (Ngày thường)</option>
                                        <option value="Thứ 7 & CN">Thứ 7 & Chủ Nhật (Cuối tuần)</option>
                                        <option value="Ngày Lễ / Tết">Ngày Lễ / Tết</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Hệ số nhân giá</label>
                                    <select
                                        value={formRuleMultiplier}
                                        onChange={(e) => setFormRuleMultiplier(parseFloat(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    >
                                        <option value={1.1}>+10% (Nhân 1.1x)</option>
                                        <option value={1.15}>+15% (Nhân 1.15x)</option>
                                        <option value={1.2}>+20% (Nhân 1.2x)</option>
                                        <option value={1.25}>+25% (Nhân 1.25x - Khuyến nghị)</option>
                                        <option value={1.3}>+30% (Nhân 1.3x)</option>
                                        <option value={1.5}>+50% (Nhân 1.5x - Giờ Vàng/Lễ)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPricingModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                                >
                                    Lưu Quy Tắc Giá
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL 3: THÊM / SỬA THIẾT BỊ / TÀI SẢN
            ========================================================================= */}
            {isEquipmentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h2 className="text-base font-bold text-white">
                                {editingEquipmentId ? 'Chỉnh Sửa Thông Tin Thiết Bị' : 'Thêm Thiết Bị / Tài Sản Mới'}
                            </h2>
                            <button
                                onClick={() => setIsEquipmentModalOpen(false)}
                                className="text-slate-400 hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEquipment} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Phòng lắp đặt</label>
                                    <select
                                        value={formEqRoomId}
                                        onChange={(e) => setFormEqRoomId(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    >
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Số lượng</label>
                                    <input
                                        type="number"
                                        required
                                        min={1}
                                        value={formEqQuantity}
                                        onChange={(e) => setFormEqQuantity(parseInt(e.target.value, 10))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Tên thiết bị / Chủng loại</label>
                                <input
                                    type="text"
                                    required
                                    value={formEqName}
                                    onChange={(e) => setFormEqName(e.target.value)}
                                    placeholder="Máy chiếu 4K Laser, Bảng kính từ tính, Camera 4K..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Mã Serial / Mã tài sản</label>
                                    <input
                                        type="text"
                                        required
                                        value={formEqSerial}
                                        onChange={(e) => setFormEqSerial(e.target.value)}
                                        placeholder="EPS-2026-001"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Tình trạng vận hành</label>
                                    <select
                                        value={formEqStatus}
                                        onChange={(e: any) => setFormEqStatus(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                    >
                                        <option value="OPERATIONAL">🟢 Tốt (Hoạt động bình thường)</option>
                                        <option value="MAINTENANCE">🟡 Đang bảo dưỡng / Sửa chữa</option>
                                        <option value="DEFECTIVE">🔴 Hỏng hóc / Chờ thay thế</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Ghi chú kỹ thuật / Lịch bảo hành</label>
                                <textarea
                                    rows={2}
                                    value={formEqNotes}
                                    onChange={(e) => setFormEqNotes(e.target.value)}
                                    placeholder="Ví dụ: Đã thay bóng đèn tháng 10/2026, còn bảo hành đến 2028..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEquipmentModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                                >
                                    Lưu Thiết Bị
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withAuth(RoomManagementPage, ['ADMIN', 'STAFF']);
