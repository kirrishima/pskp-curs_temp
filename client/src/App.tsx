import React, { memo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useAppSelector from '@/hooks/useAppSelector';

// ─── Page placeholder ─────────────────────────────────────────────────────────

const PlaceholderPage = memo(function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-text/50 text-lg">{title}</p>
    </div>
  );
});

// ─── Route guards ────────────────────────────────────────────────────────────

const ProtectedRoute = memo(function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
});

// ─── App ─────────────────────────────────────────────────────────────────────

function AppContent() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Navbar placeholder — replace with your Navbar component */}
      <header className="w-full bg-background border-b border-text/10 sticky top-0 z-50 h-16 flex items-center px-8">
        <span className="text-xl font-semibold text-primary">Client App</span>
      </header>

      <main className="flex-grow">
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<PlaceholderPage title="Страница входа" />} />
          <Route path="/register" element={<PlaceholderPage title="Страница регистрации" />} />

          {/* Protected */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <PlaceholderPage title="Главная страница" />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="bg-ui py-8 text-center text-text/50 text-sm border-t border-gray-200">
        <p>&copy; {new Date().getFullYear()} Client App. Все права защищены.</p>
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
