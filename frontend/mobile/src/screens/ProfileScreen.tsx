/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Member Profile & Wallet Screen (React Native)
 * FILE: frontend/mobile/src/screens/ProfileScreen.tsx
 * ==============================================================================
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Switch
} from 'react-native';

interface ProfileScreenProps {
    navigation: any;
    user?: any;
    onLogout?: () => void;
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation, user, onLogout }) => {
    const [walletBalance, setWalletBalance] = useState(user?.walletBalance || 5000000);
    const [biometricsEnabled, setBiometricsEnabled] = useState(true);

    const handleTopup = () => {
        Alert.alert(
            'Nạp Tiền Vào Ví Hội Viên',
            'Chọn số tiền muốn nạp qua Cổng thanh toán MoMo:',
            [
                { text: '500,000 đ', onPress: () => processTopup(500000) },
                { text: '1,000,000 đ', onPress: () => processTopup(1000000) },
                { text: '2,000,000 đ', onPress: () => processTopup(2000000) },
                { text: 'Đóng', style: 'cancel' }
            ]
        );
    };

    const processTopup = (amount: number) => {
        // Giả lập mở MoMo Deep-link và nạp thành công
        setTimeout(() => {
            setWalletBalance(prev => prev + amount);
            Alert.alert('Thành công 🎉', `Bạn đã nạp thành công ${formatVND(amount)} vào ví qua MoMo API v3.`);
        }, 500);
    };

    const handleLogout = () => {
        Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất tài khoản?', [
            { text: 'Hủy', style: 'cancel' },
            {
                text: 'Đăng xuất',
                style: 'destructive',
                onPress: () => {
                    if (onLogout) onLogout();
                    navigation?.navigate('Login');
                }
            }
        ]);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* User Header */}
            <View style={styles.userCard}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'H'}
                    </Text>
                </View>
                <Text style={styles.userName}>{user?.fullName || 'Nguyễn Văn Hội Viên'}</Text>
                <Text style={styles.userPhone}>{user?.phone || '0901234567'} • {user?.email || 'member@smartbooking.vn'}</Text>
                <View style={styles.tierBadge}>
                    <Text style={styles.tierText}>⭐ HỘI VIÊN DOANH NGHIỆP VIP</Text>
                </View>
            </View>

            {/* Prepaid Wallet Card */}
            <View style={styles.walletCard}>
                <View style={styles.walletHeader}>
                    <Text style={styles.walletTitle}>Ví Thành Viên Trả Trước</Text>
                    <Text style={styles.walletSub}>Trừ tiền tức thì • Chống Double-spending</Text>
                </View>
                <Text style={styles.walletBalance}>{formatVND(walletBalance)}</Text>
                <TouchableOpacity style={styles.topupBtn} onPress={handleTopup}>
                    <Text style={styles.topupBtnText}>➕ Nạp Tiền Qua Ví MoMo</Text>
                </TouchableOpacity>
            </View>

            {/* Quick Stats: Cancellation count */}
            <View style={styles.statsCard}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>8</Text>
                    <Text style={styles.statLabel}>Lượt đặt phòng</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#34d399' }]}>2/2</Text>
                    <Text style={styles.statLabel}>Lần hủy miễn phạt tháng này</Text>
                </View>
            </View>

            {/* Settings List */}
            <View style={styles.menuSection}>
                <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => navigation?.navigate('BookingHistory')}
                >
                    <Text style={styles.menuLabel}>📅 Lịch sử đặt phòng & Mã QR</Text>
                    <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>

                <View style={styles.menuRow}>
                    <Text style={styles.menuLabel}>🔒 Đăng nhập Vân tay / Face ID</Text>
                    <Switch
                        value={biometricsEnabled}
                        onValueChange={setBiometricsEnabled}
                        trackColor={{ false: '#334155', true: '#10b981' }}
                    />
                </View>

                <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => Alert.alert('Thông tin', 'Chính sách hoàn tiền phân tầng v1.4:\n• Trước >= 24h: Hoàn 100%\n• Từ 2h-24h: Hoàn 80%\n• Dưới 2h: Không hoàn tiền (0%)')}
                >
                    <Text style={styles.menuLabel}>ℹ️ Chính sách hủy phòng phân tầng</Text>
                    <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    onPress={handleLogout}
                >
                    <Text style={[styles.menuLabel, { color: '#f87171' }]}>🚪 Đăng xuất tài khoản</Text>
                    <Text style={[styles.menuArrow, { color: '#f87171' }]}>›</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    userCard: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 4,
    },
    userPhone: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 10,
    },
    tierBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    tierText: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: 'bold',
    },
    walletCard: {
        backgroundColor: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
    },
    walletHeader: {
        marginBottom: 8,
    },
    walletTitle: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    walletSub: {
        fontSize: 10,
        color: '#64748b',
    },
    walletBalance: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#34d399',
        marginVertical: 12,
    },
    topupBtn: {
        backgroundColor: '#10b981',
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    topupBtnText: {
        color: '#020617',
        fontSize: 12,
        fontWeight: 'bold',
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 20,
        padding: 16,
        marginBottom: 20,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#1e293b',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 10,
        color: '#94a3b8',
        textAlign: 'center',
    },
    menuSection: {
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 20,
        overflow: 'hidden',
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    menuLabel: {
        fontSize: 13,
        color: '#cbd5e1',
        fontWeight: '500',
    },
    menuArrow: {
        fontSize: 18,
        color: '#64748b',
    },
});

