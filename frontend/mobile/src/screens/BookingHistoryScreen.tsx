/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Booking History & QR Check-in Screen
 * FILE: frontend/mobile/src/screens/BookingHistoryScreen.tsx
 * MÔ TẢ: Màn hình lịch sử đặt phòng & hiển thị mã QR Check-in bảo mật cho Lễ tân quét
 *       Hỗ trợ tabs (Sắp tới / Đã xong / Đã hủy) và liên kết sang CancelBookingScreen.
 * ==============================================================================
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Modal
} from 'react-native';

export interface MobileBooking {
    id: string;
    bookingCode: string;
    roomName: string;
    branchName: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
    totalAmount: number;
    status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED_REFUNDED';
    qrCodeToken: string;
    monthlyCancelCount?: number;
}

const MOCK_BOOKINGS: MobileBooking[] = [
    {
        id: 'bkg-101',
        bookingCode: 'BKG-202610-8812',
        roomName: 'Executive Boardroom Tokyo',
        branchName: 'Chi nhánh Cầu Giấy (Tầng 8)',
        startTime: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(), // > 24h
        endTime: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString(),
        totalAmount: 1300000,
        status: 'CONFIRMED',
        qrCodeToken: 'QR-AUTH-SECURE-8812-BKG',
        monthlyCancelCount: 1
    },
    {
        id: 'bkg-102',
        bookingCode: 'BKG-202610-7744',
        roomName: 'Meeting Room Alpha',
        branchName: 'Chi nhánh Quận 1 (Tầng 12)',
        startTime: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(), // 10h (2h-24h)
        endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        totalAmount: 700000,
        status: 'CONFIRMED',
        qrCodeToken: 'QR-AUTH-SECURE-7744-BKG',
        monthlyCancelCount: 1
    },
    {
        id: 'bkg-103',
        bookingCode: 'BKG-202610-5511',
        roomName: 'Grand Boardroom New York',
        branchName: 'Chi nhánh Quận 1 (Tầng 15)',
        startTime: '2026-10-01T09:00:00Z',
        endTime: '2026-10-01T11:00:00Z',
        totalAmount: 2400000,
        status: 'COMPLETED',
        qrCodeToken: 'QR-AUTH-EXPIRED'
    }
];

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    });
}

export default function BookingHistoryScreen({ navigation }: any) {
    const [selectedTab, setSelectedTab] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
    const [qrModalBooking, setQrModalBooking] = useState<MobileBooking | null>(null);

    const filteredBookings = MOCK_BOOKINGS.filter((b) => {
        if (selectedTab === 'UPCOMING') return b.status === 'CONFIRMED';
        return b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'EXPIRED_REFUNDED';
    });

    const renderItem = ({ item }: { item: MobileBooking }) => {
        const isUpcoming = item.status === 'CONFIRMED';

        return (
            <View style={styles.bookingCard}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.bookingCode}>{item.bookingCode}</Text>
                        <Text style={styles.roomName}>{item.roomName}</Text>
                        <Text style={styles.branchName}>{item.branchName}</Text>
                    </View>
                    <View style={[styles.statusBadge, isUpcoming ? styles.statusConfirmed : styles.statusCompleted]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Thời gian:</Text>
                    <Text style={styles.timeValue}>{formatTime(item.startTime)} - {formatTime(item.endTime)}</Text>
                </View>

                <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Tổng tiền:</Text>
                    <Text style={styles.priceValue}>{formatVND(item.totalAmount)}</Text>
                </View>

                {isUpcoming && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            testID={`btn-show-qr-${item.id}`}
                            style={styles.btnQr}
                            onPress={() => setQrModalBooking(item)}
                        >
                            <Text style={styles.btnQrText}>📱 Mã QR Check-in</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            testID={`btn-cancel-nav-${item.id}`}
                            style={styles.btnCancel}
                            onPress={() => navigation.navigate('CancelBooking', { booking: item })}
                        >
                            <Text style={styles.btnCancelText}>Hủy Lịch</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#020617" />
            <View style={styles.container}>
                <Text style={styles.title}>Lịch Sử Đặt Phòng</Text>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        onPress={() => setSelectedTab('UPCOMING')}
                        style={[styles.tabBtn, selectedTab === 'UPCOMING' && styles.tabBtnActive]}
                    >
                        <Text style={[styles.tabText, selectedTab === 'UPCOMING' && styles.tabTextActive]}>
                            Sắp Tới (Upcoming)
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setSelectedTab('PAST')}
                        style={[styles.tabBtn, selectedTab === 'PAST' && styles.tabBtnActive]}
                    >
                        <Text style={[styles.tabText, selectedTab === 'PAST' && styles.tabTextActive]}>
                            Lịch Sử (Past)
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* List */}
                <FlatList
                    data={filteredBookings}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />

                {/* QR CHECK-IN MODAL */}
                {qrModalBooking && (
                    <Modal visible={true} transparent={true} animationType="fade">
                        <View style={styles.modalBackdrop}>
                            <View style={styles.modalContent}>
                                <Text style={styles.qrTitle}>Mã QR Check-in Phòng Họp</Text>
                                <Text style={styles.qrSubtitle}>{qrModalBooking.roomName}</Text>

                                {/* Mock QR Code Box */}
                                <View style={styles.qrCodeBox}>
                                    <Text style={styles.qrMockText}>[ ⬛ ⬛ ⬛ ⬛ ⬛ ]</Text>
                                    <Text style={styles.qrMockText}>[ ⬛ 🔲 🔲 🔲 ⬛ ]</Text>
                                    <Text style={styles.qrMockText}>[ ⬛ 🔲 ⬛ 🔲 ⬛ ]</Text>
                                    <Text style={styles.qrMockText}>[ ⬛ 🔲 🔲 🔲 ⬛ ]</Text>
                                    <Text style={styles.qrMockText}>[ ⬛ ⬛ ⬛ ⬛ ⬛ ]</Text>
                                    <Text style={styles.qrTokenText}>{qrModalBooking.qrCodeToken}</Text>
                                </View>

                                <Text style={styles.qrInstruction}>
                                    Xuất trình mã QR này tại quầy Lễ tân hoặc trước cửa phòng họp để mở khóa cửa.
                                </Text>

                                <TouchableOpacity
                                    style={styles.btnCloseQr}
                                    onPress={() => setQrModalBooking(null)}
                                >
                                    <Text style={styles.btnCloseQrText}>Đóng</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#020617' },
    container: { flex: 1, backgroundColor: '#020617', paddingHorizontal: 16 },
    title: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold', marginVertical: 12 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 12, padding: 4, marginBottom: 16 },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    tabBtnActive: { backgroundColor: '#1e293b' },
    tabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: '#f8fafc' },
    listContent: { paddingBottom: 24 },
    bookingCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    bookingCode: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
    roomName: { color: '#f8fafc', fontSize: 15, fontWeight: 'bold', marginTop: 2 },
    branchName: { color: '#64748b', fontSize: 11, marginTop: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusConfirmed: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: '#10b981' },
    statusCompleted: { backgroundColor: '#1e293b' },
    statusText: { color: '#34d399', fontSize: 10, fontWeight: 'bold' },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    timeLabel: { color: '#94a3b8', fontSize: 12 },
    timeValue: { color: '#cbd5e1', fontSize: 12, fontWeight: '500' },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 8 },
    priceLabel: { color: '#94a3b8', fontSize: 12 },
    priceValue: { color: '#10b981', fontSize: 14, fontWeight: 'bold' },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    btnQr: { flex: 1, backgroundColor: 'rgba(56, 189, 248, 0.15)', borderWidth: 1, borderColor: '#38bdf8', paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    btnQrText: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
    btnCancel: { paddingHorizontal: 16, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#ef4444', paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    btnCancelText: { color: '#f87171', fontSize: 12, fontWeight: 'bold' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#0f172a', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
    qrTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
    qrSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 4, marginBottom: 16 },
    qrCodeBox: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, alignItems: 'center', marginVertical: 8 },
    qrMockText: { fontFamily: 'monospace', fontSize: 18, color: '#000000', letterSpacing: 2 },
    qrTokenText: { fontFamily: 'monospace', fontSize: 9, color: '#475569', marginTop: 8 },
    qrInstruction: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 18, lineHeight: 16 },
    btnCloseQr: { backgroundColor: '#334155', width: '100%', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    btnCloseQrText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' }
});
