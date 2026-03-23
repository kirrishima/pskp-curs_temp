
import React, { useEffect, useState } from "react";
import { Booking, User } from "../types";
import { cancelBooking, getUserBookings } from "../services/oracleApiService";
import Button, { ButtonVariant } from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";
import { ConfirmModal } from "../components/Modal";
import { Calendar, Clock, CreditCard, ChevronRight, Hash, Clock3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStatusColor, translateStatus } from "@/utils/BookingsUtils";

interface MyBookingsProps {
  user: User;
}

export default function MyBookings({ user }: MyBookingsProps) {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);

  // Modal State
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    const res = await getUserBookings(user.username);
    if (res.status === "OK" && res.data) {
      setBookings(res.data);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCancelClick = (bookingId: string) => {
    setCancelBookingId(bookingId);
  };

  const handleDetailsClick = (booking: Booking) => {
    navigate(`/booking/${booking.bookingId}`, { state: { booking } });
  };

  const confirmCancel = async () => {
    if (!cancelBookingId) return;

    const res = await cancelBooking(user.username, cancelBookingId);
    setCancelBookingId(null); // Close modal

    if (res.status === "OK") {
      fetchBookings();
    } else {
      alert(`${res.status}: ${res.message}`);
    }
  };

  return (
    <div className="max-w-[1024px] mx-auto px-4 py-12">
      <h1 className="text-3xl font-serif mb-8 text-text">Мои бронирования</h1>

      <div className="mb-6">
        <ErrorAlert error={error} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : bookings.length === 0 && !error ? (
        <div className="bg-white p-12 rounded-xl text-center border border-ui">
          <p className="text-lg text-text/60">У вас пока нет бронирований.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <div
              key={booking.bookingId}
              className="bg-white p-6 rounded-xl shadow-sm border border-ui flex flex-col md:flex-row justify-between gap-6 transition-all hover:shadow-md"
            >
              <div className="flex flex-col gap-2 flex-grow">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">{booking.roomTitle || `Номер ${booking.roomNo}`}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(booking.status)}`}>
                    {translateStatus(booking.status)}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 mt-2 text-sm text-text/70">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-text/50 uppercase text-[10px] tracking-wider">ID</span>
                        <span className="font-mono">{booking.bookingId}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <Hash size={14} className="text-primary"/>
                        <span className="font-bold">Номер:</span> 
                        <span>{booking.roomNo}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                        <Clock3 size={14} className="text-primary"/>
                        <span className="font-bold">Создано:</span> 
                        <span>{new Date(booking.createdAt).toLocaleString()}</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-text/80">
                    <Calendar size={16} className="text-primary" />
                    {new Date(booking.startDate).toLocaleDateString('ru-RU')} —{" "}
                    {new Date(booking.endDate).toLocaleDateString('ru-RU')}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text/80">
                    <CreditCard size={16} className="text-primary" />
                    <span className="font-medium">{booking.totalAmount.toLocaleString()} ₽</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 min-w-[180px] justify-center">
                <Button
                  text="Подробнее"
                  variant={ButtonVariant.Primary}
                  className="w-full "
                  onClick={() => handleDetailsClick(booking)}
                ></Button>

                {booking.status === "PENDING" || booking.status === "CONFIRMED" ? (
                  <Button
                    text="Отменить"
                    variant={ButtonVariant.Tertiary}
                    className="text-red-500 hover:bg-red-50 w-full"
                    onClick={() => handleCancelClick(booking.bookingId)}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!cancelBookingId}
        onClose={() => setCancelBookingId(null)}
        onConfirm={confirmCancel}
        title="Отмена бронирования"
        message="Вы уверены, что хотите отменить это бронирование? Это действие нельзя отменить."
        confirmText="Да, отменить"
        cancelText="Назад"
      />
    </div>
  );
}
