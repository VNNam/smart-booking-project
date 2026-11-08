/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Customer Login Screen (React Native)
 * FILE: frontend/mobile/src/screens/auth/LoginScreen.tsx
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

interface LoginScreenProps {
    navigation: any;
    onLoginSuccess?: (user: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, onLoginSuccess }) => {
    const [identifier, setIdentifier] = useState('0901234567');
    const [password, setPassword] = useState('Member@123456');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!identifier.trim() || !password.trim()) {
            Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ Số điện thoại/Email và Mật khẩu.');
            return;
        }

        setIsLoading(true);

        try {
            // Giả lập gọi API POST /api/v1/auth/login
            setTimeout(() => {
                setIsLoading(false);
                const mockUser = {
                    id: 'usr-member-001',
                    phone: identifier,
                    email: identifier.includes('@') ? identifier : 'member@smartbooking.vn',
                    fullName: 'Nguyễn Văn Hội Viên',
                    role: 'MEMBER',
                    walletBalance: 5000000
                };
                if (onLoginSuccess) {
                    onLoginSuccess(mockUser);
                }
                Alert.alert('Thành công', 'Đăng nhập thành công! Chào mừng bạn quay trở lại.');
            }, 600);
        } catch (err: any) {
            setIsLoading(false);
            Alert.alert('Lỗi đăng nhập', err.message || 'Số điện thoại hoặc mật khẩu không chính xác.');
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoBadge}>
                        <Text style={styles.logoText}>SB</Text>
                    </View>
                    <Text style={styles.title}>Smart Meeting Room</Text>
                    <Text style={styles.subtitle}>Đặt phòng họp thông minh & tiện nghi tức thì</Text>
                </View>

                {/* Form */}
                <View style={styles.formCard}>
                    <Text style={styles.label}>Số điện thoại hoặc Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="0901234567 hoặc user@gmail.com"
                        placeholderTextColor="#64748b"
                        value={identifier}
                        onChangeText={setIdentifier}
                        autoCapitalize="none"
                    />

                    <Text style={styles.label}>Mật khẩu</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#64748b"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity
                        style={styles.forgotBtn}
                        onPress={() => navigation?.navigate('ForgotPassword')}
                    >
                        <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.loginBtn}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#020617" />
                        ) : (
                            <Text style={styles.loginBtnText}>ĐĂNG NHẬP</Text>
                        )}
                    </TouchableOpacity>

                    {/* Biometric shortcut */}
                    <TouchableOpacity
                        style={styles.biometricBtn}
                        onPress={handleLogin}
                    >
                        <Text style={styles.biometricText}>👆 Đăng nhập bằng Vân tay / Face ID</Text>
                    </TouchableOpacity>
                </View>

                {/* Register Link */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Chưa có tài khoản hội viên? </Text>
                    <TouchableOpacity onPress={() => navigation?.navigate('Register')}>
                        <Text style={styles.registerLink}>Đăng ký ngay</Text>
                    </TouchableOpacity>
                </View>
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
        marginBottom: 32,
    },
    logoBadge: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    logoText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
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
        marginBottom: 16,
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotText: {
        fontSize: 12,
        color: '#34d399',
        fontWeight: '500',
    },
    loginBtn: {
        backgroundColor: '#10b981',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    loginBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#020617',
    },
    biometricBtn: {
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
    },
    biometricText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: '#64748b',
    },
    registerLink: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#34d399',
    },
});
