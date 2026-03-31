/**
 * QRLoginPage.tsx
 *
 * Two modals for the reversed QR login flow:
 *
 *  - QRDisplayModal — for the LOGIN page (PC): generates a QR session code,
 *    displays it on screen, and polls the server until the phone approves.
 *    Once approved the PC receives tokens and logs in automatically.
 *
 *  - QRApproveModal — for the PROFILE page (phone, already logged in): opens
 *    the camera, scans the QR code shown on the PC, and sends an approval
 *    request to the server.
 */

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Camera, RefreshCw, CheckCircle, X, ShieldCheck, Loader2 } from "lucide-react";
import api from "@/api/axiosInstance";
import useAppDispatch from "@/hooks/useAppDispatch";
import { loginSuccess } from "@/store/slices/authSlice";
import Button from "@/components/ui/Button";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format remaining seconds as MM:SS */
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Styled QR Code (qr-code-styling via CDN) ────────────────────────────────

const QR_LIB_SRC = "https://cdn.jsdelivr.net/npm/qr-code-styling@1.6.0-rc.1/lib/qr-code-styling.js";
const QR_SCRIPT_ID = "qr-code-styling-cdn";

function ensureQrLibLoaded(): Promise<void> {
  if ((window as any).QRCodeStyling) return Promise.resolve();
  const existing = document.getElementById(QR_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if ((window as any).QRCodeStyling) {
          clearInterval(check);
          resolve();
        }
      }, 40);
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = QR_SCRIPT_ID;
    script.src = QR_LIB_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load qr-code-styling"));
    document.head.appendChild(script);
  });
}

interface StyledQRCodeProps {
  data: string;
  size?: number;
  faded?: boolean;
}

const StyledQRCode = memo(function StyledQRCode({ data, size = 220, faded = false }: StyledQRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    let cancelled = false;

    ensureQrLibLoaded().then(() => {
      if (cancelled || !containerRef.current) return;

      const QRCodeStyling = (window as any).QRCodeStyling;
      containerRef.current.innerHTML = "";

      const qr = new QRCodeStyling({
        width: size,
        height: size,
        type: "svg",
        data,
        image: "/favicon.ico",
        qrOptions: { errorCorrectionLevel: "H" },
        dotsOptions: { color: "#42ACC1", type: "rounded" },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: { crossOrigin: "anonymous", margin: 5, imageSize: 0.28 },
        cornersSquareOptions: { color: "#42ACC1", type: "extra-rounded" },
        cornersDotOptions: { color: "#8DD0DD" },
      });

      qr.append(containerRef.current);
    });

    return () => {
      cancelled = true;
    };
  }, [data, size]);

  return (
    <div
      ref={containerRef}
      className={[
        "rounded-xl border-2 border-primary/20 overflow-hidden transition-opacity duration-300 bg-white",
        faded ? "opacity-20" : "opacity-100",
      ].join(" ")}
      style={{ width: size, height: size }}
    />
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// QR DISPLAY panel — for LoginPage (PC)
// Shows QR on screen, polls /qr/status/:code until approved
// ═════════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL_MS = 2000;

const QRDisplayPanel = memo(function QRDisplayPanel({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [code, setCode] = useState<string | null>(null);
  const [secondsLeft, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "approved">("idle");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRef = useRef<string | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Generate a new QR session
  const generate = useCallback(async () => {
    stopPolling();
    setLoading(true);
    setError("");
    setStatus("idle");
    try {
      const { data } = await api.post("/qr/generate");
      setCode(data.code);
      codeRef.current = data.code;
      const exp = new Date(data.expiresAt);
      const secs = Math.max(0, Math.round((exp.getTime() - Date.now()) / 1000));
      setSeconds(secs);
      setStatus("pending");

      // Start polling
      pollRef.current = setInterval(async () => {
        if (!codeRef.current) return;
        try {
          const { data: statusData } = await api.get(`/qr/status/${codeRef.current}`);

          if (statusData.status === "approved") {
            stopPolling();
            dispatch(
              loginSuccess({
                user: statusData.user,
                tokens: { accessToken: statusData.accessToken, refreshToken: statusData.refreshToken },
              }),
            );
            setStatus("approved");
            // GuestRoute handles the redirect to the original page (state.from).
            setTimeout(() => navigate("/", { replace: true }), 800);
          } else if (statusData.status === "expired" || statusData.status === "consumed") {
            stopPolling();
            setSeconds(0);
          }
        } catch {
          // Ignore poll errors — will retry next interval
        }
      }, POLL_INTERVAL_MS);
    } catch (err: any) {
      setError(err.response?.data?.error || "Не удалось создать QR-код");
    } finally {
      setLoading(false);
    }
  }, [dispatch, navigate, stopPolling]);

  // Auto-generate on mount
  useEffect(() => {
    generate();
    return () => stopPolling();
  }, [generate, stopPolling]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const expired = secondsLeft <= 0 && code !== null && status !== "approved";

  // Stop polling when expired
  useEffect(() => {
    if (expired) stopPolling();
  }, [expired, stopPolling]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-2 text-text/60 text-sm text-center">
        <QrCode size={16} className="text-primary" />
        <span>Отсканируйте этот код телефоном для входа</span>
      </div>

      {/* QR block */}
      <div className="relative">
        {!code && !error && (
          <div className="w-[220px] h-[220px] rounded-xl bg-gray-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {code && <StyledQRCode data={code} size={220} faded={expired} />}

        {expired && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl">
            <p className="text-sm font-medium text-text/60">Код истёк</p>
          </div>
        )}

        {status === "approved" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
            <CheckCircle size={48} className="text-green-500" />
          </div>
        )}
      </div>

      {/* Status indicator */}
      {status === "pending" && !expired && (
        <div className="flex items-center gap-2 text-sm text-text/50">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span>Ожидание подтверждения...</span>
        </div>
      )}

      {/* Timer */}
      {code && !expired && status !== "approved" && (
        <p className="text-sm text-text/50">
          Действителен ещё:{" "}
          <span className={["font-mono font-semibold", secondsLeft <= 15 ? "text-red-500" : "text-primary"].join(" ")}>
            {fmtTime(secondsLeft)}
          </span>
        </p>
      )}

      {status === "approved" && <p className="text-sm text-green-600 font-medium">Вход выполнен!</p>}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 w-full">
        <Button variant="tertiary" onClick={onClose} className="flex-shrink-0">
          <X size={18} />
        </Button>
        {status !== "approved" && (
          <Button
            variant="secondary"
            onClick={generate}
            isLoading={loading}
            icon={<RefreshCw size={16} />}
            className="flex-1"
          >
            {expired ? "Обновить код" : "Новый код"}
          </Button>
        )}
      </div>
    </div>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// QR APPROVE panel — for ProfilePage (phone, already logged in)
// Opens camera, scans QR from PC, sends POST /qr/approve
// ═════════════════════════════════════════════════════════════════════════════

const QRApprovePanel = memo(function QRApprovePanel({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"idle" | "scanned" | "approving" | "success" | "error">("idle");
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cameraErr, setCamErr] = useState("");

  // jsQR via dynamic CDN import
  const jsQRRef = useRef<any>(null);

  useEffect(() => {
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

  useEffect(() => () => stopCamera(), [stopCamera]);

  // When QR is detected, show confirmation before approving
  const handleCodeFound = useCallback(
    (rawCode: string) => {
      stopCamera();
      setScannedCode(rawCode);
      setStatus("scanned");
      setError("");
    },
    [stopCamera],
  );

  // User confirms approval
  const handleApprove = useCallback(async () => {
    if (!scannedCode) return;
    setStatus("approving");
    setError("");
    try {
      await api.post("/qr/approve", { code: scannedCode });
      setStatus("success");
    } catch (err: any) {
      setError(err.response?.data?.error || "Не удалось одобрить вход");
      setStatus("error");
    }
  }, [scannedCode]);

  const startCamera = useCallback(async () => {
    setCamErr("");
    setError("");
    setStatus("idle");
    setScannedCode(null);
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
      {/* Scanned — confirmation step */}
      {status === "scanned" && (
        <>
          <div className="flex items-center gap-2 text-text/60 text-sm text-center">
            <ShieldCheck size={16} className="text-primary flex-shrink-0" />
            <span>Подтвердите вход на другом устройстве</span>
          </div>

          <div className="w-full p-4 bg-primary/5 rounded-xl text-center">
            <p className="text-sm text-text/70">
              Вы хотите войти в свой аккаунт на другом устройстве?
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <Button
              variant="tertiary"
              onClick={() => {
                setStatus("idle");
                setScannedCode(null);
              }}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              onClick={handleApprove}
              icon={<ShieldCheck size={18} />}
              className="flex-1"
            >
              Подтвердить вход
            </Button>
          </div>
        </>
      )}

      {/* Approving */}
      {status === "approving" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm text-text/60">Подтверждение...</p>
        </div>
      )}

      {/* Success */}
      {status === "success" && (
        <>
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle size={48} className="text-green-500" />
            <p className="text-sm text-green-600 font-medium">Вход одобрен!</p>
            <p className="text-xs text-text/50">Другое устройство сейчас войдёт в аккаунт</p>
          </div>
          <Button variant="secondary" onClick={onClose} className="w-full">
            Закрыть
          </Button>
        </>
      )}

      {/* Error after approval attempt */}
      {status === "error" && (
        <>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <div className="flex gap-3 w-full">
            <Button variant="tertiary" onClick={onClose} className="flex-shrink-0">
              <X size={18} />
            </Button>
            <Button onClick={startCamera} icon={<Camera size={18} />} className="flex-1">
              Попробовать снова
            </Button>
          </div>
        </>
      )}

      {/* Camera / idle state */}
      {(status === "idle") && (
        <>
          <div className="flex items-center gap-2 text-text/60 text-sm text-center">
            <Camera size={16} className="text-primary flex-shrink-0" />
            <span>Наведите камеру на QR-код с экрана компьютера</span>
          </div>

          <div className="relative w-[240px] h-[240px] rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {streamRef.current && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-sm" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-sm" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-sm" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-sm" />
                <div className="absolute inset-x-6 top-1/2 h-0.5 bg-primary/60 animate-pulse" />
              </div>
            )}

            {!streamRef.current && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera size={40} className="text-white/30" />
              </div>
            )}
          </div>

          {cameraErr && <p className="text-sm text-red-500 text-center">{cameraErr}</p>}

          <div className="flex gap-3 w-full">
            <Button variant="tertiary" onClick={onClose} className="flex-shrink-0">
              <X size={18} />
            </Button>
            <Button onClick={startCamera} icon={<Camera size={18} />} className="flex-1">
              {streamRef.current ? "Перезапустить" : "Открыть камеру"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
});

// ─── Public exports ─────────────────────────────────────────────────────────

/** Modal for LoginPage (PC): shows QR code on screen, waits for phone approval */
export const QRDisplayModal = memo(function QRDisplayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-text text-center mb-4">Вход по QR-коду</h3>
        <QRDisplayPanel onClose={onClose} />
      </div>
    </div>
  );
});

/** Modal for ProfilePage (phone): opens camera to scan and approve login */
export const QRApproveModal = memo(function QRApproveModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Одобрить вход</h3>
          <button onClick={onClose} className="text-text/40 hover:text-text/70 transition-colors" aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        <QRApprovePanel onClose={onClose} />
      </div>
    </div>
  );
});
