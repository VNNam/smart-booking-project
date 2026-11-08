/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Root Navigation & App Entry Point (UAT Ready)
 * FILE: frontend/mobile/App.tsx
 * ==============================================================================
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';

// Import các màn hình Auth
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen';

// Import các màn hình Nghiệp vụ Đặt phòng
import RoomSearchScreen from './src/screens/RoomSearchScreen';
import RoomDetailScreen from './src/screens/RoomDetailScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import BookingHistoryScreen from './src/screens/BookingHistoryScreen';
import CancelBookingScreen from './src/screens/CancelBookingScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('Login');
  const [screenParams, setScreenParams] = useState<any>({});
  const [history, setHistory] = useState<string[]>(['Login']);

  // Triển khai navigation object tương thích chuẩn React Navigation
  const navigation = {
    navigate: (screenName: string, params?: any) => {
      setScreenParams(params || {});
      setCurrentScreen(screenName);
      setHistory(prev => [...prev, screenName]);
    },
    goBack: () => {
      if (history.length > 1) {
        const newHistory = [...history];
        newHistory.pop();
        const prevScreen = newHistory[newHistory.length - 1];
        setHistory(newHistory);
        setCurrentScreen(prevScreen);
      }
    },
  };

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    navigation.navigate('RoomSearch');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    navigation.navigate('Login');
  };

  // Render màn hình theo State
  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'Login':
        return (
          <LoginScreen
            navigation={navigation}
            onLoginSuccess={handleLoginSuccess}
          />
        );
      case 'Register':
        return <RegisterScreen navigation={navigation} />;
      case 'ForgotPassword':
        return <ForgotPasswordScreen navigation={navigation} />;
      case 'RoomSearch':
        return <RoomSearchScreen navigation={navigation} />;
      case 'RoomDetail':
        return (
          <RoomDetailScreen
            navigation={navigation}
            route={{ params: screenParams }}
          />
        );
      case 'Checkout':
        return (
          <CheckoutScreen
            navigation={navigation}
            route={{ params: screenParams }}
          />
        );
      case 'BookingHistory':
        return <BookingHistoryScreen navigation={navigation} />;
      case 'CancelBooking':
        return (
          <CancelBookingScreen
            navigation={navigation}
            route={{ params: screenParams }}
          />
        );
      case 'Profile':
        return (
          <ProfileScreen
            navigation={navigation}
            user={currentUser}
            onLogout={handleLogout}
          />
        );
      default:
        return <RoomSearchScreen navigation={navigation} />;
    }
  };

  const isAuthScreen = ['Login', 'Register', 'ForgotPassword'].includes(currentScreen);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />

      {/* Vùng hiển thị màn hình chính */}
      <View style={styles.content}>{renderCurrentScreen()}</View>

      {/* Thanh Bottom Tab Navigator chỉ hiển thị khi đã đăng nhập */}
      {!isAuthScreen && (
        <View style={styles.bottomTab}>
          <TouchableOpacity
            style={[
              styles.tabItem,
              currentScreen === 'RoomSearch' && styles.tabItemActive,
            ]}
            onPress={() => navigation.navigate('RoomSearch')}
          >
            <Text style={styles.tabIcon}>🏢</Text>
            <Text
              style={[
                styles.tabLabel,
                currentScreen === 'RoomSearch' && styles.tabLabelActive,
              ]}
            >
              Tìm phòng
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              currentScreen === 'BookingHistory' && styles.tabItemActive,
            ]}
            onPress={() => navigation.navigate('BookingHistory')}
          >
            <Text style={styles.tabIcon}>📅</Text>
            <Text
              style={[
                styles.tabLabel,
                currentScreen === 'BookingHistory' && styles.tabLabelActive,
              ]}
            >
              Lịch đặt
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              currentScreen === 'Profile' && styles.tabItemActive,
            ]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.tabIcon}>👤</Text>
            <Text
              style={[
                styles.tabLabel,
                currentScreen === 'Profile' && styles.tabLabelActive,
              ]}
            >
              Tài khoản
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
  },
  bottomTab: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 12 : 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#eff6ff',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
});

