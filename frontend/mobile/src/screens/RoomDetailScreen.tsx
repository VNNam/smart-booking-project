/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Room Detail & Slot Selection Screen
 * FILE: frontend/mobile/src/screens/RoomDetailScreen.tsx
 * MÔ TẢ: Màn hình chi tiết phòng họp và lựa chọn khung giờ họp (React Native/TypeScript)
 *       Hiển thị tiện ích, bảng tính tạm phí và cảnh báo chính sách hủy đa tầng v1.4.
 * ==============================================================================
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Alert
} from 'react-native';
import { RoomItem } from './RoomSearchScreen';

interface TimeSlot {
    id: string;
    startTime: string; // e.g. "09:00"
    endTime: string;   // e.g. "11:00"
    durationHours: number;
    status: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
}

const MOCK_SLOTS: TimeSlot[] = [
    { id: 's-01', startTime: '08:00', endTime: '10:00', durationHours: 2, status: 'AVAILABLE' },
    { id: 's-02', startTime: '10:00', endTime: '12:00', durationHours: 2, status: 'LOCKED' },
    { id: 's-03', startTime: '13:00', endTime: '15:00', durationHours: 2, status: 'AVAILABLE' },
    { id: 's-04', startTime: '15:30', endTime: '17:30', durationHours: 2, status: 'AVAILABLE' },
    { id: 's-05', startTime: '18:00', endTime: '20:00', durationHours: 2, status: 'BOOKED' }
];

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export default function RoomDetailScreen({ route, navigation }: any) {
    const room: RoomItem = route?.params?.room || {
        id: 'r-01',
        name: 'Meeting Room Alpha',
        branchName: 'Chi nhánh Quận 1 (Tầng 12)',
        roomType: 'STANDARD',
        capacity: 8,
        hourlyRate: 350000,
        amenities: { projector: true, whiteboard: true, videoConf: false },
        currentStatus: 'AVAILABLE'
    };

    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

    const calculatedTotal = selectedSlot ? selectedSlot.durationHours * room.hourlyRate : 0;

    const handleProceedToCheckout = () => {
        if (!selectedSlot) {
            Alert.alert('Chưa chọn giờ', 'Vui lòng chọn khung giờ họp còn trống trước khi tiếp tục.');
            return;
        }

        navigation.navigate('Checkout', {
            room,
            slot: selectedSlot,
            totalAmount: calculatedTotal
        });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#020617" />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Header Info */}
                <View style={styles.headerBox}>
                    <Text style={styles.roomType}>{room.roomType}</Text>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.branchName}>{room.branchName}</Text>
                    <Text style={styles.rateHighlight}>{formatVND(room.hourlyRate)} / giờ</Text>
                </View>

                {/* Amenities List */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Trang Thiết Bị Khả Dụng</Text>
                    <View style={styles.amenityRow}>
                        <View style={styles.amenityBadge}>
                            <Text style={styles.amenityText}>👥 Sức chứa: {room.capacity} người</Text>
                        </View>
                        {room.amenities.projector && (
                            <View style={styles.amenityBadge}>
                                <Text style={styles.amenityText}>📽️ Máy chiếu 4K</Text>
                            </View>
                        )}
                        {room.amenities.whiteboard && (
                            <View style={styles.amenityBadge}>
                                <Text style={styles.amenityText}>📝 Bảng viết dạ</Text>
                            </View>
                        )}
                        {room.amenities.videoConf && (
                            <View style={styles.amenityBadge}>
                                <Text style={styles.amenityText}>📹 Thiết bị Video Conference</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Slots Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Chọn Khung Giờ Họp (Hôm Nay)</Text>
                    <View style={styles.slotsGrid}>
                        {MOCK_SLOTS.map((slot) => {
                            const isSelected = selectedSlot?.id === slot.id;
                            const isAvailable = slot.status === 'AVAILABLE';

                            return (
                                <TouchableOpacity
                                    key={slot.id}
                                    testID={`slot-select-${slot.id}`}
                                    disabled={!isAvailable}
                                    onPress={() => setSelectedSlot(slot)}
                                    style={[
                                        styles.slotBox,
                                        isSelected && styles.slotSelected,
                                        !isAvailable && styles.slotDisabled
                                    ]}
                                >
                                    <Text style={[styles.slotTime, isSelected && styles.slotTimeSelected]}>
                                        {slot.startTime} - {slot.endTime}
                                    </Text>
                                    <Text style={styles.slotStatus}>
                                        {slot.status === 'AVAILABLE' && 'Còn trống'}
                                        {slot.status === 'LOCKED' && 'Đang giữ 10p'}
                                        {slot.status === 'BOOKED' && 'Đã đặt'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Chính sách hủy phòng v1.4 banner */}
                <View style={styles.policyBox}>
                    <Text style={styles.policyTitle}>📋 Chính Sách Hủy Đa Tầng (BRD v1.4):</Text>
                    <Text style={styles.policyDesc}>• Hủy trước ≥ 24h: Hoàn 100% tiền.</Text>
                    <Text style={styles.policyDesc}>• Hủy trước 2h - 24h: Hoàn 80% (Phạt 20%).</Text>
                    <Text style={styles.policyDesc}>• Hủy sát giờ &lt; 2h: Không hoàn tiền (Phạt 100%).</Text>
                    <Text style={styles.policyDesc}>• Tối đa 2 lần hủy miễn phạt/tháng (Lần thứ 3 phạt 30%).</Text>
                </View>
            </ScrollView>

            {/* Bottom Checkout Action */}
            <View style={styles.bottomBar}>
                <View>
                    <Text style={styles.totalLabel}>Tổng tạm tính:</Text>
                    <Text style={styles.totalValue}>{formatVND(calculatedTotal)}</Text>
                </View>
                <TouchableOpacity
                    testID="btn-proceed-checkout"
                    style={[styles.btnCheckout, !selectedSlot && styles.btnCheckoutDisabled]}
                    disabled={!selectedSlot}
                    onPress={handleProceedToCheckout}
                >
                    <Text style={styles.btnCheckoutText}>Tiến Hành Giữ Chỗ & Thanh Toán →</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#020617' },
    container: { flex: 1, backgroundColor: '#020617' },
    content: { padding: 16, paddingBottom: 100 },
    headerBox: {
        backgroundColor: '#0f172a',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1e293b',
        marginBottom: 16
    },
    roomType: { color: '#10b981', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
    roomName: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
    branchName: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
    rateHighlight: { color: '#38bdf8', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
    section: { marginBottom: 16 },
    sectionTitle: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
    amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    amenityBadge: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8
    },
    amenityText: { color: '#cbd5e1', fontSize: 12 },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    slotBox: {
        width: '48%',
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 12,
        padding: 12
    },
    slotSelected: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
    slotDisabled: { opacity: 0.4 },
    slotTime: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
    slotTimeSelected: { color: '#10b981' },
    slotStatus: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
    policyBox: {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        borderRadius: 14,
        padding: 14,
        marginTop: 8
    },
    policyTitle: { color: '#fbbf24', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
    policyDesc: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0f172a',
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    totalLabel: { color: '#94a3b8', fontSize: 11 },
    totalValue: { color: '#10b981', fontSize: 18, fontWeight: 'bold' },
    btnCheckout: {
        backgroundColor: '#10b981',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12
    },
    btnCheckoutDisabled: { backgroundColor: '#334155' },
    btnCheckoutText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' }
});
