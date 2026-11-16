"use client";

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { emitirQrDinamicoKiosco, verificarEstadoQrKiosco } from '../actions/kiosco';

const STORAGE_KIOSK_KEY = 'accesomovil_kiosk_key_v1';

function KioscoContenido() {
  const searchParams = useSearchParams();
  const [kioskKey, setKioskKey] = useState('');
  const [keyActiva, setKeyActiva] = useState('');
  const [sucursalNombre, setSucursalNombre] = useState('');
  const [qrId, setQrId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [segundosRestantes, setSegundosRestantes] = useState(60);
  const [ultimoFichajeAviso, setUltimoFichajeAviso] = useState('');
  const [error, setError] = useState('');
  const [reloj, setReloj] = useState('');

  const generarNuevoQR = useCallback(async (clave: string) => {
    try {
      setError('');
      const res = await emitirQrDinamicoKiosco(clave);
      setKeyActiva(clave);
      setSucursalNombre(res.sucursalNombre);
      setQrId(res.qrId);
      setSegundosRestantes(res.ttlSeconds);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const payload = `${origin}/?qr=${res.token}`;
      const url = await QRCode.toDataURL(payload, {
        width: 380,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrDataUrl(url);
      window.localStorage.setItem(STORAGE_KIOSK_KEY, clave);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error conectando terminal de sucursal');
      setKeyActiva('');
    }
  }, []);

  // Inicializar con ?k=CLAVE de URL o localStorage
  useEffect(() => {
    const paramKey = searchParams.get('k');
    const savedKey = window.localStorage.getItem(STORAGE_KIOSK_KEY);
    const initial = paramKey || savedKey || '';
    if (initial) {
      setKioskKey(initial);
      generarNuevoQR(initial);
    }
  }, [searchParams, generarNuevoQR]);

  // Reloj en vivo
  useEffect(() => {
    const tick = () => {
      setReloj(
        new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Cuenta regresiva + Polling cada 2.5s para rotar inmediatamente si alguien ya escaneó el QR
  useEffect(() => {
    if (!keyActiva || !qrId) return;

    const countdownInterval = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          generarNuevoQR(keyActiva);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    const pollInterval = setInterval(async () => {
      try {
        const estado = await verificarEstadoQrKiosco(qrId);
        if (estado.consumido) {
          if (estado.empleadoNombre) {
            setUltimoFichajeAviso(`Lectura confirmada: ${estado.empleadoNombre}`);
            setTimeout(() => setUltimoFichajeAviso(''), 5000);
          }
          generarNuevoQR(keyActiva);
        }
      } catch {
        // ignorar fallo transitorio de red
      }
    }, 2500);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(pollInterval);
    };
  }, [keyActiva, qrId, generarNuevoQR]);

  if (!keyActiva) {
    return (
      <main className="flex min-h-screen flex-col justify-between bg-slate-900 px-5 py-6 text-white">
        <header className="mx-auto flex w-full max-w-md items-center justify-between border-b border-slate-800 pb-4">
          <Link href="/panel" className="text-xs font-medium text-slate-400 hover:text-white">
            ← Volver a Administración
          </Link>
          <span className="text-xs font-semibold text-slate-500">Modo Kiosco</span>
        </header>

        <section className="mx-auto my-auto w-full max-w-md">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-7 shadow-xl space-y-5">
            <div>
              <h1 className="text-lg font-semibold text-white">Activar Pantalla de Sucursal</h1>
              <p className="text-xs text-slate-400 mt-1">
                Ingresá la clave de terminal de la sede (disponible en Panel Administrativo &gt; Personal y Sucursales).
              </p>
            </div>

            <input
              type="text"
              placeholder="Clave de terminal (16 caracteres)"
              value={kioskKey}
              onChange={(e) => setKioskKey(e.target.value.trim())}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center font-mono text-sm text-white focus:border-white focus:outline-none"
            />

            <button
              onClick={() => generarNuevoQR(kioskKey)}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Iniciar Terminal QR Dinámico
            </button>

            {error && (
              <p className="rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-center text-xs text-rose-200">
                {error}
              </p>
            )}
          </div>
        </section>

        <footer className="mx-auto w-full max-w-md text-center text-[11px] text-slate-600">
          AccesoMóvil Enterprise · Terminal de Punto de Acceso
        </footer>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-between bg-slate-950 px-6 py-8 text-white select-none">
      {/* Top Bar */}
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-950">
            AM
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Punto de Control</p>
            <h1 className="text-lg font-semibold text-white">{sucursalNombre}</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold tabular-nums text-white">{reloj}</p>
          <button
            onClick={() => {
              window.localStorage.removeItem(STORAGE_KIOSK_KEY);
              setKeyActiva('');
            }}
            className="text-[11px] text-slate-500 underline hover:text-slate-300"
          >
            Cambiar sede
          </button>
        </div>
      </header>

      {/* Center QR Display */}
      <section className="mx-auto my-auto flex flex-col items-center text-center space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Escaneá para registrar asistencia</h2>
          <p className="text-xs text-slate-400">
            Código dinámico de un solo uso · Válido para personal de cualquier sucursal
          </p>
        </div>

        <div className="relative rounded-3xl bg-white p-6 shadow-2xl">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Dinámico de Sucursal" className="h-72 w-72 sm:h-80 sm:w-80" />
          ) : (
            <div className="flex h-72 w-72 items-center justify-center text-xs text-slate-400">
              Generando código...
            </div>
          )}
        </div>

        {/* Barra de vigencia */}
        <div className="w-72 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Renovación automática</span>
            <span className="font-mono font-semibold text-white">{segundosRestantes}s</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
              style={{ width: `${(segundosRestantes / 60) * 100}%` }}
            />
          </div>
        </div>

        {ultimoFichajeAviso && (
          <div className="rounded-xl border border-emerald-700/60 bg-emerald-950/80 px-5 py-2.5 text-xs font-medium text-emerald-200">
            {ultimoFichajeAviso}
          </div>
        )}
      </section>

      <footer className="mx-auto w-full max-w-2xl text-center text-xs text-slate-500">
        Seguridad anti-suplantación activa · Cada código expira al ser escaneado
      </footer>
    </main>
  );
}

export default function KioscoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <KioscoContenido />
    </Suspense>
  );
}
