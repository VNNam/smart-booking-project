import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AuthManager, UserRole } from '../lib/auth';

export function withAuth<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    allowedRoles?: UserRole[]
) {
    return function ProtectedRoute(props: P) {
        const router = useRouter();
        const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
        const [isChecking, setIsChecking] = useState<boolean>(true);

        useEffect(() => {
            const token = AuthManager.getToken();
            const user = AuthManager.getUser();

            if (!token || !user) {
                router.replace('/login');
                return;
            }

            if (allowedRoles && allowedRoles.length > 0) {
                if (!allowedRoles.includes(user.role)) {
                    setIsAuthorized(false);
                    setIsChecking(false);
                    return;
                }
            }

            setIsAuthorized(true);
            setIsChecking(false);
        }, [router]);

        if (isChecking) {
            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-sans">
                    <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
                    <p className="text-sm">Đang xác thực quyền truy cập hệ thống...</p>
                </div>
            );
        }

        if (!isAuthorized) {
            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center text-3xl mb-4 font-bold">
                        🚫
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">403 - Quyền Truy Cập Bị Từ Chối</h1>
                    <p className="text-sm text-slate-400 max-w-md mb-6">
                        Tài khoản của bạn không được phân quyền để truy cập trang này. Vui lòng liên hệ Quản trị viên hệ thống để được cấp quyền.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium hover:bg-slate-700 transition-all text-white"
                    >
                        Quay lại Bảng điều khiển
                    </button>
                </div>
            );
        }

        return <WrappedComponent {...props} />;
    };
}

