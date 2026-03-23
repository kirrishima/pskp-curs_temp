import React from "react";
import { User as UserIcon, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { User } from "../types";

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-background border-b border-text/10 sticky top-0 z-50">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="text-3xl font-normal tracking-wide text-text font-serif">
          Moonglow
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-text font-medium hover:text-primary transition-colors">
            Главная
          </Link>
          <Link to="/about" className="text-text font-medium hover:text-primary transition-colors">
            О нас
          </Link>
          <Link to="/reviews" className="text-text font-medium hover:text-primary transition-colors">
            Отзывы
          </Link>
          {user && (
            <>
              {user.roleId === 1 && (
                <Link to="/manager/bookings" className="text-text font-medium hover:text-primary transition-colors">
                  Бронирования
                </Link>
              )}
              {user.roleId === 0 && (
                <>
                  <Link to="/manager/bookings" className="text-text font-medium hover:text-primary transition-colors">
                    Бронирования
                  </Link>
                  <Link to="/admin/hotels" className="text-text font-medium hover:text-primary transition-colors">
                    Отели
                  </Link>
                  <Link to="/admin/users" className="text-text font-medium hover:text-primary transition-colors">
                    Пользователи
                  </Link>
                  <Link to="/admin/roles" className="text-text font-medium hover:text-primary transition-colors">
                    Роли
                  </Link>
                  <Link to="/admin/stats" className="text-text font-medium hover:text-primary transition-colors">
                    Статистика
                  </Link>
                </>
              )}
              {user.roleId !== 1 && user.roleId !== 0 && (
                <Link to="/my-bookings" className="text-text font-medium hover:text-primary transition-colors">
                  Мои бронирования
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="flex items-center gap-3 hover:opacity-70 transition-opacity"
                title="Профиль"
              >
                <span className="text-sm font-medium hidden sm:block">{user.fullName}</span>
                <div className="w-10 h-10 rounded-full bg-ui overflow-hidden flex items-center justify-center border border-gray-200">
                  <UserIcon size={20} className="text-text/70" />
                </div>
              </Link>
              <button
                onClick={() => {
                  onLogout();
                  navigate("/");
                }}
                className="p-2 hover:bg-ui rounded-full transition-colors"
                title="Выйти"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link to="/login">
                <button className="px-5 py-2 text-sm font-medium border border-text rounded-md hover:bg-ui transition-colors">
                  Войти
                </button>
              </Link>
              <Link to="/register">
                <button className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-secondary transition-colors">
                  Регистрация
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
