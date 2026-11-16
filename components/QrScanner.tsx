"use client";

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (err: string) => void;
}

export function QrScanner({ onScanSuccess, onScanError }: QrScannerProps) {
  const onSuccessRef = useRef(onScanSuccess);
  const onErrorRef = useRef(onScanError);
  const handledRef = useRef(false);

  useEffect(() => {
    onSuccessRef.current = onScanSuccess;
    onErrorRef.current = onScanError;
  }, [onScanSuccess, onScanError]);

  useEffect(() => {
    let mounted = true;
    const elementId = 'qr-reader-container';
    const html5QrCode = new Html5Qrcode(elementId, { verbose: false });

    html5QrCode
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          disableFlip: false,
        },
        (decodedText) => {
          if (!mounted || handledRef.current) return;
          handledRef.current = true;
          html5QrCode
            .stop()
            .catch(() => {})
            .finally(() => {
              if (mounted) onSuccessRef.current(decodedText);
            });
        },
        () => {
          // Ignorar lecturas vacías mientras enfoca
        }
      )
      .catch((err) => {
        if (!mounted) return;
        onErrorRef.current?.(
          typeof err === 'string'
            ? err
            : 'No se pudo acceder a la cámara. Verificá los permisos del navegador.'
        );
      });

    return () => {
      mounted = false;
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, []); // Array vacío: la cámara se monta una sola vez y NO parpadea con el reloj

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-950">
      <div id="qr-reader-container" className="w-full [&_video]:object-cover" />
    </div>
  );
}
