import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  Loader2,
  AlertCircle,
  X,
  TriangleAlert,
  CheckCircle,
  Info,
  MapPin,
  CreditCard,
  ClipboardList,
  ShieldAlert,
  User as UserIcon,
  Clock,
} from 'lucide-react';
import useAppSelector from '@/hooks/useAppSelector';
import { getBookingById, cancelBookingWithRefund } from '@/api/hotelApi';
import type { Booking, BookingStatus, RefundStatus, CancellationSource } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
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
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getNights(startDate: string, endDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / msPerDay,
  );
}

function getHoursUntilCheckIn(startDate: string): number {
  const checkIn = new Date(startDate);
  checkIn.setHours(14, 0, 0, 0);
  return (checkIn.getTime() - Date.now()) / (1000 * 60 * 60);
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
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Refund status display ────────────────────────────────────────────────────

const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  NONE: 'Возврат не предусмотрен',
  FULL: 'Полный возврат',
  PARTIAL: 'Частичный возврат',
  PENDING: 'Возврат обрабатывается',
  FAILED: 'Ошибка возврата',
  ACTION_REQUIRED: 'Требуется ручная обработка',
};

function RefundStatusBlock({
  refundStatus,
  refundAmount,
  penaltyAmount,
  currency,
}: {
  refundStatus: RefundStatus;
  refundAmount?: number | null;
  penaltyAmount?: number | null;
  currency?: string;
}) {
  if (!refundStatus || refundStatus === 'NONE') return null;

  const showAmount = refundStatus === 'FULL' || refundStatus === 'PARTIAL';
  const isActionRequired = refundStatus === 'ACTION_REQUIRED' || refundStatus === 'FAILED';
  const isPending = refundStatus === 'PENDING';

  return (
    <div
      className={[
        'rounded-xl p-4 border text-sm flex flex-col gap-2',
        isActionRequired
          ? 'bg-orange-50 border-orange-200 text-orange-800'
          : isPending
            ? 'bg-blue-50 border-blue-200 text-blue-800'
            : 'bg-green-50 border-green-200 text-green-800',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 font-medium">
        {isActionRequired ? (
          <ShieldAlert size={16} />
        ) : isPending ? (
          <Info size={16} />
        ) : (
          <CheckCircle size={16} />
        )}
        {REFUND_STATUS_LABELS[refundStatus]}
      </div>

      {showAmount && refundAmount != null && refundAmount > 0 && (
        <p>
          Сумма возврата:{' '}
          <span className="font-semibold">{formatCurrency(refundAmount, currency)}</span>
          {penaltyAmount != null && penaltyAmount > 0 && (
            <span className="text-xs ml-1 opacity-70">
              (штраф: {formatCurrency(penaltyAmount, currency)})
            </span>
          )}
        </p>
      )}

      {showAmount && (
        <p className="text-xs opacity-70">
          Возврат средств на карту занимает от 5 до 10 рабочих дней в зависимости от
          вашего банка. Фактические сроки определяются платёжной системой.
        </p>
      )}

      {isPending && (
        <p className="text-xs opacity-70">
          Возврат поставлен в очередь. Средства поступят в течение 5–10 рабочих дней.
        </p>
      )}

      {isActionRequired && (
        <p className="text-xs opacity-70">
          Возврат не был выполнен автоматически. Пожалуйста, свяжитесь со службой поддержки
          для урегулирования.
        </p>
      )}
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
        <span className="text-text/40">{icon}</span>
        <h2 className="text-sm font-semibold text-text/70 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ─── Cancel modal ─────────────────────────────────────────────────────────────

type CancelStep = 'idle' | 'form' | 'processing' | 'done' | 'error';
type CancelSource = 'GUEST' | 'ADMIN' | 'HOTEL';

interface CancelModalProps {
  booking: Booking;
  isStaff: boolean;
  onClose: () => void;
  onSuccess: (result: { refundAmount: number; penaltyAmount: number; refundStatus: string }) => void;
}

function CancelModal({ booking, isStaff, onClose, onSuccess }: CancelModalProps) {
  const [step, setStep] = useState<CancelStep>('form');
  const [source, setSource] = useState<CancelSource>(isStaff ? 'ADMIN' : 'GUEST');
  const [reason, setReason] = useState('');
  const [applyPenalty, setApplyPenalty] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const hoursUntilCheckIn = getHoursUntilCheckIn(booking.startDate);
  const isPending = booking.status === 'PENDING';
  const isLateCancellation =
    !isPending && source === 'GUEST' && hoursUntilCheckIn < 48;
  const oneNight = booking.room?.basePrice ?? 0;
  const currency = booking.payment?.currency;

  const guestPenalty =
    source === 'GUEST' && isLateCancellation ? oneNight : 0;
  const adminPenalty =
    source === 'ADMIN' && applyPenalty ? oneNight : 0;
  const effectivePenalty = source === 'HOTEL' ? 0 : source === 'ADMIN' ? adminPenalty : guestPenalty;
  const estimatedRefund = Math.max(0, booking.totalAmount - effectivePenalty);

  const canSubmit = step === 'form' && (source !== 'ADMIN' || reason.trim().length > 0);

  const handleSubmit = useCallback(async () => {
    // Ref-based guard: prevents duplicate submission even if React
    // batches state updates and the button re-renders before step changes
    if (submittingRef.current) return;
    submittingRef.current = true;

    setStep('processing');
    setErrorMsg(null);
    try {
      const result = await cancelBookingWithRefund(booking.bookingId, {
        source,
        applyPenalty: source === 'ADMIN' ? applyPenalty : undefined,
        reason: reason.trim() || undefined,
      });
      setStep('done');
      onSuccess(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Не удалось отменить бронирование.';
      setErrorMsg(msg);
      setStep('error');
    } finally {
      submittingRef.current = false;
    }
  }, [booking.bookingId, source, applyPenalty, reason, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-text">Отмена бронирования</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ui transition-colors text-text/50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Booking summary */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <p className="font-medium text-text">{booking.room?.title ?? booking.roomNo}</p>
            <p className="text-text/50 mt-0.5">
              {formatDate(booking.startDate)} — {formatDate(booking.endDate)},{' '}
              {getNights(booking.startDate, booking.endDate)} ночей ·{' '}
              {formatCurrency(booking.totalAmount, currency)}
            </p>
          </div>

          {/* Staff source selector */}
          {isStaff && !isPending && (
            <div>
              <label className="block text-sm font-medium text-text/70 mb-2">
                Инициатор отмены
              </label>
              <div className="flex gap-3">
                {(['ADMIN', 'HOTEL'] as CancelSource[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className={[
                      'flex-1 py-2 rounded-xl text-sm font-medium border transition-colors',
                      source === s
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-white text-text/60 border-gray-200 hover:border-primary/30',
                    ].join(' ')}
                  >
                    {s === 'ADMIN' ? 'Администратор' : 'По инициативе отеля'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Penalty toggle (admin only) */}
          {isStaff && source === 'ADMIN' && !isPending && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={applyPenalty}
                onChange={(e) => setApplyPenalty(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary"
              />
              <span className="text-sm text-text/70">
                Применить штраф за 1 ночь ({formatCurrency(oneNight, currency)})
              </span>
            </label>
          )}

          {/* Reason field */}
          {isStaff && !isPending && (
            <div>
              <label className="block text-sm font-medium text-text/70 mb-1.5">
                Причина отмены{source === 'ADMIN' ? ' *' : ''}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={
                  source === 'HOTEL'
                    ? 'Опционально: объясните причину отмены со стороны отеля...'
                    : 'Укажите причину отмены...'
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
          )}

          {/* Guest warning: late cancellation */}
          {!isStaff && isLateCancellation && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex gap-3 text-sm text-orange-800">
              <TriangleAlert size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Штраф за позднюю отмену</p>
                <p className="mt-0.5 opacity-80">
                  До заезда осталось менее 48 часов. Будет удержан штраф за{' '}
                  <strong>1 ночь: {formatCurrency(oneNight, currency)}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Hotel source: full refund notice */}
          {isStaff && source === 'HOTEL' && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex gap-3 text-sm text-green-800">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Полный возврат</p>
                <p className="mt-0.5 opacity-80">
                  При отмене по инициативе отеля гость получает полный возврат средств.
                </p>
              </div>
            </div>
          )}

          {/* Estimated refund summary */}
          {!isPending && (
            <div className="text-sm text-text/60 bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex justify-between">
                <span>Оплачено</span>
                <span className="font-medium text-text">{formatCurrency(booking.totalAmount, currency)}</span>
              </div>
              {effectivePenalty > 0 && (
                <div className="flex justify-between mt-1 text-orange-600">
                  <span>Штраф (1 ночь)</span>
                  <span>−{formatCurrency(effectivePenalty, currency)}</span>
                </div>
              )}
              <div className="flex justify-between mt-1 pt-1 border-t border-gray-200 font-semibold text-text">
                <span>Возврат</span>
                <span>{formatCurrency(source === 'HOTEL' ? booking.totalAmount : estimatedRefund, currency)}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {step === 'error' && errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-3 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={step === 'processing'}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-text/60 hover:bg-ui transition-colors disabled:opacity-50"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || step === 'processing'}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {step === 'processing' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Обработка…
                </>
              ) : (
                'Отменить бронирование'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const loc = useLocation();
  const user = useAppSelector((s) => s.auth.user);
  const isStaff = user?.role?.name === 'admin' || user?.role?.name === 'manager';
  const isAdmin = user?.role?.name === 'admin';

  // Determine back link based on whether we came from /manage/bookings or /bookings
  const isManageContext = loc.pathname.startsWith('/manage/');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelResult, setCancelResult] = useState<{
    refundAmount: number;
    penaltyAmount: number;
    refundStatus: string;
  } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getBookingById(bookingId, signal);
      if (!signal?.aborted) {
        setBooking(result.booking);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError('Бронирование не найдено или у вас нет доступа к нему.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [bookingId]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const handleCancelSuccess = useCallback(
    (result: { refundAmount: number; penaltyAmount: number; refundStatus: string }) => {
      setShowCancel(false);
      setCancelResult(result);
      // Refresh booking data to reflect new status (no signal — user-initiated)
      load();
    },
    [load],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center flex flex-col items-center gap-4">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-text/60">{error ?? 'Бронирование не найдено.'}</p>
        <button
          type="button"
          onClick={() => navigate(isManageContext ? '/manage/bookings' : '/bookings')}
          className="px-5 py-2 bg-primary text-white rounded-xl text-sm hover:bg-primary/90 transition-colors"
        >
          К списку бронирований
        </button>
      </div>
    );
  }

  const nights = getNights(booking.startDate, booking.endDate);
  const currency = booking.payment?.currency ?? 'RUB';
  const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
  const mainImage = booking.room?.images?.find((img) => img.isMain) ?? booking.room?.images?.[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(isManageContext ? '/manage/bookings' : '/bookings')}
        className="flex items-center gap-2 text-sm text-text/50 hover:text-text transition-colors w-fit"
      >
        <ArrowLeft size={16} />
        {isManageContext ? 'Все бронирования' : 'Мои бронирования'}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            {booking.room?.title ?? booking.roomNo}
          </h1>
          <p className="text-sm text-text/50 mt-0.5">
            {booking.room?.hotel?.name ?? 'Moonglow Hotel'}
            {booking.room?.hotel?.city ? ` · ${booking.room.hotel.city}` : ''}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Cancel result banner */}
      {cancelResult && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <CheckCircle size={18} />
            Бронирование успешно отменено
          </div>
          <RefundStatusBlock
            refundStatus={cancelResult.refundStatus as RefundStatus}
            refundAmount={cancelResult.refundAmount}
            penaltyAmount={cancelResult.penaltyAmount}
            currency={currency}
          />
        </div>
      )}

      {/* Room image */}
      {mainImage && (
        <div className="rounded-2xl overflow-hidden h-56 w-full">
          <img
            src={mainImage.imageUrl}
            alt={booking.room?.title ?? 'Номер'}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Booking details */}
      <Section title="Детали бронирования" icon={<ClipboardList size={16} />}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Номер брони</dt>
            <dd className="font-mono font-medium text-text">{booking.bookingId}</dd>
          </div>
          <div>
            <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Создано</dt>
            <dd className="text-text">{formatDateTime(booking.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Заезд</dt>
            <dd className="text-text font-medium">{formatDate(booking.startDate)}</dd>
          </div>
          <div>
            <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Выезд</dt>
            <dd className="text-text font-medium">{formatDate(booking.endDate)}</dd>
          </div>
          <div>
            <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Продолжительность</dt>
            <dd className="text-text">
              {nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}
            </dd>
          </div>
          <div>
            <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Номер комнаты</dt>
            <dd className="text-text">{booking.roomNo}</dd>
          </div>
          {booking.notes && (
            <div className="col-span-2">
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Примечания</dt>
              <dd className="text-text">{booking.notes}</dd>
            </div>
          )}
        </dl>

        {booking.room?.hotel?.address && (
          <div className="flex items-start gap-2 mt-4 pt-4 border-t border-gray-50 text-sm text-text/60">
            <MapPin size={14} className="shrink-0 mt-0.5" />
            <span>{booking.room.hotel.address}</span>
          </div>
        )}
      </Section>

      {/* Guest info (staff only) */}
      {isStaff && booking.user && (
        <Section title="Гость" icon={<UserIcon size={16} />}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Имя</dt>
              <dd className="text-text font-medium">{booking.user.firstName} {booking.user.lastName}</dd>
            </div>
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Email</dt>
              <dd className="text-text">{booking.user.email}</dd>
            </div>
            {booking.user.phone && (
              <div>
                <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Телефон</dt>
                <dd className="text-text">{booking.user.phone}</dd>
              </div>
            )}
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">ID пользователя</dt>
              <dd className="font-mono text-xs text-text/60">{booking.userId}</dd>
            </div>
          </dl>
        </Section>
      )}

      {/* Hold info (admin only) */}
      {isAdmin && booking.hold && (
        <Section title="Hold (блокировка)" icon={<Clock size={16} />}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Hold ID</dt>
              <dd className="font-mono text-xs text-text/60">{booking.hold.holdId}</dd>
            </div>
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Статус</dt>
              <dd className="text-text font-medium">{booking.hold.status}</dd>
            </div>
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Истекает</dt>
              <dd className="text-text">{formatDateTime(booking.hold.expiresAt)}</dd>
            </div>
            {booking.hold.createdAt && (
              <div>
                <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Создан</dt>
                <dd className="text-text">{formatDateTime(booking.hold.createdAt)}</dd>
              </div>
            )}
          </dl>
        </Section>
      )}

      {/* Services */}
      {booking.bookingServices && booking.bookingServices.length > 0 && (
        <Section title="Услуги" icon={<BedDouble size={16} />}>
          <ul className="flex flex-col gap-2">
            {booking.bookingServices.map((bs) => (
              <li
                key={bs.serviceCode}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-text/70">{bs.service?.title ?? bs.serviceCode}</span>
                <span className="font-medium text-text">
                  {formatCurrency(bs.priceSnapshot, currency)}
                  {bs.service?.priceType === 'PER_NIGHT' && (
                    <span className="text-xs text-text/40 ml-1">/ ночь</span>
                  )}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between text-sm pt-2 mt-1 border-t border-gray-100 font-semibold">
              <span className="text-text">Итого</span>
              <span className="text-text">{formatCurrency(booking.totalAmount, currency)}</span>
            </li>
          </ul>
        </Section>
      )}

      {/* Payment */}
      {booking.payment && (
        <Section title="Оплата" icon={<CreditCard size={16} />}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Сумма</dt>
              <dd className="font-semibold text-text">
                {formatCurrency(booking.payment.amount, booking.payment.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Статус платежа</dt>
              <dd className="text-text capitalize">{booking.payment.status}</dd>
            </div>
            {isStaff && (
              <>
                <div className="col-span-2">
                  <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">
                    Stripe PaymentIntent
                  </dt>
                  <dd className="font-mono text-xs text-text/60 break-all">
                    {booking.payment.stripePaymentIntentId}
                  </dd>
                </div>
                {booking.payment.stripeChargeId && (
                  <div className="col-span-2">
                    <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">
                      Stripe Charge ID
                    </dt>
                    <dd className="font-mono text-xs text-text/60 break-all">
                      {booking.payment.stripeChargeId}
                    </dd>
                  </div>
                )}
                {booking.payment.stripeRefundId && (
                  <div className="col-span-2">
                    <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">
                      Stripe Refund ID
                    </dt>
                    <dd className="font-mono text-xs text-text/60 break-all">
                      {booking.payment.stripeRefundId}
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>

          {/* Refund status */}
          {booking.refundStatus && booking.refundStatus !== 'NONE' && (
            <div className="mt-4">
              <RefundStatusBlock
                refundStatus={booking.refundStatus}
                refundAmount={booking.payment.refundAmount}
                penaltyAmount={booking.penaltyAmount}
                currency={booking.payment.currency}
              />
            </div>
          )}
        </Section>
      )}

      {/* Cancellation details */}
      {booking.status === 'CANCELLED' && booking.cancelledAt && (
        <Section title="Отмена" icon={<X size={16} />}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Дата отмены</dt>
              <dd className="text-text">{formatDateTime(booking.cancelledAt)}</dd>
            </div>
            {booking.cancellationSource && (
              <div>
                <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">
                  Инициатор
                </dt>
                <dd className="text-text">
                  {
                    {
                      GUEST: 'Гость',
                      ADMIN: 'Администратор',
                      HOTEL: 'Отель',
                      SYSTEM: 'Система (незаезд)',
                    }[booking.cancellationSource as CancellationSource] ??
                      booking.cancellationSource
                  }
                </dd>
              </div>
            )}
            {booking.cancellationReason && (
              <div className="col-span-2">
                <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Причина</dt>
                <dd className="text-text">{booking.cancellationReason}</dd>
              </div>
            )}
            {booking.penaltyAmount != null && booking.penaltyAmount > 0 && (
              <div>
                <dt className="text-text/40 text-xs uppercase tracking-wide mb-0.5">Штраф</dt>
                <dd className="text-text font-medium">
                  {formatCurrency(booking.penaltyAmount, currency)}
                </dd>
              </div>
            )}
          </dl>
        </Section>
      )}

      {/* Cancel action */}
      {canCancel && !cancelResult && (
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-sm text-text/60">
            <p className="font-medium text-text mb-0.5">Отменить бронирование</p>
            {booking.status === 'CONFIRMED' && !isStaff && (
              <p>
                {getHoursUntilCheckIn(booking.startDate) < 48
                  ? `До заезда менее 48 ч — будет удержан штраф за 1 ночь (${formatCurrency(booking.room?.basePrice ?? 0, currency)}).`
                  : 'Полный возврат средств — до заезда более 48 часов.'}
              </p>
            )}
            {isStaff && (
              <p>Вы можете отменить бронирование с настройкой условий возврата.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="shrink-0 px-5 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-medium hover:bg-red-100 transition-colors"
          >
            Отменить бронирование
          </button>
        </div>
      )}

      {/* No-show / action required banner */}
      {booking.refundStatus === 'ACTION_REQUIRED' && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex gap-3 text-sm text-orange-800">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Требуется внимание</p>
            <p className="mt-0.5 opacity-80">
              Автоматический возврат средств не был выполнен. Пожалуйста, обратитесь в
              службу поддержки — мы урегулируем вопрос вручную.
            </p>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {showCancel && (
        <CancelModal
          booking={booking}
          isStaff={isStaff}
          onClose={() => setShowCancel(false)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
}
