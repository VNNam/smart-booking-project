/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Tiered Cancellation & Refund Screen
 * FILE: frontend/mobile/src/screens/CancelBookingScreen.tsx
 * MÔ TẢ: Màn hình hủy phòng họp và hoàn tiền phân tầng trên Mobile App theo BRD v1.4:
 *       - Mốc >= 24h: Hoàn 100%
 *       - Mốc 2h - 24h: Hoàn 80%, Phạt 20%
 *       - Mốc < 2h: Không hoàn tiền (Phạt 100%)
 *       - Bộ đếm giới hạn tối đa 2 lần hủy miễn phạt/tháng (Lần thứ 3 phạt thêm 30%)
 * ==============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ScrollView,
    Alert
} from 'react-native';
import { MobileBooking } from './BookingHistoryScreen';

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export default function CancelBookingScreen({ route, navigation }: any) {
    const booking: MobileBooking = route?.params?.booking || {
        id: 'bkg-101',
        bookingCode: 'BKG-202610-8812',
        roomName: 'Executive Boardroom Tokyo',
        branchName: 'Chi nhánh Cầu Giấy',
        startTime: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString(),
        totalAmount: 1300000,
        status: 'CONFIRMED',
        monthlyCancelCount: 1
    };

    const [reason, setReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancellationDone, setCancellationDone] = useState(false);

    // Tính toán tỷ lệ hoàn tiền & phí phạt theo BRD v1.4
    const calculation = useMemo(() => {
        const now = Date.now();
        const start = new Date(booking.startTime).getTime();
        const hoursUntilMeeting = (start - now) / (1000 * 60 * 60);

        let refundPct = 0;
        let policyLabel = '';

        if (hoursUntilMeeting >= 24) {
            refundPct = 100;
            policyLabel = 'Hủy trước ≥ 24 giờ: Hoàn 100%';
        } else if (hoursUntilMeeting >= 2) {
            refundPct = 80;
            policyLabel = 'Hủy trước 2h - 24h: Hoàn 80% (Phạt 20%)';
        } else {
            refundPct = 0;
            policyLabel = 'Hủy sát giờ < 2h: Không hoàn tiền (Phạt 100%)';
        }

        // Kiểm tra số lần hủy trong tháng
        const monthlyCancels = booking.monthlyCancelCount || 0;
        let isCapApplied = false;
        if (monthlyCancels >= 2 && refundPct > 0) {
            refundPct = Math.min(refundPct, 70);
            isCapApplied = true;
        }

        const refundAmt = Math.round((booking.totalAmount * refundPct) / 100);
        const penaltyFee = booking.totalAmount - refundAmt;

        return {
            hoursUntilMeeting: Math.max(0, hoursUntilMeeting),
            refundPct,
            penaltyFee,
            refundAmt,
            policyLabel,
            monthlyCancels,
            isCapApplied
        };
    }, [booking]);

    const handleConfirmCancel = async () => {
        if (!reason.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do hủy phòng họp.');
            return;
        }

        Alert.alert(
            'Xác nhận hủy đặt phòng',
            `Bạn có chắc chắn muốn hủy đơn ${booking.bookingCode}? Số tiền hoàn dự kiến: ${formatVND(calculation.refundAmt)}.`,
            [
                { text: 'Suy nghĩ lại', style: 'cancel' },
                {
                    text: 'Đồng ý hủy',
                    style: 'destructive',
                    onPress: async () => {
                        setIsCancelling(true);
                        try {
                            // Giả lập dispatch API cancel
                            await new Promise((resolve) => setTimeout(resolve, 800));
                            setCancellationDone(true);
                        } catch (err) {
                            Alert.alert('Lỗi', 'Không thể hủy đơn đặt phòng.');
                        } finally {
                            setIsCancelling(false);
                        }
                    }
                }
            ]
        );
    };

    if (cancellationDone) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.container, styles.doneContainer]}>
                    <Text style={styles.doneIcon}>✓</Text>
                    <Text style={styles.doneTitle}>Hủy Đặt Phòng Thành Công</Text>
                    <Text style={styles.doneDesc}>
                        Đơn {booking.bookingCode} đã được hủy. Số tiền {formatVND(calculation.refundAmt)} đã được cộng hoàn trả vào ví thành viên / tài khoản thanh toán ban đầu của bạn.
                    </Text>
                    <TouchableOpacity
                        style={styles.btnDone}
                        onPress={() => navigation.navigate('BookingHistory')}
                    >
                        <Text style={styles.btnDoneText}>Quay Về Lịch Sử Đặt Phòng</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#020617" />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Hủy Đơn Đặt Phòng</Text>
                <Text style={styles.subtitle}>Chính sách hoàn tiền phân tầng tự động (BRD v1.4)</Text>

                {/* Thông tin đơn */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{booking.roomName}</Text>
                    <Text style={styles.cardCode}>Mã đơn: {booking.bookingCode}</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Tổng tiền đã trả:</Text>
                        <Text style={styles.valBold}>{formatVND(booking.totalAmount)}</Text>
                    </View>
                </View>

                {/* Dự tính hoàn tiền */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Dự Tính Tài Chính Khi Hủy</Text>
                    <View style={styles.tierBadge}>
                        <Text style={styles.tierBadgeText}>{calculation.policyLabel}</Text>
                    </View>

                    {calculation.isCapApplied && (
                        <View style={styles.warningBox}>
                            <Text style={styles.warningText}>
                                ⚠️ Bạn đã sử dụng hết 2 lần hủy miễn phạt trong tháng ({calculation.monthlyCancels}/2). Áp dụng mức phạt phụ trội 30% theo quy định chống găm phòng.
                            </Text>
                        </View>
                    )}

                    <View style={styles.row}>
                        <Text style={styles.label}>Tỷ lệ hoàn tiền:</Text>
                        <Text style={styles.valGreen}>{calculation.refundPct}%</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Phí phạt hủy phòng:</Text>
                        <Text style={styles.valRed}>{formatVND(calculation.penaltyFee)}</Text>
                    </View>
                    <View style={[styles.row, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Tiền hoàn trả bạn nhận:</Text>
                        <Text style={styles.totalVal}>{formatVND(calculation.refundAmt)}</Text>
                    </View>
                </View>

                {/* Nhập lý do hủy */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Lý Do Hủy Phòng *</Text>
                    <TextInput
                        testID="cancel-reason-input"
                        placeholder="Nhập lý do (ví dụ: Khách dời lịch công tác, đổi phòng họp khác...)"
                        placeholderTextColor="#64748b"
                        value={reason}
                        onChangeText={setReason}
                        style={styles.reasonInput}
                        multiline
                    />
                </View>

                {/* Nút Hủy */}
                <TouchableOpacity
                    testID="btn-confirm-cancel-mobile"
                    disabled={isCancelling}
                    onPress={handleConfirmCancel}
                    style={styles.btnSubmitCancel}
                >
                    <Text style={styles.btnSubmitCancelText}>
                        {isCancelling ? 'Đang Xử Lý Hủy...' : 'Xác Nhận Hủy Đặt Phòng'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#020617' },
    container: { flex: 1, backgroundColor: '#020617' },
    content: { padding: 16, paddingBottom: 40 },
    title: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
    subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 16 },
    card: { backgroundColor: '#0f172a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 14 },
    cardTitle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
    cardCode: { color: '#38bdf8', fontSize: 11, fontFamily: 'monospace', marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
    label: { color: '#94a3b8', fontSize: 12 },
    valBold: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
    valGreen: { color: '#10b981', fontSize: 13, fontWeight: 'bold' },
    valRed: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },
    tierBadge: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', padding: 8, borderRadius: 8, marginBottom: 10 },
    tierBadgeText: { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
    warningBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', padding: 10, borderRadius: 10, marginBottom: 10 },
    warningText: { color: '#fca5a5', fontSize: 11, lineHeight: 16 },
    totalRow: { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 10, marginTop: 6 },
    totalLabel: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
    totalVal: { color: '#10b981', fontSize: 16, fontWeight: 'bold' },
    reasonInput: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, padding: 12, color: '#f8fafc', fontSize: 12, minHeight: 80, textAlignVertical: 'top' },
    btnSubmitCancel: { backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 10 },
    btnSubmitCancelText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
    doneContainer: { justifyContent: 'center', alignItems: 'center', padding: 24 },
    doneIcon: { fontSize: 48, color: '#10b981', marginBottom: 12 },
    doneTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    doneDesc: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    btnDone: { backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    btnDoneText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' }
});
