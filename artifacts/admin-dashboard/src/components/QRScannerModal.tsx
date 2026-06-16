import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, AlertCircle, ScanLine } from "lucide-react";
import jsQR from "jsqr";

// ─── Design tokens (matches QR ordering theme) ────────────────────────────────
const C = {
  bg:         "#0C0A09",
  surface:    "#141210",
  card:       "#1C1917",
  gold:       "#D4A853",
  goldDim:    "rgba(212,168,83,0.13)",
  goldBorder: "rgba(212,168,83,0.28)",
  text:       "#F2EDE4",
  text2:      "#A89880",
  text3:      "#6B5F52",
  error:      "#F87171",
  errorDim:   "rgba(248,113,113,0.1)",
};
const SANS = { fontFamily: "var(--app-font-sans, system-ui)" };
const SERIF = { fontFamily: "var(--app-font-serif, Georgia, serif)" };

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
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number | null>(null);

  const [status, setStatus]       = useState<ScanStatus>("starting");
  const [errorMsg, setErrorMsg]   = useState<string>("");

  // ── Start camera ────────────────────────────────────────────────────────────
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

  // ── Scan loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "scanning") return;

    const scan = () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }

      const W = video.videoWidth;
      const H = video.videoHeight;
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

    rafRef.current = requestAnimationFrame(scan);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, onNavigate, onClose]);

  const retryCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus("starting");
    setErrorMsg("");
    setTimeout(() => setStatus("starting"), 50);
  };

  if (!isOpen) return null;

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
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-safe-top pt-6 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest mb-0.5" style={{ color: C.gold, ...SANS }}>
              Cafe Maestro
            </p>
            <h2 className="text-xl font-light" style={{ color: C.text, ...SERIF }}>
              Scan Table QR
            </h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.09)` }}
          >
            <X className="w-4.5 h-4.5" style={{ color: C.text2 }} />
          </motion.button>
        </div>

        {/* ── Viewfinder ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="relative w-full max-w-[300px] aspect-square">

            {/* Camera video */}
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover rounded-2xl"
              style={{ display: status === "scanning" || status === "found" ? "block" : "none" }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Dark placeholder when no camera */}
            {(status === "starting" || status === "denied" || status === "error") && (
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
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

            {/* Gold corner brackets */}
            {(status === "scanning" || status === "found" || status === "invalid") && (
              <>
                {/* Top-left */}
                <div className="absolute top-0 left-0 w-8 h-8" style={{ pointerEvents: "none" }}>
                  <div className="absolute top-0 left-0 h-[3px] w-8 rounded-full" style={{ background: C.gold }} />
                  <div className="absolute top-0 left-0 w-[3px] h-8 rounded-full" style={{ background: C.gold }} />
                </div>
                {/* Top-right */}
                <div className="absolute top-0 right-0 w-8 h-8" style={{ pointerEvents: "none" }}>
                  <div className="absolute top-0 right-0 h-[3px] w-8 rounded-full" style={{ background: C.gold }} />
                  <div className="absolute top-0 right-0 w-[3px] h-8 rounded-full" style={{ background: C.gold }} />
                </div>
                {/* Bottom-left */}
                <div className="absolute bottom-0 left-0 w-8 h-8" style={{ pointerEvents: "none" }}>
                  <div className="absolute bottom-0 left-0 h-[3px] w-8 rounded-full" style={{ background: C.gold }} />
                  <div className="absolute bottom-0 left-0 w-[3px] h-8 rounded-full" style={{ background: C.gold }} />
                </div>
                {/* Bottom-right */}
                <div className="absolute bottom-0 right-0 w-8 h-8" style={{ pointerEvents: "none" }}>
                  <div className="absolute bottom-0 right-0 h-[3px] w-8 rounded-full" style={{ background: C.gold }} />
                  <div className="absolute bottom-0 right-0 w-[3px] h-8 rounded-full" style={{ background: C.gold }} />
                </div>
              </>
            )}

            {/* Scanning sweep line */}
            {status === "scanning" && (
              <motion.div
                className="absolute left-2 right-2 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, pointerEvents: "none" }}
                animate={{ top: ["8%", "88%", "8%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Found flash */}
            {status === "found" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{ duration: 0.48 }}
                className="absolute inset-0 rounded-2xl"
                style={{ background: C.gold, pointerEvents: "none" }}
              />
            )}

            {/* Invalid flash */}
            {status === "invalid" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.3, 0] }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 rounded-2xl"
                style={{ background: C.error, pointerEvents: "none" }}
              />
            )}
          </div>

          {/* ── Status message ──────────────────────────────────────────── */}
          <div className="mt-8 text-center min-h-[56px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {status === "scanning" && (
                <motion.div key="scanning"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-sm" style={{ color: C.text2, ...SANS }}>
                    Point camera at the QR code on your table
                  </p>
                </motion.div>
              )}
              {status === "starting" && (
                <motion.div key="starting"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-sm" style={{ color: C.text3, ...SANS }}>Starting camera…</p>
                </motion.div>
              )}
              {status === "found" && (
                <motion.div key="found"
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <p className="text-sm font-semibold" style={{ color: C.gold, ...SANS }}>QR code recognised</p>
                </motion.div>
              )}
              {status === "invalid" && (
                <motion.div key="invalid"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-sm" style={{ color: C.error, ...SANS }}>
                    Not a Cafe Maestro table QR — try again
                  </p>
                </motion.div>
              )}
              {status === "denied" && (
                <motion.div key="denied"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-3"
                >
                  <p className="text-sm leading-relaxed max-w-[240px]" style={{ color: C.text2, ...SANS }}>
                    Camera access was denied. Enable it in your browser settings and try again.
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
              {status === "error" && (
                <motion.div key="error"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-3"
                >
                  <p className="text-sm" style={{ color: C.text2, ...SANS }}>
                    {errorMsg || "Camera unavailable."}
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

        {/* ── Footer hint ─────────────────────────────────────────────────── */}
        <div className="px-5 pb-safe-bottom pb-8 text-center">
          <p className="text-[11px]" style={{ color: C.text3, ...SANS }}>
            <ScanLine className="inline w-3 h-3 mr-1 -mt-0.5" />
            Hold steady — scanning automatically
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
