import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { User } from "./types";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import MyBookings from "./pages/MyBookings";
import BookingDetails from "./pages/BookingDetails";
import Reviews from "./pages/Reviews";
import About from "./pages/About";
import RoomManager from "./pages/RoomManager";
import RoomDetails from "./pages/RoomDetails";
import BookingsManager from "./pages/BookingsManager";
import Checkout from "./pages/Checkout";
import AdminRoles from "./pages/AdminRoles";
import AdminHotels from "./pages/AdminHotels";
import AdminHotelDetails from "./pages/AdminHotelDetails";
import AdminStats from "./pages/AdminStats";
import Profile from "./pages/Profile";
import { getUserRole } from "./services/oracleApiService";
import AdminUsers from "./pages/AdminUsers";

function AppContent() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const storedUser = localStorage.getItem("session_user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Error parsing session user", error);
      return null;
    }
  });

  const location = useLocation();

  // Role Refresh Logic: Check role on every navigation
  useEffect(() => {
    const refreshRole = async () => {
      if (user && user.username) {
        try {
          const res = await getUserRole(user.username);
          if (res.status === "OK" && res.data && res.data.roleId !== undefined) {
            // If role in DB is different from local storage, update it
            if (res.data.roleId !== user.roleId) {
              console.log(`Role changed from ${user.roleId} to ${res.data.roleId}. Updating session.`);
              const updatedUser = { ...user, roleId: res.data.roleId };
              setUser(updatedUser);
              localStorage.setItem("session_user", JSON.stringify(updatedUser));
            }
          }
        } catch (err) {
          console.error("Failed to refresh user role", err);
        }
      }
    };

    refreshRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); 

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem("session_user", JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("session_user");
  };

  // Helper for Restricted Access (Unregistered users redirected to Login)
  const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  // Helper for Manager Routes Protection (Admins also have access)
  const ManagerRoute = ({ children }: { children: React.ReactElement }) => {
    if (!user || (user.roleId !== 1 && user.roleId !== 0)) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  // Helper for Admin Routes Protection
  const AdminRoute = ({ children }: { children: React.ReactElement }) => {
    if (!user || user.roleId !== 0) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="flex-grow">
        <Routes>
          {/* Public Routes - Only Login and Register */}
          <Route path="/login" element={<Auth type="login" onAuthSuccess={handleLogin} />} />
          <Route path="/register" element={<Auth type="register" onAuthSuccess={handleLogin} />} />

          {/* Protected Routes - All other pages require login */}
          <Route path="/" element={<ProtectedRoute><Home user={user} /></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
          <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile user={user} /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookings user={user!} /></ProtectedRoute>} />
          <Route path="/booking/:id" element={<ProtectedRoute><BookingDetails /></ProtectedRoute>} />
          <Route path="/room/:roomNo" element={<ProtectedRoute><RoomDetails user={user} /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          
          {/* Manager Routes */}
          <Route path="/manager/room/new" element={<ManagerRoute><RoomManager /></ManagerRoute>} />
          <Route path="/manager/room/:roomNo" element={<ManagerRoute><RoomManager /></ManagerRoute>} />
          <Route path="/manager/bookings" element={<ManagerRoute><BookingsManager /></ManagerRoute>} />

          {/* Admin Routes */}
          <Route path="/admin/roles" element={<AdminRoute><AdminRoles /></AdminRoute>} />
          <Route path="/admin/hotels" element={<AdminRoute><AdminHotels /></AdminRoute>} />
          <Route path="/admin/hotels/:hotelCode" element={<AdminRoute><AdminHotelDetails /></AdminRoute>} />
          <Route path="/admin/stats" element={<AdminRoute><AdminStats /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="bg-ui py-10 text-center text-text/60 text-sm">
        <div className="max-w-[1440px] mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} Moonglow Hotel. All rights reserved.</p>
          <p className="mt-2 text-xs">Running on Oracle AI Database 26ai Free Release 23.26.0.0.0</p>
        </div>
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