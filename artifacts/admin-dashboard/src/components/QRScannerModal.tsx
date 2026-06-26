import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, AlertCircle, ScanLine } from "lucide-react";
import jsQR from "jsqr";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:         "#0C0A09",
  card:       "#1C1917",
  gold:       "#D4A853",
  goldDim:    "rgba(212,168,83,0.13)",
  goldBorder: "rgba(212,168,83,0.28)",
  text:       "#F2EDE4",
  text2:      "#A89880",
  text3:      "#6B5F52",
  error:      "#F87171",
};
const SANS  = { fontFamily: "var(--app-font-sans, system-ui)" };
const SERIF = { fontFamily: "var(--app-font-serif, Georgia, serif)" };

// ─── Scan-line keyframes injected once ────────────────────────────────────────
// translateY is GPU-composited (no layout, no paint).
// The viewfinder is max-w-[300px] aspect-square (≤ 300 px tall on any phone).
// We sweep from translateY(14px) → translateY(274px) — stays inside the box.
const KEYFRAMES = `
@keyframes qr-scan-sweep {
  0%   { transform: translateY(14px);  }
  50%  { transform: translateY(274px); }
  100% { transform: translateY(14px);  }
}`;

// ─── Decode throttle: 100 ms = ~10 fps — plenty to read a QR code quickly ──
const DECODE_INTERVAL_MS = 100;
// Downscale to 640 px wide before decoding — 4× less pixel data vs 1280 px
const DECODE_WIDTH = 640;

type ScanStatus = "starting" | "scanning" | "found" | "denied" | "error" | "invalid";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

function extractTablePath(raw: string): string | null {
  try {
    let pathname: string;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      pathname = new URL(raw).pathname;
    } else if (raw.startsWith("/")) {
      pathname = raw;
    } else {
      return null;
    }
    const match = pathname.match(/\/table\/([^/?#\s]+)/);
    if (!match) return null;
    return `/table/${match[1]}`;
  } catch {
    return null;
  }
}

export function QRScannerModal({ isOpen, onClose, onNavigate }: Props) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const rafRef         = useRef<number | null>(null);
  const lastDecodeRef  = useRef<number>(0);

  const [status,   setStatus]   = useState<ScanStatus>("starting");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Inject keyframes once (idempotent) ──────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("qr-scan-kf")) return;
    const tag = document.createElement("style");
    tag.id = "qr-scan-kf";
    tag.textContent = KEYFRAMES;
    document.head.appendChild(tag);
  }, []);

  // ── Start / stop camera ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setStatus("starting");
    setErrorMsg("");
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStatus("scanning");
      } catch (err: unknown) {
        if (cancelled) return;
        const name = (err as DOMException)?.name ?? "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setStatus("denied");
        } else {
          setStatus("error");
          setErrorMsg("Could not start camera.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isOpen]);

  // ── Decode loop ────────────────────────────────────────────────────────────
  // rAF keeps the loop alive but jsQR is only called every DECODE_INTERVAL_MS.
  // Canvas is downscaled to DECODE_WIDTH before getImageData to cut data volume.
  useEffect(() => {
    if (status !== "scanning") return;

    const scan = () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }

      // ── Throttle: skip decode if called too soon ─────────────────────────
      const now = Date.now();
      if (now - lastDecodeRef.current < DECODE_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      lastDecodeRef.current = now;

      // ── Downscale canvas to DECODE_WIDTH ─────────────────────────────────
      const srcW = video.videoWidth  || DECODE_WIDTH;
      const srcH = video.videoHeight || 480;
      const scale = DECODE_WIDTH / srcW;
      const W = DECODE_WIDTH;
      const H = Math.round(srcH * scale);

      canvas.width  = W;
      canvas.height = H;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(scan); return; }

      ctx.drawImage(video, 0, 0, W, H);
      const imageData = ctx.getImageData(0, 0, W, H);
      const code = jsQR(imageData.data, W, H, { inversionAttempts: "dontInvert" });

      if (code?.data) {
        const path = extractTablePath(code.data);
        if (path) {
          setStatus("found");
          streamRef.current?.getTracks().forEach((t) => t.stop());
          setTimeout(() => { onNavigate(path); onClose(); }, 480);
        } else {
          setStatus("invalid");
          setTimeout(() => setStatus("scanning"), 1800);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(scan);
    };

    lastDecodeRef.current = 0; // decode immediately on first tick
    rafRef.current = requestAnimationFrame(scan);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, onNavigate, onClose]);

  const retryCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus("starting");
    setErrorMsg("");
  };

  if (!isOpen) return null;

  const showViewfinder = status === "scanning" || status === "found" || status === "invalid";

  return (
    <AnimatePresence>
      <motion.div
        key="scanner-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "rgba(12,10,9,0.97)", backdropFilter: "blur(12px)" }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest mb-0.5" style={{ color: C.gold, ...SANS }}>
              Cup & Cozy
            </p>
            <h2 className="text-xl font-light" style={{ color: C.text, ...SERIF }}>
              Scan Table QR
            </h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <X className="w-[18px] h-[18px]" style={{ color: C.text2 }} />
          </motion.button>
        </div>

        {/* ── Viewfinder ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">

          {/*
            overflow-hidden clips the scan line at the edges of the viewfinder.
            The scan line itself is positioned at top:0 and animated purely via
            transform: translateY(...) — no layout properties touched at all.
          */}
          <div className="relative w-full max-w-[300px] aspect-square overflow-hidden rounded-2xl">

            {/* Camera video */}
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: showViewfinder ? "block" : "none" }}
            />

            {/* Off-screen decode canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Dark placeholder (starting / denied / error) */}
            {!showViewfinder && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: C.card, border: `1px solid ${C.goldBorder}` }}
              >
                {status === "starting" ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  >
                    <Camera className="w-10 h-10" style={{ color: C.gold, opacity: 0.6 }} />
                  </motion.div>
                ) : (
                  <AlertCircle className="w-10 h-10" style={{ color: C.error, opacity: 0.7 }} />
                )}
              </div>
            )}

            {/* ── Gold corner brackets ──────────────────────────────────── */}
            {showViewfinder && (
              <>
                <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none z-10">
                  <div className="absolute top-0 left-0 h-[3px] w-8 rounded-full" style={{ background: C.gold }} />
                  <div className="absolute top-0 left-0 w-[3px] h-8 rounded-full" style={{ background: C.gold }} />
                </div>
                <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none z-10">
                  <div className="absolute top-0 right-0 h-[3px] w-8 rounded-full" style={{ background: C.gold }} />
                  <div className="absolute top-0 right-0 w-[3px] h-8 rounded-full" style={{ background: C.gold }} />
                </div>
                <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none z-10">
                  <div className="absolute bottom-0 left-0 h-[3px] w-8 rounded-full" style={{ background: C.gold }} />
                  <div className="absolute bottom-0 left-0 w-[3px] h-8 rounded-full" style={{ background: C.gold }} />
                </div>
                <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none z-10">
                  <div className="absolute bottom-0 right-0 h-[3px] w-8 rounded-full" style={{ background: C.gold }} />
                  <div className="absolute bottom-0 right-0 w-[3px] h-8 rounded-full" style={{ background: C.gold }} />
                </div>
              </>
            )}

            {/*
              ── GPU-ACCELERATED SCAN LINE ──────────────────────────────────
              BEFORE: motion.div, animate={{ top: ["8%","88%","8%"] }}
                      → Framer Motion sets `top` style every frame
                      → triggers layout + paint on every frame → jank

              AFTER:  plain <div>, CSS @keyframes qr-scan-sweep
                      → only transform: translateY(...) changes
                      → composited on GPU, zero layout recalculation
                      → will-change: transform → own compositing layer
                      → zero React re-renders during animation
            */}
            {status === "scanning" && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{
                  top: 0,
                  height: "2px",
                  willChange: "transform",
                  animation: "qr-scan-sweep 2.4s ease-in-out infinite",
                  background: "linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.15) 15%, rgba(212,168,83,0.85) 40%, #D4A853 50%, rgba(212,168,83,0.85) 60%, rgba(212,168,83,0.15) 85%, transparent 100%)",
                  boxShadow: "0 0 6px 1px rgba(212,168,83,0.55), 0 0 18px 4px rgba(212,168,83,0.18)",
                  borderRadius: "1px",
                }}
              />
            )}

            {/* Found flash (opacity only — also GPU composited) */}
            {status === "found" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{ duration: 0.48 }}
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ background: C.gold }}
              />
            )}

            {/* Invalid flash */}
            {status === "invalid" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.3, 0] }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ background: C.error }}
              />
            )}
          </div>

          {/* ── Status message ────────────────────────────────────────────── */}
          <div className="mt-8 text-center min-h-[56px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {status === "scanning" && (
                <motion.p key="scanning" className="text-sm"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: C.text2, ...SANS }}
                >
                  Point camera at the QR code on your table
                </motion.p>
              )}
              {status === "starting" && (
                <motion.p key="starting" className="text-sm"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: C.text3, ...SANS }}
                >
                  Starting camera…
                </motion.p>
              )}
              {status === "found" && (
                <motion.p key="found" className="text-sm font-semibold"
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ color: C.gold, ...SANS }}
                >
                  QR code recognised
                </motion.p>
              )}
              {status === "invalid" && (
                <motion.p key="invalid" className="text-sm"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: C.error, ...SANS }}
                >
                  Not a Cup & Cozy table QR — try again
                </motion.p>
              )}
              {(status === "denied" || status === "error") && (
                <motion.div key={status}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-3"
                >
                  <p className="text-sm leading-relaxed max-w-[240px]" style={{ color: C.text2, ...SANS }}>
                    {status === "denied"
                      ? "Camera access was denied. Enable it in your browser settings and try again."
                      : (errorMsg || "Camera unavailable.")}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={retryCamera}
                    className="px-5 py-2.5 rounded-full text-xs font-semibold"
                    style={{ background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}`, ...SANS }}
                  >
                    Try again
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-5 pb-8 text-center">
          <p className="text-[11px]" style={{ color: C.text3, ...SANS }}>
            <ScanLine className="inline w-3 h-3 mr-1 -mt-0.5" />
            Hold steady — scanning automatically
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
