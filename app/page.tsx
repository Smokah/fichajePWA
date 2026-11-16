"use client";

import { useCallback, useEffect, useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { iniciarFichajeConQR, confirmarFichajeConQR } from './actions/fichaje';
import { QrScanner } from '@/components/QrScanner';
import { STORAGE_PERFIL_KEY } from './registro/page';

interface PerfilVinculado {
  empleadoId: string;
  nombre: string;
  email: string;
  sucursal: string;
}

function TerminalContenido() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilVinculado | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [escaneando, setEscaneando] = useState(false);
  const [estado, setEstado] = useState('');
  const [tipoEstado, setTipoEstado] = useState<'idle' | 'ok' | 'err'>('idle');
  const [horaActual, setHoraActual] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_PERFIL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.empleadoId) setPerfil(parsed);
      }
    } catch {
      // ignorar
    } finally {
      setCargandoPerfil(false);
    }

    const actualizarReloj = () => {
      setHoraActual(
        new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    actualizarReloj();
    const timer = setInterval(actualizarReloj, 1000);
    return () => clearInterval(timer);
  }, []);

  const procesarCodigoQR = useCallback(
    (qrLeido: string, perfilActual: PerfilVinculado) => {
      setEscaneando(false);
      startTransition(async () => {
        try {
          setTipoEstado('idle');
          setEstado('Validando QR de sucursal...');
          const prep = await iniciarFichajeConQR(perfilActual.empleadoId, qrLeido);

          const etiquetaTipo = prep.tipoSugerido === 'entrada' ? 'ENTRADA' : 'SALIDA';
          setEstado(`Sede: ${prep.sucursalNombre} · Confirmá ${etiquetaTipo} con tu huella...`);

          const response = await startAuthentication({ optionsJSON: prep.options });

          setEstado('Registrando asistencia...');
          const res = await confirmarFichajeConQR(
            perfilActual.empleadoId,
            prep.sucursalId,
            response,
            prep.challengeId,
            prep.tipoSugerido
          );

          if (res.success) {
            setTipoEstado('ok');
            setEstado(
              `${res.tipo === 'entrada' ? 'Ingreso' : 'Egreso'} registrado en ${res.sucursal} a las ${res.hora} hs.`
            );
            // Limpiar parámetro ?qr= de la URL si vino desde la cámara nativa
            if (searchParams.get('qr')) {
              router.replace('/');
            }
          } else {
            setTipoEstado('err');
            setEstado(res.error);
          }
        } catch (error) {
          setTipoEstado('err');
          setEstado(error instanceof Error ? error.message : 'Operación cancelada.');
        }
      });
    },
    [router, searchParams]
  );

  // Si el empleado escaneó el QR directamente con la cámara nativa del celular (abriendo /?qr=TOKEN)
  useEffect(() => {
    const qrParam = searchParams.get('qr');
    if (!cargandoPerfil && perfil && qrParam && !isPending && tipoEstado === 'idle' && !estado) {
      procesarCodigoQR(qrParam, perfil);
    }
  }, [cargandoPerfil, perfil, searchParams, isPending, tipoEstado, estado, procesarCodigoQR]);

  return (
    <main className="flex min-h-screen flex-col justify-between bg-slate-50 px-5 py-6">
      <header className="mx-auto flex w-full max-w-md items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold tracking-wider text-white">
            AM
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">AccesoMóvil</span>
        </div>
        <nav className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <Link href="/panel" className="hover:text-slate-900 transition-colors">
            Administración
          </Link>
        </nav>
      </header>

      <section className="mx-auto my-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-7 shadow-sm space-y-6">
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-5">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Control de Asistencia</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {perfil ? perfil.nombre : 'Terminal móvil sin vincular'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-semibold tabular-nums text-slate-900">
                {horaActual || '--:--:--'}
              </p>
              <p className="text-[11px] text-slate-400">Hora local</p>
            </div>
          </div>

          {cargandoPerfil ? (
            <p className="py-8 text-center text-xs text-slate-400">Verificando dispositivo...</p>
          ) : !perfil ? (
            /* Pantalla de primera vez (Alta única) */
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-900">Dispositivo aún no habilitado</p>
                <p>
                  Para fichar mediante código QR, primero debés vincular este teléfono por única vez con el código de tu sucursal.
                </p>
              </div>
              <Link
                href="/registro"
                className="block w-full rounded-xl bg-slate-900 py-3.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Realizar Alta Única
              </Link>
            </div>
          ) : (
            /* Pantalla operativa diaria: 1 solo toque -> Cámara QR -> Huella -> Listo */
            <div className="space-y-5">
              {!escaneando ? (
                <button
                  onClick={() => {
                    setEstado('');
                    setTipoEstado('idle');
                    setEscaneando(true);
                  }}
                  disabled={isPending}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-5 py-5 text-left text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
                >
                  <div>
                    <span className="block text-base font-semibold tracking-tight">
                      {isPending ? 'Procesando...' : 'Escanear QR de Sucursal'}
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      Registra automáticamente tu entrada o salida
                    </span>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 font-mono text-xs font-bold">
                    QR
                  </span>
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-center text-xs font-medium text-slate-600">
                    Apuntá la cámara al código QR impreso en la sucursal
                  </p>
                  <QrScanner
                    onScanSuccess={(code) => procesarCodigoQR(code, perfil)}
                    onScanError={(err) => {
                      setEscaneando(false);
                      setTipoEstado('err');
                      setEstado(err);
                    }}
                  />
                  <button
                    onClick={() => setEscaneando(false)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar escaneo
                  </button>
                </div>
              )}

              {estado && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`rounded-xl border px-4 py-3.5 text-xs font-medium ${
                    tipoEstado === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : tipoEstado === 'err'
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {estado}
                </div>
              )}

              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>{perfil.email}</span>
                <button
                  onClick={() => {
                    if (confirm('¿Desvincular este perfil del navegador?')) {
                      window.localStorage.removeItem(STORAGE_PERFIL_KEY);
                      setPerfil(null);
                      setEstado('');
                    }
                  }}
                  className="underline hover:text-slate-600"
                >
                  Cambiar usuario
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-md text-center text-[11px] text-slate-400">
        AccesoMóvil Enterprise · Validación Presencial por QR + Biometría
      </footer>
    </main>
  );
}

export default function PantallaFichaje() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <TerminalContenido />
    </Suspense>
  );
}
