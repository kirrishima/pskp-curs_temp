/**
 * QRLoginPage.tsx
 *
 * Two modes:
 *  - "generate" — for logged-in users: generates a one-time QR code so another
 *    device can scan it to log in without entering credentials.
 *  - "scan"     — for guests on the login page: opens the camera, reads the QR
 *    code and exchanges it for tokens.
 */

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Camera, RefreshCw, CheckCircle, X } from "lucide-react";
import api from "@/api/axiosInstance";
import useAppDispatch from "@/hooks/useAppDispatch";
import { loginSuccess } from "@/store/slices/authSlice";
import Button from "@/components/ui/Button";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a Google Charts QR image URL for a given text. */
function qrImageUrl(text: string, size = 220): string {
  return `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encodeURIComponent(text)}&choe=UTF-8`;
}

/** Format remaining seconds as MM:SS */
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── QR Generate panel ───────────────────────────────────────────────────────

const QRGeneratePanel = memo(function QRGeneratePanel() {
  const [code, setCode] = useState<string | null>(null);
  const [secondsLeft, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    setDone(false);
    try {
      const { data } = await api.post("/qr/generate");
      setCode(data.code);
      const exp = new Date(data.expiresAt);
      const secs = Math.max(0, Math.round((exp.getTime() - Date.now()) / 1000));
      setSeconds(secs);
    } catch (err: any) {
      setError(err.response?.data?.error || "Не удалось создать QR-код");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-generate on mount
  useEffect(() => {
    generate();
  }, [generate]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const expired = secondsLeft <= 0 && code !== null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-2 text-text/60 text-sm">
        <QrCode size={16} className="text-primary" />
        <span>Покажите этот код другому устройству для входа</span>
      </div>

      {/* QR image */}
      <div className="relative">
        {code && (
          <img
            src={qrImageUrl(code)}
            alt="QR code"
            width={220}
            height={220}
            className={[
              "rounded-xl border-2 border-primary/20 transition-opacity duration-300",
              expired ? "opacity-20" : "opacity-100",
            ].join(" ")}
          />
        )}
        {!code && !error && (
          <div className="w-[220px] h-[220px] rounded-xl bg-gray-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {expired && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium text-text/60">Код истёк</p>
          </div>
        )}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
            <CheckCircle size={48} className="text-green-500" />
          </div>
        )}
      </div>

      {/* Timer */}
      {code && !expired && (
        <p className="text-sm text-text/50">
          Действителен ещё:{" "}
          <span className={["font-mono font-semibold", secondsLeft <= 15 ? "text-red-500" : "text-primary"].join(" ")}>
            {fmtTime(secondsLeft)}
          </span>
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button
        variant="secondary"
        onClick={generate}
        isLoading={loading}
        icon={<RefreshCw size={16} />}
        className="w-full"
      >
        {expired ? "Обновить код" : "Новый код"}
      </Button>
    </div>
  );
});

// ─── QR Scan panel ───────────────────────────────────────────────────────────

const QRScanPanel = memo(function QRScanPanel({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [cameraErr, setCamErr] = useState("");

  // ── jsQR via dynamic import from CDN ──────────────────────────────────
  // We load jsQR at runtime via a script tag to avoid npm dependency.
  const jsQRRef = useRef<any>(null);

  useEffect(() => {
    // Try to load jsQR from CDN once
    if ((window as any).jsQR) {
      jsQRRef.current = (window as any).jsQR;
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
    script.onload = () => {
      jsQRRef.current = (window as any).jsQR;
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleCodeFound = useCallback(
    async (rawCode: string) => {
      stopCamera();
      setStatus("scanning");
      setError("");
      try {
        const { data } = await api.post("/qr/consume", { code: rawCode });
        dispatch(
          loginSuccess({
            user: data.user,
            tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
          }),
        );
        setStatus("success");
        setTimeout(() => navigate("/", { replace: true }), 800);
      } catch (err: any) {
        setError(err.response?.data?.error || "Неверный или истёкший QR-код");
        setStatus("error");
      }
    },
    [dispatch, navigate, stopCamera],
  );

  const startCamera = useCallback(async () => {
    setCamErr("");
    setError("");
    setStatus("idle");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const scan = () => {
        if (!jsQRRef.current || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(scan);
          return;
        }
        const canvas = canvasRef.current!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQRRef.current(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (result?.data) {
          handleCodeFound(result.data);
          return;
        }
        rafRef.current = requestAnimationFrame(scan);
      };

      rafRef.current = requestAnimationFrame(scan);
    } catch (err: any) {
      console.error("Camera error:", err?.name, err?.message, err);
      setCamErr(`Нет доступа к камере: ${err?.name || "UnknownError"} — ${err?.message || ""}`);
    }
  }, [handleCodeFound]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 text-text/60 text-sm text-center">
        <Camera size={16} className="text-primary flex-shrink-0" />
        <span>Наведите камеру на QR-код с другого устройства</span>
      </div>

      {/* Video preview */}
      <div className="relative w-[240px] h-[240px] rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning overlay */}
        {!cameraErr && status !== "success" && status !== "error" && streamRef.current && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner marks */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-sm" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-sm" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-sm" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-sm" />
            {/* Scanning line */}
            <div className="absolute inset-x-6 top-1/2 h-0.5 bg-primary/60 animate-pulse" />
          </div>
        )}

        {/* Success overlay */}
        {status === "success" && (
          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
            <CheckCircle size={56} className="text-green-500" />
          </div>
        )}

        {/* No camera state */}
        {!streamRef.current && status !== "success" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera size={40} className="text-white/30" />
          </div>
        )}
      </div>

      {cameraErr && <p className="text-sm text-red-500 text-center">{cameraErr}</p>}
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      {status === "success" && <p className="text-sm text-green-600">Вход выполнен!</p>}

      <div className="flex gap-3 w-full">
        <Button variant="tertiary" onClick={onClose} className="flex-shrink-0">
          <X size={18} />
        </Button>
        {status !== "success" && (
          <Button
            onClick={startCamera}
            isLoading={status === "scanning"}
            icon={<Camera size={18} />}
            className="flex-1"
          >
            {streamRef.current ? "Перезапустить" : "Открыть камеру"}
          </Button>
        )}
      </div>
    </div>
  );
});

// ─── Public export: modal-like overlay for LoginPage ─────────────────────────

export const QRScanModal = memo(function QRScanModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-text text-center mb-4">Вход по QR-коду</h3>
        <QRScanPanel onClose={onClose} />
      </div>
    </div>
  );
});

// ─── Public export: panel for ProfilePage / authenticated users ───────────────

export const QRGenerateModal = memo(function QRGenerateModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">QR-вход на другом устройстве</h3>
          <button onClick={onClose} className="text-text/40 hover:text-text/70 transition-colors" aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        <QRGeneratePanel />
      </div>
    </div>
  );
});
