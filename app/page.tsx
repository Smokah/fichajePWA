"use client";

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';
import { generarOpcionesAutenticacion, verificarAutenticacion } from './actions/fichaje';

const STORAGE_EMAIL_KEY = 'fichajes_pwa_empleado_email';

export default function PantallaFichaje() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('');
  const [tipoEstado, setTipoEstado] = useState<'idle' | 'ok' | 'err'>('idle');
  const [horaActual, setHoraActual] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_EMAIL_KEY);
    if (saved) setEmail(saved);

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

  const registrarFichaje = (tipo: 'entrada' | 'salida') => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setTipoEstado('err');
      return setEstado('Ingresá tu correo corporativo para continuar.');
    }

    window.localStorage.setItem(STORAGE_EMAIL_KEY, cleanEmail);

    startTransition(async () => {
      try {
        setTipoEstado('idle');
        setEstado('Iniciando validación biométrica...');
        const { options, challengeId } = await generarOpcionesAutenticacion(cleanEmail);

        setEstado('Verificá tu identidad en el sensor del dispositivo...');
        const response = await startAuthentication({ optionsJSON: options });

        setEstado('Registrando marca horaria...');
        const result = await verificarAutenticacion(cleanEmail, response, challengeId, tipo);

        if (result.success) {
          const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          setTipoEstado('ok');
          setEstado(`${tipo === 'entrada' ? 'Ingreso' : 'Egreso'} confirmado a las ${hora} hs.`);
        } else {
          setTipoEstado('err');
          setEstado(result.error);
        }
      } catch (error) {
        setTipoEstado('err');
        setEstado(error instanceof Error ? error.message : 'Operación cancelada.');
      }
    });
  };

  return (
    <main className="flex min-h-screen flex-col justify-between bg-slate-50 px-5 py-6">
      {/* Barra superior discreta */}
      <header className="mx-auto flex w-full max-w-md items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold tracking-wider text-white">
            AM
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">AccesoMóvil</span>
        </div>
        <nav className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <Link href="/registro" className="hover:text-slate-900 transition-colors">
            Vincular equipo
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/panel" className="hover:text-slate-900 transition-colors">
            Administración
          </Link>
        </nav>
      </header>

      {/* Tarjeta principal de terminal */}
      <section className="mx-auto my-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-7 shadow-sm space-y-7">
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-5">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Terminal de Asistencia</h1>
              <p className="text-xs text-slate-500 mt-0.5">Identificación biométrica del personal</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-semibold tabular-nums text-slate-900">
                {horaActual || '--:--:--'}
              </p>
              <p className="text-[11px] text-slate-400">Hora local</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email-empleado" className="block text-xs font-medium text-slate-700">
              Correo electrónico registrado
            </label>
            <input
              id="email-empleado"
              type="email"
              autoComplete="email"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1">
            <button
              onClick={() => registrarFichaje('entrada')}
              disabled={isPending}
              className="group flex w-full items-center justify-between rounded-xl bg-slate-900 px-5 py-4 text-left text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
            >
              <div>
                <span className="block text-base font-semibold tracking-tight">Registrar Entrada</span>
                <span className="block text-xs text-slate-400">Inicio de jornada laboral</span>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 font-semibold text-sm">
                →
              </span>
            </button>

            <button
              onClick={() => registrarFichaje('salida')}
              disabled={isPending}
              className="group flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-5 py-4 text-left text-slate-900 transition-all hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50"
            >
              <div>
                <span className="block text-base font-semibold tracking-tight">Registrar Salida</span>
                <span className="block text-xs text-slate-500">Cierre de jornada laboral</span>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 font-semibold text-sm">
                ←
              </span>
            </button>
          </div>

          {estado && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border px-4 py-3 text-xs font-medium ${
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
        </div>
      </section>

      <footer className="mx-auto w-full max-w-md text-center text-[11px] text-slate-400">
        AccesoMóvil Enterprise · Autenticación FIDO2 / WebAuthn
      </footer>
    </main>
  );
}
