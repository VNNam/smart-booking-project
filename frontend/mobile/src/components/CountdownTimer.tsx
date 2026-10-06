/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - 10-Minute Lock TTL Countdown Timer Component
 * FILE: frontend/mobile/src/components/CountdownTimer.tsx
 * MÔ TẢ: Widget đồng hồ đếm ngược giữ chỗ trực tuyến 10 phút (TTL 600s) theo BRD v1.4.
 *       Tích hợp thuật toán bù trừ độ lệch đồng hồ (Client Clock Skew Compensation)
 *       Tự động đổi màu cảnh báo (Đỏ < 2 phút) và kích hoạt callback onExpire khi hết giờ.
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CountdownTimerProps {
    lockExpiresAt: string; // ISO 8601 string from backend Redis lock
    serverTime?: string;   // ISO 8601 string from backend response
    onExpire?: () => void;
}

export default function CountdownTimer({ lockExpiresAt, serverTime, onExpire }: CountdownTimerProps) {
    // Tính toán độ lệch giờ (delta) giữa máy chủ và thiết bị client
    const clockSkewMs = React.useMemo(() => {
        if (!serverTime) return 0;
        return new Date(serverTime).getTime() - Date.now();
    }, [serverTime]);

    const calculateRemainingSeconds = (): number => {
        const expireMs = new Date(lockExpiresAt).getTime();
        const adjustedNowMs = Date.now() + clockSkewMs;
        const diffMs = expireMs - adjustedNowMs;
        return Math.max(0, Math.floor(diffMs / 1000));
    };

    const [remainingSeconds, setRemainingSeconds] = useState<number>(calculateRemainingSeconds);

    useEffect(() => {
        const interval = setInterval(() => {
            const nextRemaining = calculateRemainingSeconds();
            setRemainingSeconds(nextRemaining);

            if (nextRemaining <= 0) {
                clearInterval(interval);
                if (onExpire) {
                    onExpire();
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [lockExpiresAt, clockSkewMs]);

    const formatTime = (totalSeconds: number): string => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const isUrgent = remainingSeconds > 0 && remainingSeconds <= 120; // Dưới 2 phút
    const isExpired = remainingSeconds <= 0;

    return (
        <View style={[styles.container, isUrgent && styles.containerUrgent, isExpired && styles.containerExpired]}>
            <Text style={styles.icon}>{isExpired ? '⌛' : isUrgent ? '⚠️' : '🔒'}</Text>
            <View style={styles.textGroup}>
                <Text style={[styles.title, isUrgent && styles.titleUrgent, isExpired && styles.titleExpired]}>
                    {isExpired ? 'ĐÃ HẾT HẠN GIỮ CHỖ' : 'THỜI GIAN GIỮ CHỖ CÒN LẠI:'}
                </Text>
                <Text
                    testID="countdown-display"
                    style={[styles.timerValue, isUrgent && styles.timerValueUrgent, isExpired && styles.timerValueExpired]}
                >
                    {isExpired ? '00:00' : formatTime(remainingSeconds)}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginVertical: 12
    },
    containerUrgent: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: '#ef4444'
    },
    containerExpired: {
        backgroundColor: 'rgba(100, 116, 139, 0.2)',
        borderColor: '#475569'
    },
    icon: {
        fontSize: 20,
        marginRight: 10
    },
    textGroup: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    title: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.5
    },
    titleUrgent: {
        color: '#f87171'
    },
    titleExpired: {
        color: '#94a3b8'
    },
    timerValue: {
        color: '#f59e0b',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'monospace'
    },
    timerValueUrgent: {
        color: '#ef4444'
    },
    timerValueExpired: {
        color: '#64748b'
    }
});
