"use client";

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';
import { generarOpcionesAutenticacion, verificarAutenticacion } from './actions/fichaje';

const STORAGE_EMAIL_KEY = 'fichajes_pwa_empleado_email';

export default function PantallaFichaje() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('');
  const [esExito, setEsExito] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_EMAIL_KEY);
    if (saved) setEmail(saved);
  }, []);

  const registrarFichaje = (tipo: 'entrada' | 'salida') => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEsExito(false);
      return setEstado('Ingresá tu correo para fichar.');
    }

    window.localStorage.setItem(STORAGE_EMAIL_KEY, cleanEmail);

    startTransition(async () => {
      try {
        setEsExito(false);
        setEstado('Buscando tu Passkey...');
        const { options, challengeId } = await generarOpcionesAutenticacion(cleanEmail);

        setEstado('Confirmá tu identidad con huella o Face ID...');
        const response = await startAuthentication({ optionsJSON: options });

        setEstado(`Registrando ${tipo}...`);
        const result = await verificarAutenticacion(cleanEmail, response, challengeId, tipo);

        if (result.success) {
          const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          setEsExito(true);
          setEstado(`¡${tipo.toUpperCase()} registrada a las ${hora}!`);
        } else {
          setEsExito(false);
          setEstado(`Error: ${result.error}`);
        }
      } catch (error) {
        setEsExito(false);
        setEstado(error instanceof Error ? error.message : 'Fichaje cancelado o no pudo completarse.');
      }
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-gray-50 p-6">
      <div className="w-full max-w-sm flex justify-between items-center text-xs text-gray-500">
        <Link href="/registro" className="underline hover:text-gray-800">
          ¿Primer día? Vincular celular
        </Link>
        <Link href="/panel" className="underline hover:text-gray-800">
          Panel Administrativo
        </Link>
      </div>

      <div className="w-full max-w-sm space-y-8 my-auto">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">Fichajes</h1>
          <p className="text-gray-500 text-sm">Control de asistencia biométrico</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 text-center">
              Tu correo registrado
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending}
              className="w-full rounded-2xl border-2 border-gray-300 bg-white px-4 py-4 text-center text-lg font-medium text-gray-800 focus:border-green-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => registrarFichaje('entrada')}
            disabled={isPending}
            className="w-full rounded-[2rem] bg-green-600 py-10 text-3xl font-extrabold text-white shadow-xl transition-all hover:bg-green-700 active:scale-95 disabled:opacity-50"
          >
            ENTRADA
          </button>

          <button
            onClick={() => registrarFichaje('salida')}
            disabled={isPending}
            className="w-full rounded-[2rem] bg-red-600 py-10 text-3xl font-extrabold text-white shadow-xl transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
          >
            SALIDA
          </button>
        </div>

        {estado && (
          <div
            role="status"
            aria-live="polite"
            className={`w-full rounded-2xl px-5 py-4 text-center text-sm font-semibold shadow-sm ${
              esExito
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            {estado}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        Verificación biométrica nativa · Sin hardware adicional
      </p>
    </main>
  );
}
