/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Customer Forgot Password Screen
 * FILE: frontend/mobile/src/screens/auth/ForgotPasswordScreen.tsx
 * ==============================================================================
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';

interface ForgotPasswordScreenProps {
    navigation: any;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSendReset = () => {
        if (!email.trim() || !email.includes('@')) {
            Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ email hợp lệ.');
            return;
        }

        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            setSent(true);
        }, 700);
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Khôi Phục Mật Khẩu</Text>
                    <Text style={styles.subtitle}>
                        Nhập email đăng ký tài khoản để nhận đường dẫn đặt lại mật khẩu bảo mật
                    </Text>
                </View>

                <View style={styles.formCard}>
                    {sent ? (
                        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                            <Text style={{ fontSize: 40, marginBottom: 12 }}>📩</Text>
                            <Text style={{ color: '#34d399', fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
                                Đã gửi hướng dẫn thành công!
                            </Text>
                            <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
                                Vui lòng kiểm tra hộp thư đến của {email} trong vòng 15 phút.
                            </Text>
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => navigation?.navigate('Login')}
                            >
                                <Text style={styles.actionBtnText}>VỀ MÀN HÌNH ĐĂNG NHẬP</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.label}>Địa chỉ Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="name@company.com"
                                placeholderTextColor="#64748b"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />

                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={handleSendReset}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#020617" />
                                ) : (
                                    <Text style={styles.actionBtnText}>GỬI ĐƯỜNG DẪN KHÔI PHỤC</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {!sent && (
                    <TouchableOpacity
                        style={{ alignItems: 'center' }}
                        onPress={() => navigation?.navigate('Login')}
                    >
                        <Text style={{ color: '#94a3b8', fontSize: 13 }}>← Quay lại Đăng nhập</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
    },
    formCard: {
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#cbd5e1',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#ffffff',
        marginBottom: 20,
    },
    actionBtn: {
        backgroundColor: '#10b981',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        width: '100%',
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#020617',
    },
});
