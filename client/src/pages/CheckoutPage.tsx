/**
 * CheckoutPage — 3-step booking wizard
 *
 * Step 0 – Service selection
 *   INCLUDED    → always in, read-only
 *   OPTIONAL_ON → on by default, guest may remove
 *   OPTIONAL_OFF → off by default, guest may add
 *   Live price breakdown updates as toggles change.
 *
 * Step 1 – Guest data
 *   firstName / lastName (Latin), phone, email, notes (optional).
 *   Pre-filled from the current user account.
 *
 * Step 2 – Confirmation + payment
 *   Read-only summary of everything selected.
 *   "Book and pay" button triggers ONE call to POST /api/payments/create-intent.
 *   Stripe Elements appear inline below the summary.
 *   WebSocket notifications (PAYMENT_SUCCEEDED / PAYMENT_CANCELLED)
 *   update the page for terminal events only. Non-terminal payment errors
 *   (card declined) are handled inline by the Stripe form.
 *
 * The payment intent is created explicitly on button click (not in a useEffect),
 * which prevents React StrictMode's double-invoke from sending duplicate requests.
 */

import { useState, useCallback, useRef, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  ArrowLeft,
  Check,
  CreditCard,
  User,
  Settings,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Mail,
  Phone,
  CalendarDays,
  Pencil,
} from 'lucide-react';

import axios from 'axios';

import useAppSelector from '@/hooks/useAppSelector';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import { createPaymentIntent, cancelBooking } from '@/api/hotelApi';
import { API_BASE_URL } from '@/api/axiosInstance';
import { INPUT_CLASS, INPUT_ERROR_CLASS, FIELD_LABEL_CLASS } from '@/utils/formStyles';
import { getFeatureIcon } from '@/utils/featureIcons';
import { CURRENCY_SYMBOL, CURRENCY_CODE } from '@/utils/currency';
import type { Room, RoomServiceEntry } from '@/types';

// ─── Stripe promise ───────────────────────────────────────────────────────────
// Created once at module level so Elements always receives the same reference.

let _stripePromise: ReturnType<typeof loadStripe> | null = null;

function getStripePromise() {
  if (!_stripePromise) {
    _stripePromise = fetch(`${API_BASE_URL}/payments/config`)
      .then((r) => r.json())
      .then(({ stripePublishableKey }: { stripePublishableKey: string }) =>
        loadStripe(stripePublishableKey),
      )
      .catch(() => null);
  }
  return _stripePromise;
}

// Start fetching Stripe.js in the background immediately.
getStripePromise();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcNights(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isLatin(s: string): boolean {
  return /^[A-Za-z\s\-'.]+$/.test(s.trim());
}

function nightsLabel(n: number): string {
  if (n === 1) return '1 ночь';
  if (n < 5) return `${n} ночи`;
  return `${n} ночей`;
}

function resolveImageUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    return `${API_BASE_URL.replace(/\/api\/?$/, '')}${url}`;
  }
  return url;
}

// ─── Location state ───────────────────────────────────────────────────────────

interface CheckoutState {
  room: Room;
  checkInDate: string;
  checkOutDate: string;
}

// ─── Service selections ───────────────────────────────────────────────────────

type Selections = Record<string, boolean>;

function buildInitialSelections(roomServices: RoomServiceEntry[]): Selections {
  const sel: Selections = {};
  for (const rs of roomServices) {
    sel[rs.serviceCode] =
      rs.defaultState === 'INCLUDED' || rs.defaultState === 'OPTIONAL_ON';
  }
  return sel;
}

function calcTotal(
  room: Room,
  roomServices: RoomServiceEntry[],
  selections: Selections,
  nights: number,
): number {
  let total = (room.basePrice ?? 0) * nights;
  for (const rs of roomServices) {
    // INCLUDED services are baked into basePrice — never charge extra
    if (rs.defaultState === 'INCLUDED') continue;
    if (!selections[rs.serviceCode] || !rs.service?.isActive) continue;
    const price = rs.service.basePrice ?? 0;
    total += rs.service.priceType === 'PER_NIGHT' ? price * nights : price;
  }
  return total;
}

// ─── Guest data ───────────────────────────────────────────────────────────────

interface GuestData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEP_LABELS = ['Услуги', 'Данные гостя', 'Подтверждение'];

const StepIndicator = memo(function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  done ? 'bg-green-500 text-white' : active ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400',
                ].join(' ')}
              >
                {done ? <Check size={16} /> : i + 1}
              </div>
              <span
                className={[
                  'text-xs font-medium whitespace-nowrap',
                  active ? 'text-primary' : done ? 'text-green-600' : 'text-gray-400',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={['w-16 h-0.5 mx-1 mb-4 transition-colors', done ? 'bg-green-400' : 'bg-gray-200'].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

// ─── Price breakdown ──────────────────────────────────────────────────────────

interface PriceBreakdownProps {
  room: Room;
  roomServices: RoomServiceEntry[];
  selections: Selections;
  nights: number;
  compact?: boolean;
}

const PriceBreakdown = memo(function PriceBreakdown({
  room,
  roomServices,
  selections,
  nights,
  compact,
}: PriceBreakdownProps) {
  const total = calcTotal(room, roomServices, selections, nights);
  // INCLUDED services are never listed as extra line items — their cost is in the room price
  const activeServices = roomServices.filter(
    (rs) => rs.defaultState !== 'INCLUDED' && selections[rs.serviceCode] && rs.service?.isActive,
  );

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 ${compact ? 'text-sm' : ''}`}>
      {!compact && (
        <p className="text-xs font-bold text-text/50 uppercase tracking-wider mb-3">Расчёт стоимости</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-text/70">
          Номер × {nightsLabel(nights)}
        </span>
        <span className="font-medium text-text">{fmt(room.basePrice * nights)} {CURRENCY_SYMBOL}</span>
      </div>
      {activeServices.map((rs) => {
        const price = rs.service.basePrice ?? 0;
        const lineTotal = rs.service.priceType === 'PER_NIGHT' ? price * nights : price;
        return (
          <div key={rs.serviceCode} className="flex items-center justify-between">
            <span className="text-text/70">
              {rs.service.title}
              {rs.service.priceType === 'PER_NIGHT' && (
                <span className="text-text/40 text-xs"> × {nights} н.</span>
              )}
            </span>
            <span className="font-medium text-text">{fmt(lineTotal)} {CURRENCY_SYMBOL}</span>
          </div>
        );
      })}
      <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
        <span className="font-semibold text-text">Итого</span>
        <span className={`font-bold text-primary ${compact ? 'text-base' : 'text-lg'}`}>{fmt(total)} {CURRENCY_SYMBOL}</span>
      </div>
    </div>
  );
});

// ─── Step 0: Service selection ────────────────────────────────────────────────

interface Step0Props {
  room: Room;
  roomServices: RoomServiceEntry[];
  selections: Selections;
  nights: number;
  onToggle: (code: string) => void;
  onNext: () => void;
}

function Step0Services({ room, roomServices, selections, nights, onToggle, onNext }: Step0Props) {
  const included = roomServices.filter((rs) => rs.defaultState === 'INCLUDED');
  const optional = roomServices.filter((rs) => rs.defaultState !== 'INCLUDED');

  return (
    <div className="space-y-6">
      {!roomServices.length && (
        <p className="text-text/60 text-sm text-center py-6">В этом номере нет дополнительных услуг.</p>
      )}

      {included.length > 0 && (
        <div>
          <p className="text-xs font-bold text-text/50 uppercase tracking-wider mb-3">Включено в стоимость</p>
          <div className="space-y-2">
            {included.map((rs) => {
              const price = rs.service.basePrice ?? 0;
              const lineTotal = rs.service.priceType === 'PER_NIGHT' ? price * nights : price;
              return (
                <div
                  key={rs.serviceCode}
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0">
                      {getFeatureIcon({ iconUrl: rs.service.iconUrl, icon: rs.service.icon, size: 16, className: 'text-green-600' })}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-text">{rs.service.title}</span>
                      {rs.service.description && (
                        <p className="text-xs text-text/50 mt-0.5">{rs.service.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-green-600 font-medium whitespace-nowrap ml-3">
                    {fmt(lineTotal)} {CURRENCY_SYMBOL}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {optional.length > 0 && (
        <div>
          <p className="text-xs font-bold text-text/50 uppercase tracking-wider mb-3">Дополнительные услуги</p>
          <div className="space-y-2">
            {optional.map((rs) => {
              const isOn = selections[rs.serviceCode] ?? false;
              const price = rs.service.basePrice ?? 0;
              const lineTotal = rs.service.priceType === 'PER_NIGHT' ? price * nights : price;
              const canToggle = rs.service.isActive;
              return (
                <button
                  key={rs.serviceCode}
                  type="button"
                  disabled={!canToggle}
                  onClick={() => canToggle && onToggle(rs.serviceCode)}
                  className={[
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left',
                    isOn ? 'bg-primary/5 border-primary/40' : 'bg-white border-gray-200 hover:border-gray-300',
                    !canToggle ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        isOn ? 'bg-primary border-primary' : 'border-gray-300 bg-white',
                      ].join(' ')}
                    >
                      {isOn && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="flex-shrink-0">
                      {getFeatureIcon({ iconUrl: rs.service.iconUrl, icon: rs.service.icon, size: 16, className: isOn ? 'text-primary' : 'text-text/40' })}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-text">{rs.service.title}</span>
                      {rs.service.description && (
                        <p className="text-xs text-text/50 mt-0.5">{rs.service.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <div className={`text-sm font-semibold ${isOn ? 'text-primary' : 'text-text/50'}`}>
                      + {fmt(lineTotal)} {CURRENCY_SYMBOL}
                    </div>
                    {rs.service.priceType === 'PER_NIGHT' && (
                      <div className="text-xs text-text/40">{fmt(price)} {CURRENCY_SYMBOL} / ночь</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <PriceBreakdown room={room} roomServices={roomServices} selections={selections} nights={nights} />

      <button
        onClick={onNext}
        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl py-3 transition-colors"
      >
        Продолжить →
      </button>
    </div>
  );
}

// ─── Step 1: Guest data ───────────────────────────────────────────────────────

interface GuestErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

interface Step1Props {
  data: GuestData;
  onChange: (field: keyof GuestData, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function Step1GuestInfo({ data, onChange, onBack, onNext }: Step1Props) {
  const [errors, setErrors] = useState<GuestErrors>({});

  const validate = (): boolean => {
    const errs: GuestErrors = {};

    if (!data.firstName.trim()) errs.firstName = 'Обязательное поле';
    else if (!isLatin(data.firstName)) errs.firstName = 'Только латинские буквы';

    if (!data.lastName.trim()) errs.lastName = 'Обязательное поле';
    else if (!isLatin(data.lastName)) errs.lastName = 'Только латинские буквы';

    if (!data.phone.trim()) errs.phone = 'Обязательное поле';
    else if (!/^\+?[\d\s\-()]{7,}$/.test(data.phone.trim())) errs.phone = 'Некорректный номер';

    if (!data.email.trim()) errs.email = 'Обязательное поле';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errs.email = 'Некорректный email';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const clearErr = (id: keyof GuestErrors) =>
    setErrors((p) => ({ ...p, [id]: undefined }));

  const textField = (
    id: keyof GuestData,
    label: string,
    type = 'text',
    placeholder = '',
    hint?: string,
  ) => {
    const err = id !== 'notes' ? errors[id as keyof GuestErrors] : undefined;
    return (
      <div>
        <label className={`${FIELD_LABEL_CLASS} block mb-1`} htmlFor={id}>
          {label}
          {id !== 'notes' && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={data[id]}
          onChange={(e) => {
            onChange(id, e.target.value);
            if (id !== 'notes') clearErr(id as keyof GuestErrors);
          }}
          className={err ? INPUT_ERROR_CLASS : INPUT_CLASS}
        />
        {hint && !err && <p className="text-xs text-text/40 mt-1">{hint}</p>}
        {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {textField('firstName', 'Имя', 'text', 'Ivan', 'Латинскими буквами, как в загранпаспорте')}
        {textField('lastName', 'Фамилия', 'text', 'Petrov', 'Только латинские буквы')}
      </div>
      {textField('phone', 'Телефон', 'tel', '+7 (999) 123-45-67', 'Для связи при необходимости')}
      {textField('email', 'Email', 'email', 'ivan@example.com', 'Подтверждение бронирования придёт сюда')}
      <div>
        <label className={`${FIELD_LABEL_CLASS} block mb-1`} htmlFor="notes">
          Особые пожелания
          <span className="text-text/40 font-normal ml-1">(необязательно)</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Например: ранний заезд, детская кроватка, тихий номер…"
          value={data.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          className={`${INPUT_CLASS} resize-none`}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-text/70 font-medium rounded-xl py-3 transition-colors"
        >
          <ArrowLeft size={16} /> Назад
        </button>
        <button
          type="button"
          onClick={() => { if (validate()) onNext(); }}
          className="flex-grow bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          Продолжить →
        </button>
      </div>
    </div>
  );
}

// ─── Stripe checkout form (inside Elements) ───────────────────────────────────

interface StripeFormProps {
  totalAmount: number;
  currency: string;
  bookingId: string;
  onSuccess: () => void;
  onCancel: () => void;
  cancelling: boolean;
}

function StripeCheckoutForm({ totalAmount, currency, bookingId, onSuccess, onCancel, cancelling }: StripeFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message ?? 'Ошибка валидации');
      setLoading(false);
      return;
    }

    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout?bookingId=${bookingId}`,
      },
      redirect: 'if_required',
    });

    if (confirmErr) {
      setError(confirmErr.message ?? 'Ошибка оплаты');
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-0.5">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling || loading}
          className="flex-1 border border-gray-300 hover:border-red-300 hover:text-red-600 text-text/60 font-medium rounded-xl py-3 transition-colors disabled:opacity-50"
        >
          {cancelling ? 'Отмена…' : 'Отменить бронь'}
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-[2_1_0%] flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Обработка…</>
          ) : (
            <><CreditCard size={16} /> Оплатить {fmt(totalAmount)} {currency.toUpperCase()}</>
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Step 2: Confirmation + inline payment ────────────────────────────────────

type PaymentPhase =
  | 'idle'       // showing confirmation, waiting for button click
  | 'creating'   // POST /api/payments/create-intent in flight
  | 'ready'      // clientSecret received, Stripe form shown
  | 'submitted'  // stripe.confirmPayment called, waiting for WS
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'error';     // create-intent failed

interface Step2Props {
  room: Room;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomServices: RoomServiceEntry[];
  selections: Selections;
  guestData: GuestData;
  userId: string;
  onBack: () => void;
  onEditServices: () => void;
  onEditGuest: () => void;
}

function Step2Confirmation({
  room,
  checkIn,
  checkOut,
  nights,
  roomServices,
  selections,
  guestData,
  userId,
  onBack,
  onEditServices,
  onEditGuest,
}: Step2Props) {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<number>(0);
  const [currency, setCurrency] = useState<string>(CURRENCY_CODE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  // Distinguishes timer-expiry cancellation from user-initiated cancellation
  const [timerExpired, setTimerExpired] = useState(false);

  // Guard against double-click
  const creatingRef = useRef(false);
  // Guard against duplicate cancel calls
  const cancellingRef = useRef(false);
  // Keep bookingId accessible from timer callback without stale closures
  const bookingIdRef = useRef<string | null>(null);

  // ── Hold countdown ─────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback((expiry: Date) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const diff = expiry.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00');
        if (timerRef.current) clearInterval(timerRef.current);
        // Hold expired — show visual feedback only.
        // The SERVER handles actual hold expiration and booking cancellation
        // via the hold-expiry scheduler, then notifies us via WebSocket.
        setTimerExpired(true);
        setErrorMsg('Время резервации истекло. Номер освобождён.');
        setPhase('cancelled');
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  // Cleanup timer — declared before handleWsMessage so it can be referenced
  const cleanupTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── WS handler ────────────────────────────────────────────────────────────
  // Only react to terminal events for OUR booking. Non-terminal failures
  // (card declined) are handled inline by the Stripe form — no phase change.
  const handleWsMessage = useCallback((msg: WsMessage) => {
    // Ignore messages for other bookings
    if (msg.bookingId && msg.bookingId !== bookingIdRef.current) return;

    if (msg.type === 'PAYMENT_SUCCEEDED') {
      setPhase('succeeded');
    } else if (msg.type === 'PAYMENT_CANCELLED') {
      setPhase('cancelled');
    } else if (msg.type === 'HOLD_EXPIRED') {
      // Server-side hold expiration — authoritative decision
      cleanupTimer();
      setTimerExpired(true);
      setErrorMsg((msg.message as string) || 'Время резервации истекло. Номер освобождён.');
      setPhase('cancelled');
    }
    // PAYMENT_ATTEMPT_FAILED is non-terminal — Stripe form shows the error inline
  }, [cleanupTimer]);

  // Connect WS only during active payment phases
  useWebSocket({
    userId,
    enabled: phase === 'ready' || phase === 'submitted',
    onMessage: handleWsMessage,
  });

  // ── Create intent on button click ─────────────────────────────────────────
  const handleBook = async () => {
    if (creatingRef.current || phase !== 'idle') return;
    creatingRef.current = true;
    setPhase('creating');

    try {
      const result = await createPaymentIntent({
        roomNo: room.roomNo,
        checkIn,
        checkOut,
        selectedServices: selections,
        notes: guestData.notes || undefined,
        currency: CURRENCY_CODE,
      });

      setClientSecret(result.clientSecret);
      setBookingId(result.bookingId);
      bookingIdRef.current = result.bookingId;
      setServerTotal(result.totalAmount);
      setCurrency(result.currency);
      const expiry = result.expiresAt
        ? new Date(result.expiresAt)
        : new Date(Date.now() + 5 * 60 * 1000);
      startTimer(expiry);
      setPhase('ready');
    } catch (err) {
      let msg = 'Не удалось создать бронь. Попробуйте ещё раз.';
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const serverMsg: string = err.response?.data?.error ?? '';
        if (status === 409) {
          if (serverMsg.includes('currently being reserved')) {
            msg =
              'Номер сейчас заблокирован другим пользователем для оплаты. ' +
              'Пожалуйста, подождите несколько минут и попробуйте снова.';
          } else if (serverMsg.includes('already booked')) {
            msg =
              'Номер уже забронирован на выбранные даты. ' +
              'Пожалуйста, выберите другие даты или другой номер.';
          } else {
            msg =
              'Номер недоступен для бронирования на выбранные даты. ' +
              'Пожалуйста, выберите другой номер или измените даты.';
          }
        }
      }
      setErrorMsg(msg);
      setPhase('error');
    } finally {
      creatingRef.current = false;
    }
  };

  // ── Cancel booking ────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (cancellingRef.current) return;
    cancellingRef.current = true;
    cleanupTimer();
    if (!bookingId) { setPhase('cancelled'); cancellingRef.current = false; return; }
    setCancelling(true);
    try {
      await cancelBooking(bookingId);
    } catch {
      // ignore — treat as cancelled either way
    } finally {
      setCancelling(false);
      cancellingRef.current = false;
      setPhase('cancelled');
    }
  };

  // ── Active services for read-only display ─────────────────────────────────
  // INCLUDED: always present, cost in basePrice. OPTIONAL: user-selected, charged extra.
  const includedServices = roomServices.filter(
    (rs) => rs.defaultState === 'INCLUDED' && rs.service?.isActive,
  );
  const activeServices = roomServices.filter(
    (rs) => rs.defaultState !== 'INCLUDED' && selections[rs.serviceCode] && rs.service?.isActive,
  );

  // ── Terminal states ───────────────────────────────────────────────────────
  if (phase === 'succeeded') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={36} className="text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-text">Бронирование подтверждено!</h3>
        <p className="text-sm text-text/60 max-w-sm">
          Подтверждение отправлено на <strong>{guestData.email}</strong>.
          {bookingId && (
            <> Номер брони: <code className="bg-gray-100 px-1 rounded text-xs">{bookingId.slice(0, 8)}…</code></>
          )}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 bg-primary text-white font-semibold rounded-xl px-8 py-3 hover:bg-primary/90 transition-colors"
        >
          На главную
        </button>
      </div>
    );
  }

  if (phase === 'cancelled') {
    const handleRebook = () => {
      // Reset all payment state and go back to the confirmation summary
      setPhase('idle');
      setClientSecret(null);
      setBookingId(null);
      bookingIdRef.current = null;
      setServerTotal(0);
      setErrorMsg(null);
      setTimerExpired(false);
      setTimeLeft('');
      creatingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };

    if (timerExpired) {
      return (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock size={32} className="text-amber-500" />
          </div>
          <h3 className="font-semibold text-text">Время резервации истекло</h3>
          <p className="text-sm text-text/60 max-w-sm">
            Номер был освобождён, так как оплата не поступила в отведённое время.
            Вы можете попробовать забронировать снова — все введённые данные сохранены.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full max-w-xs">
            <button
              onClick={handleRebook}
              className="flex-1 bg-primary text-white font-semibold rounded-xl px-6 py-3 hover:bg-primary/90 transition-colors"
            >
              Забронировать снова
            </button>
            <button
              onClick={() => navigate('/rooms')}
              className="flex-1 border border-gray-300 text-text/70 font-medium rounded-xl px-6 py-3 hover:border-gray-400 transition-colors"
            >
              К номерам
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <XCircle size={40} className="text-gray-400" />
        <h3 className="font-semibold text-text">Бронирование отменено</h3>
        <p className="text-sm text-text/60">Номер освобождён и снова доступен для бронирования.</p>
        <button
          onClick={() => navigate('/rooms')}
          className="mt-2 bg-primary text-white font-semibold rounded-xl px-8 py-3 hover:bg-primary/90"
        >
          К списку номеров
        </button>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <XCircle size={36} className="text-red-500" />
          <h3 className="font-semibold text-text">Произошла ошибка</h3>
          <p className="text-sm text-text/60">{errorMsg}</p>
        </div>
        <button
          onClick={() => navigate('/rooms')}
          className="w-full border border-gray-300 text-text/70 rounded-xl py-3 hover:border-gray-400 transition-colors"
        >
          К номерам
        </button>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Booking details (always read-only) ── */}
      <div className="space-y-4">

        {/* Dates */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CalendarDays size={18} className="text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-text/50 uppercase tracking-wider mb-1">Даты проживания</p>
              <p className="text-sm font-medium text-text">
                {formatDate(checkIn)} — {formatDate(checkOut)}
              </p>
              <p className="text-xs text-text/50 mt-0.5">{nightsLabel(nights)}</p>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-primary flex-shrink-0" />
              <p className="text-xs font-bold text-text/50 uppercase tracking-wider">Услуги</p>
            </div>
            {phase === 'idle' && (
              <button
                onClick={onEditServices}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Pencil size={11} /> Изменить
              </button>
            )}
          </div>
          {includedServices.length === 0 && activeServices.length === 0 ? (
            <p className="text-sm text-text/50">Дополнительные услуги не выбраны</p>
          ) : (
            <div className="space-y-1.5">
              {includedServices.map((rs) => (
                <div key={rs.serviceCode} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0">
                      {getFeatureIcon({ iconUrl: rs.service.iconUrl, icon: rs.service.icon, size: 14, className: 'text-primary' })}
                    </span>
                    <span className="text-text/80">{rs.service.title}</span>
                  </div>
                  <span className="text-green-600 text-xs font-medium">Включено</span>
                </div>
              ))}
              {includedServices.length > 0 && activeServices.length > 0 && (
                <div className="border-t border-gray-200 my-1" />
              )}
              {activeServices.map((rs) => {
                const price = rs.service.basePrice ?? 0;
                const lineTotal = rs.service.priceType === 'PER_NIGHT' ? price * nights : price;
                return (
                  <div key={rs.serviceCode} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0">
                        {getFeatureIcon({ iconUrl: rs.service.iconUrl, icon: rs.service.icon, size: 14, className: 'text-primary' })}
                      </span>
                      <span className="text-text/80">{rs.service.title}</span>
                    </div>
                    <span className="text-text/60 text-xs">{fmt(lineTotal)} {CURRENCY_SYMBOL}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Guest info */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <User size={16} className="text-primary flex-shrink-0" />
              <p className="text-xs font-bold text-text/50 uppercase tracking-wider">Данные гостя</p>
            </div>
            {phase === 'idle' && (
              <button
                onClick={onEditGuest}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Pencil size={11} /> Изменить
              </button>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User size={13} className="text-text/40 flex-shrink-0" />
              <span className="text-text font-medium">{guestData.firstName} {guestData.lastName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-text/40 flex-shrink-0" />
              <span className="text-text/70">{guestData.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={13} className="text-text/40 flex-shrink-0" />
              <span className="text-text/70">{guestData.email}</span>
            </div>
            {guestData.notes && (
              <div className="flex items-start gap-2">
                <FileText size={13} className="text-text/40 flex-shrink-0 mt-0.5" />
                <span className="text-text/60 italic">{guestData.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Price breakdown */}
        <PriceBreakdown
          room={room}
          roomServices={roomServices}
          selections={selections}
          nights={nights}
          compact
        />
      </div>

      {/* ── Book button (only when idle) ── */}
      {phase === 'idle' && (
        <div className="space-y-3">
          <button
            onClick={handleBook}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl py-4 text-base transition-colors shadow-sm"
          >
            <CreditCard size={18} /> Забронировать и оплатить
          </button>
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-text/60 font-medium rounded-xl py-3 transition-colors"
          >
            <ArrowLeft size={15} /> Назад
          </button>
        </div>
      )}

      {/* ── Creating intent ── */}
      {phase === 'creating' && (
        <div className="flex items-center justify-center gap-3 py-6 text-text/60">
          <Loader2 size={22} className="animate-spin text-primary" />
          <span className="text-sm">Создаём бронь и резервируем номер…</span>
        </div>
      )}

      {/* ── Create-intent failed ── */}
      {phase === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Не удалось создать бронь</p>
              <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 border border-gray-300 text-text/70 rounded-xl py-3 hover:border-gray-400 transition-colors"
            >
              Назад
            </button>
            <button
              onClick={() => { setPhase('idle'); setErrorMsg(null); creatingRef.current = false; }}
              className="flex-1 bg-primary text-white rounded-xl py-3 font-medium hover:bg-primary/90 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      )}

      {/* ── Stripe payment form (ready / submitted) ── */}
      {(phase === 'ready' || phase === 'submitted') && clientSecret && (
        <div className="space-y-4">
          {/* Hold timer */}
          {timeLeft && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <Clock size={15} className="flex-shrink-0" />
              <span>
                Номер зарезервирован. Осталось:{' '}
                <strong className="font-mono">{timeLeft}</strong>
              </span>
            </div>
          )}

          {/* Amount to pay */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
            <span className="text-sm text-text/60">К оплате</span>
            <span className="text-xl font-bold text-primary">
              {fmt(serverTotal)} {currency.toUpperCase()}
            </span>
          </div>

          {phase === 'submitted' ? (
            <div className="flex items-center justify-center gap-3 py-6 text-text/60">
              <Loader2 size={22} className="animate-spin text-primary" />
              <span className="text-sm">Ожидаем подтверждения оплаты…</span>
            </div>
          ) : (
            <Elements
              stripe={getStripePromise()}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#6366f1',
                    borderRadius: '8px',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  },
                },
              }}
            >
              <StripeCheckoutForm
                totalAmount={serverTotal}
                currency={currency}
                bookingId={bookingId ?? ''}
                onSuccess={() => setPhase('submitted')}
                onCancel={handleCancel}
                cancelling={cancelling}
              />
            </Elements>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const state = location.state as CheckoutState | null;

  if (!state?.room || !state?.checkInDate || !state?.checkOutDate) {
    navigate('/rooms', { replace: true });
    return null;
  }

  const { room, checkInDate, checkOutDate } = state;
  const roomServices: RoomServiceEntry[] = room.roomServices ?? [];
  const nights = calcNights(checkInDate, checkOutDate);

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [selections, setSelections] = useState<Selections>(() =>
    buildInitialSelections(roomServices),
  );
  const handleToggle = useCallback(
    (code: string) => setSelections((prev) => ({ ...prev, [code]: !prev[code] })),
    [],
  );

  const [guestData, setGuestData] = useState<GuestData>({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    notes: '',
  });
  const handleGuestChange = useCallback(
    (field: keyof GuestData, value: string) => setGuestData((p) => ({ ...p, [field]: value })),
    [],
  );

  // Step label for the title
  const stepTitles = [
    <span key="s" className="flex items-center justify-center gap-2"><Settings size={20} /> Выбор услуг</span>,
    <span key="g" className="flex items-center justify-center gap-2"><User size={20} /> Данные гостя</span>,
    <span key="p" className="flex items-center justify-center gap-2"><CreditCard size={20} /> Подтверждение и оплата</span>,
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Back */}
        <button
          onClick={() => (step === 0 ? navigate(-1) : setStep((s) => (s - 1) as 0 | 1 | 2))}
          className="flex items-center gap-2 text-sm text-text/50 hover:text-text transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          {step === 0 ? 'Назад к номеру' : 'Назад'}
        </button>

        {/* Room summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-4">
            {room.images?.[0] && (
              <img
                src={resolveImageUrl(room.images[0].imageUrl)}
                alt={room.title}
                className="w-20 h-16 object-cover rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-text truncate">{room.title}</h2>
              <p className="text-sm text-text/50 mt-0.5">
                {room.hotel?.name ?? 'Moonglow Hotel'}
                {room.hotel?.city ? ` · ${room.hotel.city}` : ''}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-text/50">
                <span>{formatDate(checkInDate)} — {formatDate(checkOutDate)}</span>
                <span>·</span>
                <span>{nightsLabel(nights)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step title */}
        <h1 className="text-xl font-bold text-text mb-6 text-center">{stepTitles[step]}</h1>

        {/* Content */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          {step === 0 && (
            <Step0Services
              room={room}
              roomServices={roomServices}
              selections={selections}
              nights={nights}
              onToggle={handleToggle}
              onNext={() => setStep(1)}
            />
          )}

          {step === 1 && (
            <Step1GuestInfo
              data={guestData}
              onChange={handleGuestChange}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && user && (
            <Step2Confirmation
              room={room}
              checkIn={checkInDate}
              checkOut={checkOutDate}
              nights={nights}
              roomServices={roomServices}
              selections={selections}
              guestData={guestData}
              userId={user.id}
              onBack={() => setStep(1)}
              onEditServices={() => setStep(0)}
              onEditGuest={() => setStep(1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
