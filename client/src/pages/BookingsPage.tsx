import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, BedDouble, Loader2, AlertCircle, Receipt } from 'lucide-react';
import useAppSelector from '@/hooks/useAppSelector';
import { getMyBookings } from '@/api/hotelApi';
import { API_BASE_URL } from '@/api/axiosInstance';
import { fmtPrice } from '@/utils/currency';
import type { Booking, BookingStatus } from '@/types';

function resolveRoomImageUrl(imagesBase: string | undefined, imageId: string, ext: string): string {
  if (!imagesBase) return '';
  const serverBase = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${serverBase}${imagesBase}/${imageId}.${ext}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const formatCurrency = (amount: number, _currency?: string) => fmtPrice(amount);

function getNights(startDate: string, endDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / msPerDay);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Ожидает оплаты',
  CONFIRMED: 'Подтверждено',
  CANCELLED: 'Отменено',
  CHECKED_IN: 'Заселён',
  CHECKED_OUT: 'Выехал',
  NO_SHOW: 'Не явился',
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border border-blue-200',
  CANCELLED: 'bg-red-50 text-red-600 border border-red-200',
  CHECKED_IN: 'bg-green-50 text-green-700 border border-green-200',
  CHECKED_OUT: 'bg-gray-100 text-gray-500 border border-gray-200',
  NO_SHOW: 'bg-orange-50 text-orange-700 border border-orange-200',
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { label: string; value: string | undefined }[] = [
  { label: 'Все', value: undefined },
  { label: 'Активные', value: 'CONFIRMED' },
  { label: 'Ожидают оплаты', value: 'PENDING' },
  { label: 'Отменённые', value: 'CANCELLED' },
  { label: 'Завершённые', value: 'CHECKED_OUT' },
];

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: Booking }) {
  const navigate = useNavigate();
  const nights = getNights(booking.startDate, booking.endDate);
  const firstImg = booking.room?.images?.[0];
  const imageUrl = firstImg
    ? resolveRoomImageUrl(booking.room?.imagesBase, String(firstImg.imageId), firstImg.ext)
    : undefined;
  const hotelName = booking.room?.hotel?.name ?? 'Moonglow Hotel';

  return (
    <button
      type="button"
      onClick={() => navigate(`/bookings/${booking.bookingId}`)}
      className="w-full text-left bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden flex flex-col sm:flex-row group"
    >
      {/* Room image */}
      <div className="sm:w-40 sm:shrink-0 h-36 sm:h-auto bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={booking.room?.title ?? 'Номер'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <BedDouble size={32} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-grow p-4 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-text truncate">{booking.room?.title ?? booking.roomNo}</p>
            <p className="text-xs text-text/50 mt-0.5 truncate">{hotelName}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-text/60">
          <CalendarDays size={14} className="shrink-0" />
          <span>
            {formatDate(booking.startDate)} — {formatDate(booking.endDate)}
          </span>
          <span className="text-text/30 ml-1">·</span>
          <span>{nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}</span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-1.5 text-sm text-text/50">
            <Receipt size={13} />
            <span className="font-medium text-text">
              {formatCurrency(booking.totalAmount, booking.payment?.currency)}
            </span>
            {booking.status === 'CANCELLED' && booking.payment?.refundAmount != null && booking.payment.refundAmount > 0 && (
              <span className="text-green-600 text-xs ml-1">
                · возврат {formatCurrency(booking.payment.refundAmount, booking.payment.currency)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Подробнее
            <ChevronRight size={14} />
          </div>
        </div>

        <p className="text-xs text-text/30">
          Бронирование #{booking.bookingId.slice(0, 8).toUpperCase()}
          {' · '}
          {formatDate(booking.createdAt)}
        </p>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const isStaff = user?.role?.name === 'admin' || user?.role?.name === 'manager';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyBookings(
        { sortBy: 'createdAt', sortOrder: 'desc', ...(statusFilter ? { status: statusFilter } : {}) },
        signal,
      );
      if (!signal?.aborted) {
        setBookings(result.bookings);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError('Не удалось загрузить бронирования. Пожалуйста, попробуйте позже.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [statusFilter]);

  useEffect(() => {
    if (isStaff) return; // no-op: staff will be redirected before any data is needed
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load, isStaff]);

  const filtered = bookings; // server-side filtering; kept as-is for local re-renders

  // Staff should use /manage/bookings instead
  if (isStaff) return <Navigate to="/manage/bookings" replace />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text">Мои бронирования</h1>
        <p className="text-sm text-text/50 mt-1">
          История и активные бронирования
          {isStaff && ' · Вы просматриваете свой список. Для просмотра чужих бронирований используйте панель управления.'}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={[
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              statusFilter === opt.value
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text/60 border-gray-200 hover:border-primary/40 hover:text-text',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <AlertCircle size={36} className="text-red-400" />
          <p className="text-text/60">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <BedDouble size={28} className="text-gray-300" />
          </div>
          <div>
            <p className="font-medium text-text">Бронирований нет</p>
            <p className="text-sm text-text/50 mt-1">
              {statusFilter
                ? 'Нет бронирований с выбранным статусом.'
                : 'Вы ещё не создавали ни одного бронирования.'}
            </p>
          </div>
          {!statusFilter && (
            <Link
              to="/rooms"
              className="mt-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Выбрать номер
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((b) => (
            <BookingCard key={b.bookingId} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}
