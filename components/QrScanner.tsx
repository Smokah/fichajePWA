"use client";

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (err: string) => void;
}

export function QrScanner({ onScanSuccess, onScanError }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    const elementId = 'qr-reader-container';
    const html5QrCode = new Html5Qrcode(elementId);
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          html5QrCode
            .stop()
            .catch(() => {})
            .finally(() => onScanSuccess(decodedText));
        },
        () => {
          // Ignorar errores frame-a-frame mientras busca foco
        }
      )
      .catch((err) => {
        onScanError?.(
          typeof err === 'string'
            ? err
            : 'No se pudo acceder a la cámara. Verificá los permisos del navegador.'
        );
      });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-950">
      <div id="qr-reader-container" className="w-full" />
    </div>
  );
}
