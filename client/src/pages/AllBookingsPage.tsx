import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  BedDouble,
  Loader2,
  AlertCircle,
  Receipt,
  Search,
  LayoutGrid,
  Table2,
  Filter,
  X,
  ChevronsLeft,
  ChevronsRight,
  User as UserIcon,
} from 'lucide-react';
import useAppSelector from '@/hooks/useAppSelector';
import { getMyBookings } from '@/api/hotelApi';
import type { Booking, BookingStatus, BookingsPagination } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number, currency = 'RUB'): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function getNights(startDate: string, endDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / msPerDay);
}

// ─── Status badge ────────────────────────────────────────────────────────────

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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Payment status label ────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  SUCCEEDED: 'Оплачено',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменено',
};

// ─── Filter options ──────────────────────────────────────────────────────────

const ALL_STATUSES: { label: string; value: string }[] = [
  { label: 'Ожидает оплаты', value: 'PENDING' },
  { label: 'Подтверждено', value: 'CONFIRMED' },
  { label: 'Заселён', value: 'CHECKED_IN' },
  { label: 'Выехал', value: 'CHECKED_OUT' },
  { label: 'Отменено', value: 'CANCELLED' },
  { label: 'Не явился', value: 'NO_SHOW' },
];

// ─── Booking card (tile view) ────────────────────────────────────────────────

function BookingCard({ booking, isAdmin }: { booking: Booking; isAdmin: boolean }) {
  const navigate = useNavigate();
  const nights = getNights(booking.startDate, booking.endDate);
  const imageUrl = (booking.room as { images?: { imageUrl: string }[] } | undefined)?.images?.[0]?.imageUrl;
  const hotelName = booking.room?.hotel?.name ?? 'Moonglow Hotel';

  return (
    <button
      type="button"
      onClick={() => navigate(`/manage/bookings/${booking.bookingId}`)}
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

        {/* Guest info for staff */}
        {booking.user && (
          <div className="flex items-center gap-1.5 text-sm text-text/60">
            <UserIcon size={14} className="shrink-0" />
            <span className="truncate">
              {booking.user.firstName} {booking.user.lastName}
              <span className="text-text/30 ml-1">·</span>
              <span className="ml-1 text-text/40">{booking.user.email}</span>
            </span>
          </div>
        )}

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
            {booking.payment && (
              <span className="text-xs ml-1 text-text/40">
                · {PAYMENT_LABELS[booking.payment.status] ?? booking.payment.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Подробнее
            <ChevronRight size={14} />
          </div>
        </div>

        <p className="text-xs text-text/30">
          #{booking.bookingId.slice(0, 8).toUpperCase()}
          {' · '}
          {formatDate(booking.createdAt)}
        </p>
      </div>
    </button>
  );
}

// ─── Booking table row ───────────────────────────────────────────────────────

function BookingTableRow({
  booking,
  isAdmin,
  expandedId,
  setExpandedId,
}: {
  booking: Booking;
  isAdmin: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const navigate = useNavigate();
  const nights = getNights(booking.startDate, booking.endDate);
  const isExpanded = expandedId === booking.bookingId;

  return (
    <>
      <tr
        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
        onClick={() => navigate(`/manage/bookings/${booking.bookingId}`)}
      >
        <td className="px-4 py-3 text-xs font-mono text-text/60 whitespace-nowrap">
          {booking.bookingId.slice(0, 8).toUpperCase()}
        </td>
        {/* Guest */}
        <td className="px-4 py-3 text-sm">
          {booking.user ? (
            <div className="min-w-0">
              <p className="text-text truncate">{booking.user.firstName} {booking.user.lastName}</p>
              <p className="text-xs text-text/40 truncate">{booking.user.email}</p>
            </div>
          ) : (
            <span className="text-text/40">—</span>
          )}
        </td>
        {/* Room */}
        <td className="px-4 py-3 text-sm text-text truncate max-w-[160px]">
          {booking.room?.title ?? booking.roomNo}
        </td>
        {/* Dates */}
        <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
          {formatDate(booking.startDate)} — {formatDate(booking.endDate)}
          <span className="text-text/40 text-xs ml-1">({nights} н.)</span>
        </td>
        {/* Amount */}
        <td className="px-4 py-3 text-sm font-medium text-text whitespace-nowrap">
          {formatCurrency(booking.totalAmount, booking.payment?.currency)}
        </td>
        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={booking.status} />
        </td>
        {/* Payment */}
        <td className="px-4 py-3 text-xs text-text/60 whitespace-nowrap">
          {booking.payment ? (PAYMENT_LABELS[booking.payment.status] ?? booking.payment.status) : '—'}
        </td>
        {/* Expand */}
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(isExpanded ? null : booking.bookingId);
            }}
            className="text-text/30 hover:text-text/60 transition-colors"
            title="Детали"
          >
            <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        </td>
      </tr>

      {/* Expanded details row */}
      {isExpanded && (
        <tr className="bg-gray-50/30">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {/* Services */}
              {booking.bookingServices && booking.bookingServices.length > 0 && (
                <div>
                  <p className="text-xs text-text/40 uppercase tracking-wide mb-2 font-medium">Услуги</p>
                  <ul className="space-y-1">
                    {booking.bookingServices.map((bs) => (
                      <li key={bs.serviceCode} className="flex justify-between text-text/70">
                        <span>{bs.service?.title ?? bs.serviceCode}</span>
                        <span className="font-medium text-text">
                          {formatCurrency(bs.priceSnapshot, booking.payment?.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Payment details */}
              {booking.payment && (
                <div>
                  <p className="text-xs text-text/40 uppercase tracking-wide mb-2 font-medium">Оплата</p>
                  <dl className="space-y-1 text-text/70">
                    <div className="flex justify-between">
                      <dt>Статус</dt>
                      <dd className="font-medium text-text">{PAYMENT_LABELS[booking.payment.status] ?? booking.payment.status}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Сумма</dt>
                      <dd>{formatCurrency(booking.payment.amount, booking.payment.currency)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Дата</dt>
                      <dd>{formatDateTime(booking.payment.createdAt)}</dd>
                    </div>
                    {isAdmin && booking.payment.stripePaymentIntentId && (
                      <div className="flex justify-between">
                        <dt>Stripe PI</dt>
                        <dd className="font-mono text-xs truncate max-w-[200px]">{booking.payment.stripePaymentIntentId}</dd>
                      </div>
                    )}
                    {isAdmin && booking.payment.stripeChargeId && (
                      <div className="flex justify-between">
                        <dt>Charge</dt>
                        <dd className="font-mono text-xs truncate max-w-[200px]">{booking.payment.stripeChargeId}</dd>
                      </div>
                    )}
                    {booking.payment.refundAmount != null && booking.payment.refundAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <dt>Возврат</dt>
                        <dd>{formatCurrency(booking.payment.refundAmount, booking.payment.currency)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Hold (admin only) */}
              {isAdmin && booking.hold && (
                <div>
                  <p className="text-xs text-text/40 uppercase tracking-wide mb-2 font-medium">Hold</p>
                  <dl className="space-y-1 text-text/70">
                    <div className="flex justify-between">
                      <dt>ID</dt>
                      <dd className="font-mono text-xs">{booking.hold.holdId.slice(0, 8)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Статус</dt>
                      <dd className="font-medium text-text">{booking.hold.status}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Истекает</dt>
                      <dd>{formatDateTime(booking.hold.expiresAt)}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: BookingsPagination;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, totalCount, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalCount);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-6 text-sm">
      <p className="text-text/40">
        {from}–{to} из {totalCount}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 py-1 text-text/60">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AllBookingsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role?.name === 'admin';

  // ── State ─────────────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<BookingsPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<'tiles' | 'table'>('table');

  // Table expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const result = await getMyBookings(params, signal);
      if (!signal?.aborted) {
        setBookings(result.bookings);
        setPagination(result.pagination ?? null);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError('Не удалось загрузить бронирования.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, statusFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // Search debounce
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
    }, 400);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
    setPage(1);
  }, []);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter('');
    setSearchInput('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const hasActiveFilters = statusFilter || searchQuery || dateFrom || dateTo;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            {isAdmin ? 'Все бронирования' : 'Бронирования'}
          </h1>
          <p className="text-sm text-text/50 mt-1">
            {isAdmin
              ? 'Полный список бронирований с возможностью поиска и фильтрации'
              : 'Активные и недавние бронирования'}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setViewMode('tiles')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'tiles' ? 'bg-white shadow-sm text-primary' : 'text-text/40 hover:text-text/60'}`}
            title="Плитки"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-text/40 hover:text-text/60'}`}
            title="Таблица"
          >
            <Table2 size={18} />
          </button>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-grow max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/30" />
          <input
            type="text"
            placeholder="Поиск по ID бронирования..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>

        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
            hasActiveFilters
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-white text-text/60 border-gray-200 hover:border-primary/30'
          }`}
        >
          <Filter size={16} />
          Фильтры
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-primary" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm text-text/40 hover:text-text/60 transition-colors"
          >
            <X size={14} />
            Сбросить
          </button>
        )}
      </div>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-end">
          {/* Status */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-text/50 mb-1.5">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="">Все статусы</option>
              {ALL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-text/50 mb-1.5">Заезд от</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Date to */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-text/50 mb-1.5">Выезд до</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      )}

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
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <BedDouble size={28} className="text-gray-300" />
          </div>
          <div>
            <p className="font-medium text-text">Бронирований нет</p>
            <p className="text-sm text-text/50 mt-1">
              {hasActiveFilters
                ? 'Нет бронирований, соответствующих выбранным фильтрам.'
                : 'Список бронирований пуст.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : viewMode === 'tiles' ? (
        /* ── Tile view ─────────────────────────────────────────────────────── */
        <div className="flex flex-col gap-4">
          {bookings.map((b) => (
            <BookingCard key={b.bookingId} booking={b} isAdmin={!!isAdmin} />
          ))}
        </div>
      ) : (
        /* ── Table view ────────────────────────────────────────────────────── */
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">ID</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Гость</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Номер</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Даты</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Сумма</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Статус</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Оплата</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <BookingTableRow
                    key={b.bookingId}
                    booking={b}
                    isAdmin={!!isAdmin}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
    </div>
  );
}
