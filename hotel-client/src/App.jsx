import { useState, useEffect, useCallback, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = "/api";
const WS_URL = "ws://localhost:3001/ws";

// Загружаем publishable key с сервера один раз при старте приложения.
// Промис создаётся один раз на уровне модуля — важно чтобы Elements
// всегда получал одну и ту же ссылку (иначе Stripe ругается).
const stripePromise = fetch(`${API_BASE}/payments/config`)
  .then(r => r.json())
  .then(({ stripePublishableKey }) => loadStripe(stripePublishableKey))
  .catch(() => null);

// ─── WebSocket hook ───────────────────────────────────────────────────────────
function useWebSocket({ onMessage, enabled, onStatusChange }) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => { onStatusChange?.("connected"); };
      ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (_) {} };
      ws.onclose = () => {
        onStatusChange?.("disconnected");
        reconnectTimer.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    } catch (_) {}
  }, [enabled, onMessage, onStatusChange]);

  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); };
  }, [connect]);
}

// ─── API helper ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, accessToken = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          padding: "12px 18px", borderRadius: 8, fontWeight: 500, fontSize: 14,
          background: t.type === "error" ? "#ef4444" : t.type === "success" ? "#22c55e" : "#3b82f6",
          color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", maxWidth: 320,
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Auth form ────────────────────────────────────────────────────────────────
function AuthForm({ onAuth, addToast }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      addToast(mode === "login" ? "Вход выполнен!" : "Аккаунт создан!", "success");
      onAuth(data.user, data.accessToken);
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.card}>
      <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>
        {mode === "login" ? "Вход в аккаунт" : "Регистрация"}
      </h2>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required />
        </div>
        <div>
          <label style={s.label}>Пароль</label>
          <input style={s.input} type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button style={{ ...s.btn, background: "#6366f1" }} type="submit" disabled={loading}>
          {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14, textAlign: "center", color: "#94a3b8" }}>
        {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
        <button onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontWeight: 600 }}>
          {mode === "login" ? "Зарегистрироваться" : "Войти"}
        </button>
      </p>
    </div>
  );
}

// ─── Room card ────────────────────────────────────────────────────────────────
function RoomCard({ room, onBook, loading }) {
  return (
    <div style={{
      ...s.card, padding: "18px 20px",
      opacity: room.locked ? 0.55 : 1,
      border: `1.5px solid ${room.locked ? "#475569" : "#6366f1"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>№ {room.number} — {room.name}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: "#818cf8" }}>
            ${(room.pricePerNight / 100).toFixed(2)}
            <span style={{ fontSize: 13, fontWeight: 400, color: "#94a3b8" }}> / ночь</span>
          </div>
        </div>
        <span style={{
          padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: room.locked ? "#1e293b" : "#1e3a5f",
          color: room.locked ? "#94a3b8" : "#60a5fa",
          border: `1px solid ${room.locked ? "#334155" : "#3b82f6"}`,
        }}>
          {room.locked ? "Занято" : "Свободно"}
        </span>
      </div>
      <button
        style={{
          ...s.btn, marginTop: 14, width: "100%",
          background: room.locked ? "#334155" : "#6366f1",
          cursor: room.locked ? "not-allowed" : "pointer",
        }}
        onClick={() => onBook(room)}
        disabled={room.locked || loading}
      >
        {loading ? "Создание брони..." : room.locked ? "Недоступно" : "Забронировать"}
      </button>
    </div>
  );
}

// ─── Booking status card ──────────────────────────────────────────────────────
function BookingCard({ booking, onCancel, loadingCancel }) {
  const statusColor = { PENDING: "#f59e0b", CONFIRMED: "#22c55e", CANCELLED: "#ef4444" }[booking.status] || "#94a3b8";
  return (
    <div style={{ ...s.card, border: `1.5px solid ${statusColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Текущая бронь</h3>
        <span style={{
          padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: statusColor + "22", color: statusColor, border: `1px solid ${statusColor}`,
        }}>
          {booking.status}
        </span>
      </div>
      <div style={s.row}><span style={s.lbl}>Комната</span><span>{booking.room?.number} — {booking.room?.name}</span></div>
      <div style={s.row}><span style={s.lbl}>Сумма</span><span>${((booking.payment?.amount || 0) / 100).toFixed(2)} {(booking.payment?.currency || "usd").toUpperCase()}</span></div>
      <div style={s.row}><span style={s.lbl}>Booking ID</span><span style={{ fontSize: 11, color: "#94a3b8", wordBreak: "break-all" }}>{booking.id}</span></div>
      <div style={s.row}><span style={s.lbl}>Stripe PI</span><span style={{ fontSize: 11, color: "#94a3b8", wordBreak: "break-all" }}>{booking.payment?.stripePaymentIntentId}</span></div>
      <div style={s.row}><span style={s.lbl}>Статус оплаты</span><span>{booking.payment?.status || "—"}</span></div>
      {booking.status === "PENDING" && (
        <button style={{ ...s.btn, background: "#ef4444", width: "100%", marginTop: 14 }}
          onClick={() => onCancel(booking.id)} disabled={loadingCancel}>
          {loadingCancel ? "Отмена..." : "Отменить бронирование"}
        </button>
      )}
    </div>
  );
}

// ─── Stripe checkout form (внутри Elements) ───────────────────────────────────
function StripeCheckoutForm({ amount, currency, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message);
      setLoading(false);
      return;
    }

    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // После редиректа (если нужен 3DS) вернёмся на текущую страницу
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (confirmErr) {
      setError(confirmErr.message);
      setLoading(false);
    } else {
      // Оплата прошла без редиректа — сообщаем родителю
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: "4px 0" }}>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 6, background: "#450a0a", border: "1px solid #dc2626", color: "#fca5a5", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ padding: 10, borderRadius: 6, background: "#1e3a2f", border: "1px solid #166534", fontSize: 12, color: "#86efac" }}>
        🧪 Тестовая карта: <strong>4242 4242 4242 4242</strong> · любой срок · любой CVC
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={onClose}
          style={{ ...s.btn, flex: 1, background: "#1e293b", border: "1px solid #334155" }}>
          Отмена
        </button>
        <button type="submit" disabled={!stripe || loading}
          style={{ ...s.btn, flex: 2, background: loading ? "#334155" : "#22c55e", fontWeight: 700 }}>
          {loading ? "Обработка..." : `Оплатить $${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`}
        </button>
      </div>
    </form>
  );
}

// ─── Payment modal (обёртка с Elements) ──────────────────────────────────────
function PaymentModal({ intent, onSuccess, onClose }) {
  const appearance = {
    theme: "night",
    variables: {
      colorPrimary: "#6366f1",
      colorBackground: "#0f172a",
      colorText: "#e2e8f0",
      colorDanger: "#ef4444",
      borderRadius: "8px",
    },
  };

  // Elements принимает Promise<Stripe> напрямую и ждёт его сам
  return (
    <div style={s.overlay}>
      <div style={{ ...s.card, width: 440, maxWidth: "95vw", position: "relative" }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 16,
          background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer",
        }}>✕</button>

        <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>💳 Оплата</h3>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          Бронь <span style={{ color: "#94a3b8" }}>{intent.bookingId?.slice(0, 8)}…</span>
        </p>

        <Elements
          stripe={stripePromise}
          options={{ clientSecret: intent.clientSecret, appearance }}
        >
          <StripeCheckoutForm
            amount={intent.amount}
            currency={intent.currency || "usd"}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        </Elements>
      </div>
    </div>
  );
}

// ─── Add room form (dev helper) ───────────────────────────────────────────────
function AddRoomForm({ accessToken, onCreated, addToast }) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/payments/rooms", {
        method: "POST",
        body: JSON.stringify({ number, name, pricePerNight: Math.round(parseFloat(price) * 100) }),
      }, accessToken);
      addToast(`Комната №${number} создана!`, "success");
      setNumber(""); setName(""); setPrice("");
      setOpen(false);
      onCreated();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return (
    <button style={{ ...s.btn, background: "#1e293b", border: "1px solid #334155", fontSize: 13 }} onClick={() => setOpen(true)}>
      ＋ Добавить комнату
    </button>
  );

  return (
    <div style={{ ...s.card, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <strong>Новая комната (dev)</strong>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>✕</button>
      </div>
      <form onSubmit={submit} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 80px" }}>
          <label style={s.label}>Номер</label>
          <input style={s.input} value={number} onChange={e => setNumber(e.target.value)} placeholder="101" required />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label style={s.label}>Название</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Deluxe Suite" required />
        </div>
        <div style={{ flex: "0 0 120px" }}>
          <label style={s.label}>Цена ($)</label>
          <input style={s.input} type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="99.00" required />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button style={{ ...s.btn, background: "#6366f1" }} type="submit" disabled={loading}>
            {loading ? "..." : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [booking, setBooking] = useState(null);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingBook, setLoadingBook] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [tab, setTab] = useState("rooms");
  const [wsStatus, setWsStatus] = useState("disconnected");
  const accessTokenRef = useRef(null);
  const bookingRef = useRef(null);

  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { bookingRef.current = booking; }, [booking]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);

  const loadRooms = useCallback(async (token) => {
    setLoadingRooms(true);
    try {
      const d = await apiFetch("/payments/rooms", {}, token);
      setRooms(d.rooms || []);
    } catch (err) {
      addToast("Ошибка загрузки комнат: " + err.message, "error");
    } finally {
      setLoadingRooms(false);
    }
  }, [addToast]);

  // ── WebSocket handler ──────────────────────────────────────────────────────
  const handleWsMessage = useCallback((data) => {
    const token = accessTokenRef.current;
    const currentBooking = bookingRef.current;

    if (data.type === "PAYMENT_SUCCEEDED") {
      addToast("✅ Оплата подтверждена! Бронь активна.", "success");
      setPaymentIntent(null);
      if (currentBooking && token) {
        apiFetch(`/payments/${currentBooking.id}`, {}, token)
          .then(d => setBooking(d.booking)).catch(() => {});
      }
      if (token) loadRooms(token);
    } else if (data.type === "PAYMENT_FAILED") {
      addToast("❌ Платёж не прошёл. Бронь отменена.", "error");
      if (currentBooking) setBooking(p => ({ ...p, status: "CANCELLED" }));
      setPaymentIntent(null);
      if (token) loadRooms(token);
    } else if (data.type === "PAYMENT_CANCELLED") {
      addToast("Бронирование отменено.", "info");
      if (currentBooking) setBooking(p => ({ ...p, status: "CANCELLED" }));
      setPaymentIntent(null);
      if (token) loadRooms(token);
    }
  }, [addToast, loadRooms]);

  useWebSocket({ onMessage: handleWsMessage, enabled: !!user, onStatusChange: setWsStatus });

  // Auto-login
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    apiFetch("/auth/me", {}, token)
      .then(d => { setUser(d.user); setAccessToken(token); loadRooms(token); })
      .catch(() => { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); });
  }, [loadRooms]);

  function handleAuth(u, token) {
    setUser(u); setAccessToken(token); loadRooms(token);
  }

  async function handleLogout() {
    try { await apiFetch("/auth/revoke", { method: "POST" }, accessToken); } catch (_) {}
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null); setAccessToken(null); setRooms([]);
    setBooking(null); setPaymentIntent(null);
    addToast("Вы вышли из аккаунта", "info");
  }

  async function handleBook(room) {
    setLoadingBook(true);
    try {
      const data = await apiFetch("/payments/create-intent", {
        method: "POST",
        body: JSON.stringify({ roomId: room.id }),
      }, accessToken);
      setPaymentIntent(data);
      setRooms(p => p.map(r => r.id === room.id ? { ...r, locked: true } : r));
      const bData = await apiFetch(`/payments/${data.bookingId}`, {}, accessToken);
      setBooking(bData.booking);
      addToast("Бронь создана! Перейдите к оплате.", "success");
      setTab("booking");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoadingBook(false);
    }
  }

  async function handleCancel(bookingId) {
    setLoadingCancel(true);
    try {
      await apiFetch(`/payments/cancel/${bookingId}`, { method: "POST" }, accessToken);
      addToast("Бронирование отменено", "info");
      setBooking(p => ({ ...p, status: "CANCELLED" }));
      setPaymentIntent(null);
      loadRooms(accessToken);
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoadingCancel(false);
    }
  }

  function handlePaymentSuccess() {
    setPaymentIntent(null);
    addToast("Платёж отправлен! Ожидаем подтверждение Stripe.", "success");
    // Статус обновится автоматически через WebSocket (PAYMENT_SUCCEEDED)
    // Но на всякий случай перезагружаем через 3 секунды
    setTimeout(() => {
      if (bookingRef.current && accessTokenRef.current) {
        apiFetch(`/payments/${bookingRef.current.id}`, {}, accessTokenRef.current)
          .then(d => setBooking(d.booking)).catch(() => {});
      }
    }, 3000);
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={s.page}>
        <Toast toasts={toasts} />
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏨</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>Hotel Test Client</h1>
          <p style={{ color: "#64748b", marginTop: 6, fontSize: 14 }}>Express.js + Stripe · localhost:3001</p>
        </div>
        <AuthForm onAuth={handleAuth} addToast={addToast} />
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <Toast toasts={toasts} />

      {paymentIntent && (
        <PaymentModal
          intent={paymentIntent}
          onSuccess={handlePaymentSuccess}
          onClose={() => setPaymentIntent(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>🏨 Hotel Test Client</h1>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Вошли как <strong style={{ color: "#818cf8" }}>{user.email}</strong>
            <span style={{ fontSize: 11, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, padding: "1px 6px", color: "#94a3b8" }}>
              id: {user.id?.slice(0, 8)}…
            </span>
            <span style={{
              fontSize: 11, borderRadius: 4, padding: "1px 8px", fontWeight: 600,
              background: wsStatus === "connected" ? "#14532d" : "#1e293b",
              color: wsStatus === "connected" ? "#86efac" : "#64748b",
              border: `1px solid ${wsStatus === "connected" ? "#166534" : "#334155"}`,
            }}>
              {wsStatus === "connected" ? "● WS" : "○ WS"}
            </span>
          </div>
        </div>
        <button style={{ ...s.btn, background: "#1e293b", border: "1px solid #334155", fontSize: 13 }} onClick={handleLogout}>
          Выйти
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#0f172a", borderRadius: 10, padding: 4 }}>
        {[["rooms", "🏠  Комнаты"], ["booking", "📋  Бронирование"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 14, transition: "all 0.15s",
            background: tab === key ? "#6366f1" : "transparent",
            color: tab === key ? "#fff" : "#64748b",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Rooms tab ── */}
      {tab === "rooms" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>Доступные комнаты</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <AddRoomForm accessToken={accessToken} onCreated={() => loadRooms(accessToken)} addToast={addToast} />
              <button style={{ ...s.btn, fontSize: 13, padding: "8px 14px", background: "#1e293b", border: "1px solid #334155" }}
                onClick={() => loadRooms(accessToken)}>
                🔄 Обновить
              </button>
            </div>
          </div>

          {loadingRooms ? (
            <div style={{ color: "#64748b", textAlign: "center", padding: 48 }}>Загрузка…</div>
          ) : rooms.length === 0 ? (
            <div style={{ ...s.card, textAlign: "center", color: "#64748b" }}>
              <p style={{ fontSize: 15 }}>Комнат пока нет.</p>
              <p style={{ fontSize: 13 }}>Нажмите «+ Добавить комнату» чтобы создать первую.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 16 }}>
              {rooms.map(room => (
                <RoomCard key={room.id} room={room} onBook={handleBook} loading={loadingBook} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Booking tab ── */}
      {tab === "booking" && (
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Бронирование</h2>
          {booking ? (
            <>
              <BookingCard booking={booking} onCancel={handleCancel} loadingCancel={loadingCancel} />

              {paymentIntent && booking.status === "PENDING" && (
                <button
                  style={{ ...s.btn, background: "#6366f1", width: "100%", marginTop: 12, fontSize: 15 }}
                  onClick={() => setPaymentIntent(paymentIntent)}
                >
                  💳 Открыть форму оплаты
                </button>
              )}

              <button
                style={{ ...s.btn, background: "#1e293b", border: "1px solid #334155", width: "100%", marginTop: 10, fontSize: 13 }}
                onClick={async () => {
                  try {
                    const d = await apiFetch(`/payments/${booking.id}`, {}, accessToken);
                    setBooking(d.booking);
                    addToast("Статус обновлён", "success");
                  } catch (e) { addToast(e.message, "error"); }
                }}>
                🔄 Обновить статус
              </button>
            </>
          ) : (
            <div style={{ ...s.card, textAlign: "center", color: "#64748b" }}>
              <p style={{ fontSize: 15 }}>Нет активных бронирований.</p>
              <p style={{ fontSize: 13 }}>Выберите комнату на вкладке «Комнаты»</p>
              <button style={{ ...s.btn, background: "#6366f1", marginTop: 14 }} onClick={() => setTab("rooms")}>
                Перейти к комнатам →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    padding: "40px 24px",
    maxWidth: 960,
    margin: "0 auto",
  },
  card: {
    background: "#1e293b",
    borderRadius: 14,
    padding: 24,
    border: "1.5px solid #334155",
    boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
  },
  input: {
    width: "100%", boxSizing: "border-box",
    background: "#0f172a", border: "1.5px solid #334155", borderRadius: 8,
    color: "#e2e8f0", padding: "10px 12px", fontSize: 14, marginTop: 4, outline: "none",
  },
  label: { fontSize: 13, color: "#94a3b8", fontWeight: 500 },
  lbl: { fontSize: 13, color: "#64748b", minWidth: 110 },
  btn: {
    padding: "10px 20px", borderRadius: 8, border: "none",
    color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
  },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "7px 0", borderBottom: "1px solid #0f172a", fontSize: 14,
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
  },
};
