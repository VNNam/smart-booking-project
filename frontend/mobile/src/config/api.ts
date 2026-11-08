/**
 * CẤU HÌNH KẾT NỐI API CHO UAT (MOBILE APP)
 */
export const API_CONFIG = {
  // Thay thế URL này bằng Render URL khi deploy cloud, hoặc IP LAN máy chủ khi test cục bộ
  // Ví dụ test LAN: 'http://192.168.1.100:3000/api/v1'
  // Ví dụ test Android Emulator: 'http://10.0.2.2:3000/api/v1'
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'https://smart-booking-api.onrender.com/api/v1',
  TIMEOUT_MS: 15000,
  MOMO_APP_DEEPLINK: 'momo://app',
};

