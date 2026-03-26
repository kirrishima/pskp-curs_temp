import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { User as UserIcon, LogOut, ChevronDown } from 'lucide-react';
import useAppSelector from '@/hooks/useAppSelector';
import useAppDispatch from '@/hooks/useAppDispatch';
import { logout } from '@/store/slices/authSlice';
import api from '@/api/axiosInstance';

// Pages
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ProfilePage from '@/pages/ProfilePage';
import RoomSearchPage from '@/pages/RoomSearchPage';
import RoomDetailsPage from '@/pages/RoomDetailsPage';
import RoomEditorPage from '@/pages/RoomEditorPage';
import ServicesPage from '@/pages/ServicesPage';
import HotelsPage from '@/pages/HotelsPage';

// ─── Route guards ────────────────────────────────────────────────────────────

const ProtectedRoute = memo(function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
});

const AdminRoute = memo(function AdminRoute({ children }: { children: React.ReactElement }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role?.name !== 'admin') return <Navigate to="/" replace />;
  return children;
});

const GuestRoute = memo(function GuestRoute({ children }: { children: React.ReactElement }) {
  const user = useAppSelector((s) => s.auth.user);
  if (user) return <Navigate to="/rooms" replace />;
  return children;
});

// ─── User menu dropdown ──────────────────────────────────────────────────────

const UserMenu = memo(function UserMenu() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = useCallback(async () => {
    setOpen(false);
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore — clear locally
    }
    dispatch(logout());
    navigate('/', { replace: true });
  }, [dispatch, navigate, refreshToken]);

  if (!user) {
    return (
      <Link
        to="/login"
        className="text-sm text-text/60 hover:text-text transition-colors font-medium"
      >
        Войти
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-ui transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">
            {user.firstName?.[0]}
            {user.lastName?.[0]}
          </span>
        </div>
        <span className="text-sm font-medium text-text hidden sm:inline">
          {user.firstName} {user.lastName}
        </span>
        <ChevronDown
          size={16}
          className={[
            'text-text/40 transition-transform duration-200',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-slide-top">
          <div className="p-3 border-b border-gray-50">
            <p className="text-sm font-medium text-text">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-text/40 truncate">{user.email}</p>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/profile');
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-text/70 hover:bg-ui transition-colors"
            >
              <UserIcon size={16} />
              Профиль
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── App ─────────────────────────────────────────────────────────────────────

function AppContent() {
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role?.name === 'admin';

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50 h-16 flex items-center justify-between px-8 shadow-sm">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-semibold text-primary hover:opacity-80 transition-opacity">
            Hotel App
          </Link>
          <nav className="hidden sm:flex items-center gap-4">
            <Link to="/rooms" className="text-sm text-text/60 hover:text-text transition-colors">
              Номера
            </Link>
            {isAdmin && (
              <>
                <Link to="/admin/hotels" className="text-sm text-text/60 hover:text-text transition-colors">
                  Отели
                </Link>
                <Link to="/admin/services" className="text-sm text-text/60 hover:text-text transition-colors">
                  Услуги
                </Link>
              </>
            )}
          </nav>
        </div>
        <UserMenu />
      </header>

      <main className="flex-grow">
        <Routes>
          {/* Root → catalog */}
          <Route path="/" element={<Navigate to="/rooms" replace />} />

          {/* Public */}
          <Route path="/rooms" element={<RoomSearchPage />} />
          <Route path="/rooms/:roomNo" element={<RoomDetailsPage />} />

          {/* Guest only */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          {/* Protected */}
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin/rooms/new" element={<AdminRoute><RoomEditorPage /></AdminRoute>} />
          <Route path="/admin/rooms/:roomNo" element={<AdminRoute><RoomEditorPage /></AdminRoute>} />
          <Route path="/admin/hotels" element={<AdminRoute><HotelsPage /></AdminRoute>} />
          <Route path="/admin/services" element={<AdminRoute><ServicesPage /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="bg-white py-8 text-center text-text/50 text-sm border-t border-gray-100">
        <p>&copy; {new Date().getFullYear()} Hotel App. Все права защищены.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
