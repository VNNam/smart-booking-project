import React, { useState } from 'react';
import Head from 'next/head';
import AdminHeader from '../components/AdminHeader';
import CalendarGrid from '../components/CalendarGrid';
import { withAuth } from '../components/withAuth';

function AdminDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Head>
        <title>Smart Meeting Room - Admin Dashboard</title>
        <meta name="description" content="Quản trị đặt phòng họp thông minh" />
      </Head>

      <AdminHeader />

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Lịch Master Đặt Phòng Theo Thời Gian Thực</h2>
            <p className="text-xs text-slate-400">Theo dõi trạng thái phòng, khóa giữ chỗ 10 phút và hủy phòng hoàn tiền Two-Man Rule</p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="datePicker" className="text-xs text-slate-400 font-medium">Chọn ngày:</label>
            <input
              id="datePicker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Calendar Grid Component */}
        <CalendarGrid date={selectedDate} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-600">
        Smart Booking Platform &copy; 2026 - UAT Release v1.4.1 (Next.js 14 + Tailwind CSS)
      </footer>
    </div>
  );
}

export default withAuth(AdminDashboardPage);
