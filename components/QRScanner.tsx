"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
};

export function QRScanner({ open, onClose, restaurantId }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let animationId: number;

    async function startScanning() {
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);

        const hasBarcodeDetector = "BarcodeDetector" in window;

        if (hasBarcodeDetector) {
          // Native BarcodeDetector (Chrome, Edge)
          // @ts-ignore
          const detector = new BarcodeDetector({ formats: ["qr_code"] });
          const scan = async () => {
            if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
              if (!cancelled) animationId = requestAnimationFrame(scan);
              return;
            }
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                handleQRResult(barcodes[0].rawValue);
                return;
              }
            } catch {
              // Detection failed, continue
            }
            if (!cancelled) animationId = requestAnimationFrame(scan);
          };
          animationId = requestAnimationFrame(scan);
        } else {
          // Fallback: jsQR with canvas (iOS Safari, Firefox)
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d", { willReadFrequently: true });

          const scan = () => {
            if (cancelled || !videoRef.current || !canvas || !ctx || videoRef.current.readyState < 2) {
              if (!cancelled) animationId = requestAnimationFrame(scan);
              return;
            }

            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (code && code.data) {
              handleQRResult(code.data);
              return;
            }

            if (!cancelled) animationId = requestAnimationFrame(scan);
          };
          animationId = requestAnimationFrame(scan);
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.name === "NotAllowedError") {
            setError("Camera permission denied. Please allow camera access and try again.");
          } else {
            setError("Could not access camera. Please try again.");
          }
        }
      }
    }

    function handleQRResult(rawValue: string) {
      // QR codes point to the server API (e.g., https://api.foody-pos.co.il/r/{slug}/t/{code}/{sig})
      // The server validates and redirects to the web app with a session ID.
      // If it's a full URL, navigate to it directly so the server handles the redirect.
      try {
        const url = new URL(rawValue);
        const pathMatch = url.pathname.match(/\/r\/([^/]+)\/t\/([^/]+)\/([^/]+)/);
        if (pathMatch) {
          handleClose();
          // Full URL — let the server handle the redirect
          window.location.href = rawValue;
          return;
        }
        // Check if it's a web app URL (e.g., /r/{slug}/table/{code})
        const webMatch = url.pathname.match(/\/r\/([^/]+)\/table\/([^/]+)/);
        if (webMatch) {
          handleClose();
          router.push(url.pathname + url.search);
          return;
        }
      } catch {
        // Not an absolute URL, try as relative path
      }

      // Relative path — check if it's a table route
      const webPathMatch = rawValue.match(/\/r\/([^/]+)\/table\/([^/]+)/);
      if (webPathMatch) {
        handleClose();
        router.push(rawValue);
        return;
      }

      const pathMatch = rawValue.match(/\/r\/([^/]+)\/t\/([^/]+)\/([^/]+)/);
      if (pathMatch) {
        handleClose();
        // Relative server path — prepend the API base URL
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        window.location.href = apiBase + rawValue;
        return;
      }

      setError("This QR code doesn't appear to be a table code.");
    }

    startScanning();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      stopCamera();
    };
  }, [open, handleClose, router, stopCamera]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Camera viewport */}
      <div className="relative w-full max-w-sm aspect-square mx-4">
        <video
          ref={videoRef}
          className="w-full h-full object-cover rounded-2xl"
          playsInline
          muted
        />
        {/* Hidden canvas for jsQR processing */}
        <canvas ref={canvasRef} className="hidden" />
        {/* Scanning overlay */}
        {scanning && (
          <div className="absolute inset-0 rounded-2xl border-2 border-white/50 pointer-events-none">
            <div className="absolute inset-8 border-2 border-white rounded-lg" />
          </div>
        )}
        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        )}
      </div>

      {/* Instructions */}
      <p className="text-white/80 text-sm mt-6 text-center px-8">
        {error || "Point your camera at the QR code on your table"}
      </p>

      {error && (
        <button
          onClick={handleClose}
          className="mt-4 px-6 py-2 rounded-lg bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition"
        >
          Close
        </button>
      )}
    </div>
  );
}
