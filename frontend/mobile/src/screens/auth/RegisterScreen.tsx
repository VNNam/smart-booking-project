/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Customer Registration Screen (with OTP Step)
 * FILE: frontend/mobile/src/screens/auth/RegisterScreen.tsx
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
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

interface RegisterScreenProps {
    navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
    const [step, setStep] = useState<1 | 2>(1); // 1: Nhập thông tin, 2: Xác thực OTP
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [timer, setTimer] = useState(120);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let interval: any = null;
        if (step === 2 && timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        } else if (timer === 0 && interval) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const handleSendOtp = () => {
        if (!fullName.trim() || !phone.trim() || !email.trim() || !password.trim()) {
            Alert.alert('Lỗi', 'Vui lòng điền đầy đủ tất cả các trường.');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Lỗi', 'Mật khẩu phải có tối thiểu 6 ký tự.');
            return;
        }

        setIsLoading(true);
        // Giả lập gửi OTP qua SMS / Email
        setTimeout(() => {
            setIsLoading(false);
            setStep(2);
            setTimer(120);
            Alert.alert('Mã OTP đã gửi', `Mã xác thực 6 chữ số đã được gửi tới ${phone} (Mã test UAT: 123456)`);
        }, 600);
    };

    const handleVerifyAndRegister = () => {
        if (!otpCode || otpCode.length < 6) {
            Alert.alert('Lỗi', 'Vui lòng nhập đủ 6 chữ số OTP.');
            return;
        }

        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            Alert.alert(
                'Chúc mừng! 🎉',
                'Tài khoản hội viên của bạn đã được khởi tạo thành công cùng ví trả trước!',
                [{ text: 'Đăng nhập ngay', onPress: () => navigation?.navigate('Login') }]
            );
        }, 800);
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Đăng Ký Hội Viên Mới</Text>
                    <Text style={styles.subtitle}>
                        {step === 1
                            ? 'Tận hưởng quyền lợi giữ chỗ và ưu đãi phòng họp'
                            : `Nhập mã xác thực đã gửi tới số ${phone}`}
                    </Text>
                </View>

                {step === 1 ? (
                    <View style={styles.formCard}>
                        <Text style={styles.label}>Họ và tên</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nguyễn Văn A"
                            placeholderTextColor="#64748b"
                            value={fullName}
                            onChangeText={setFullName}
                        />

                        <Text style={styles.label}>Số điện thoại</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0912345678"
                            placeholderTextColor="#64748b"
                            keyboardType="phone-pad"
                            value={phone}
                            onChangeText={setPhone}
                        />

                        <Text style={styles.label}>Địa chỉ Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="user@company.com"
                            placeholderTextColor="#64748b"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />

                        <Text style={styles.label}>Mật khẩu</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Tối thiểu 6 ký tự"
                            placeholderTextColor="#64748b"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />

                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={handleSendOtp}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#020617" />
                            ) : (
                                <Text style={styles.actionBtnText}>TIẾP TỤC & NHẬN MÃ OTP</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.formCard}>
                        <Text style={styles.label}>Mã xác thực OTP (6 chữ số)</Text>
                        <TextInput
                            style={[styles.input, styles.otpInput]}
                            placeholder="123456"
                            placeholderTextColor="#64748b"
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otpCode}
                            onChangeText={setOtpCode}
                        />

                        <Text style={styles.timerText}>
                            Mã có hiệu lực trong: <Text style={styles.timerHighlight}>{timer}s</Text>
                        </Text>

                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={handleVerifyAndRegister}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#020617" />
                            ) : (
                                <Text style={styles.actionBtnText}>XÁC THỰC & HOÀN TẤT ĐĂNG KÝ</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.resendBtn}
                            onPress={() => {
                                setTimer(120);
                                Alert.alert('Đã gửi lại', 'Mã OTP mới đã được gửi.');
                            }}
                            disabled={timer > 0}
                        >
                            <Text style={[styles.resendText, timer > 0 && { color: '#64748b' }]}>
                                Gửi lại mã OTP
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ marginTop: 16, alignItems: 'center' }}
                            onPress={() => setStep(1)}
                        >
                            <Text style={{ color: '#94a3b8', fontSize: 12 }}>← Chỉnh sửa thông tin</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Đã có tài khoản? </Text>
                    <TouchableOpacity onPress={() => navigation?.navigate('Login')}>
                        <Text style={styles.loginLink}>Đăng nhập</Text>
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
        marginBottom: 16,
    },
    otpInput: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 8,
        color: '#34d399',
    },
    timerText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 20,
    },
    timerHighlight: {
        color: '#fbbf24',
        fontWeight: 'bold',
    },
    actionBtn: {
        backgroundColor: '#10b981',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#020617',
    },
    resendBtn: {
        alignItems: 'center',
        marginTop: 16,
    },
    resendText: {
        fontSize: 12,
        color: '#34d399',
        fontWeight: '600',
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
    loginLink: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#34d399',
    },
});
