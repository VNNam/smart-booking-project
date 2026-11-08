import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import CalendarGrid from '../components/CalendarGrid';

export default function AdminDashboardPage() {
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

      {/* Main Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 text-lg">
            SB
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Smart Meeting Room - Web Admin</h1>
            <p className="text-xs text-slate-400">Hệ thống Điều hành Phòng họp Thông minh v1.4 Hardened</p>
          </div>
        </div>

        {/* Quick Navigation Links */}
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-semibold hover:bg-emerald-500/30 transition-all"
          >
            📅 Master Calendar
          </Link>
          <Link
            href="/cash-booking"
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium hover:bg-slate-700 hover:text-white transition-all"
          >
            💵 Đặt phòng Tiền mặt
          </Link>
          <Link
            href="/corporate-debts"
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium hover:bg-slate-700 hover:text-white transition-all"
          >
            🏢 Hạn mức Công nợ
          </Link>
        </nav>
      </header>

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

