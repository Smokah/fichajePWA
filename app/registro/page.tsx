"use client";

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import { iniciarAltaEmpleado, verificarRegistro } from '../actions/fichaje';

export const STORAGE_PERFIL_KEY = 'accesomovil_perfil_v1';

export default function RegistroBiometrico() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState('');
  const [completado, setCompletado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const enrolarDispositivo = () => {
    if (nombre.trim().length < 2) return setEstado('Ingresá tu nombre y apellido completo.');
    if (!email.trim()) return setEstado('Ingresá tu correo electrónico.');
    if (!/^[a-fA-F0-9]{16}$/.test(codigo.trim())) {
      return setEstado('El código de habilitación debe tener 16 caracteres.');
    }

    startTransition(async () => {
      try {
        setCompletado(false);
        setEstado('Validando código de sucursal...');
        const { options, challengeId, empleadoNombre } = await iniciarAltaEmpleado(nombre, email, codigo);

        setEstado(`Hola ${empleadoNombre}. Confirmá tu huella o bloqueo en el dispositivo...`);
        const response = await startRegistration({ optionsJSON: options });

        setEstado('Vinculando dispositivo...');
        const result = await verificarRegistro(email, response, challengeId);

        if (result.success) {
          window.localStorage.setItem(STORAGE_PERFIL_KEY, JSON.stringify(result.perfil));
          setCompletado(true);
          setEstado('Alta completada. Redirigiendo al escáner QR...');
          setTimeout(() => router.push('/'), 1200);
        } else {
          setEstado(result.error);
        }
      } catch (error) {
        setEstado(error instanceof Error ? error.message : 'No se pudo completar el alta.');
      }
    });
  };

  return (
    <main className="flex min-h-screen flex-col justify-between bg-slate-50 px-5 py-6">
      <header className="mx-auto flex w-full max-w-md items-center justify-between border-b border-slate-200 pb-4">
        <Link href="/" className="text-xs font-medium text-slate-600 hover:text-slate-900">
          ← Volver
        </Link>
        <span className="text-xs font-semibold text-slate-400">Alta Única de Dispositivo</span>
      </header>

      <section className="mx-auto my-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h1 className="text-lg font-semibold text-slate-900">Vincular Teléfono (Única Vez)</h1>
            <p className="text-xs text-slate-500 mt-1">
              Este registro se realiza una sola vez. Luego solo deberás escanear el QR de la sucursal para marcar asistencia.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre y apellido</label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Ej: Martín Gómez"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                disabled={isPending}
                maxLength={120}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="martin.gomez@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isPending}
                maxLength={254}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Código de sucursal</label>
              <input
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={16}
                placeholder="16 caracteres"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value.replace(/[^a-fA-F0-9]/g, '').slice(0, 16))}
                disabled={isPending}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm uppercase tracking-widest text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <button
              onClick={enrolarDispositivo}
              disabled={isPending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? 'Registrando...' : 'Completar Alta y Vincular Huella'}
            </button>
          </div>

          {estado && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border px-4 py-3 text-xs font-medium ${
                completado
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {estado}
            </div>
          )}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-md text-center text-[11px] text-slate-400">
        AccesoMóvil Enterprise
      </footer>
    </main>
  );
}
