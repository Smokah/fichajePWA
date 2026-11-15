"use client";

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { startRegistration } from '@simplewebauthn/browser';
import { iniciarAltaEmpleado, verificarRegistro } from '../actions/fichaje';

const STORAGE_EMAIL_KEY = 'fichajes_pwa_empleado_email';

export default function RegistroBiometrico() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState('');
  const [completado, setCompletado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const enrolarDispositivo = () => {
    if (nombre.trim().length < 2) return setEstado('Ingresá tu nombre y apellido.');
    if (!email.trim()) return setEstado('Ingresá tu correo electrónico.');
    if (!/^[a-fA-F0-9]{16}$/.test(codigo.trim())) {
      return setEstado('Ingresá el código de sucursal de 16 caracteres que te entregó el administrador.');
    }

    startTransition(async () => {
      try {
        setCompletado(false);
        setEstado('Validando el código de sucursal y creando tu registro...');
        const { options, challengeId, empleadoNombre } = await iniciarAltaEmpleado(nombre, email, codigo);

        setEstado(`Hola ${empleadoNombre}. Confirmá tu identidad con huella, Face ID o el bloqueo de pantalla...`);
        const response = await startRegistration({ optionsJSON: options });

        setEstado('Verificando y guardando tu Passkey...');
        const result = await verificarRegistro(email, response, challengeId);

        if (result.success) {
          window.localStorage.setItem(STORAGE_EMAIL_KEY, email.trim().toLowerCase());
          setCompletado(true);
          setEstado('¡Alta completada! Tu celular quedó vinculado y ya podés fichar.');
          setCodigo('');
        } else {
          setEstado(`Error: ${result.error}`);
        }
      } catch (error) {
        setEstado(error instanceof Error ? error.message : 'No se pudo completar el registro.');
      }
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center space-y-6 bg-gray-50 p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-xs text-gray-500 underline hover:text-gray-800">
          ← Volver a Fichar
        </Link>
      </div>

      <div className="w-full max-w-sm space-y-2 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Alta de empleado</h1>
        <p className="text-sm text-gray-600">
          Ingresá tus datos y el código de tu sucursal para vincular tu huella o Face ID.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Nombre y apellido</span>
          <input
            type="text"
            autoComplete="name"
            placeholder="Ej: Juan Pérez"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            disabled={isPending}
            maxLength={120}
            className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3.5 text-center text-lg focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Correo electrónico</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isPending}
            maxLength={254}
            className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3.5 text-center text-lg focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Código de sucursal (16 caracteres)</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={16}
            placeholder="Ej: a1b2c3d4e5f60718"
            value={codigo}
            onChange={(event) => setCodigo(event.target.value.replace(/[^a-fA-F0-9]/g, '').slice(0, 16))}
            disabled={isPending}
            className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3.5 text-center font-mono text-lg uppercase tracking-widest focus:border-blue-500 focus:outline-none"
          />
        </label>

        <button
          onClick={enrolarDispositivo}
          disabled={isPending}
          className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
        >
          {isPending ? 'Procesando...' : 'Vincular celular y huella'}
        </button>
      </div>

      {estado && (
        <div
          role="status"
          aria-live="polite"
          className={`w-full max-w-sm rounded-xl px-4 py-3 text-center text-sm font-medium ${
            completado ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-200 text-gray-800'
          }`}
        >
          {estado}
        </div>
      )}

      {completado && (
        <Link
          href="/"
          className="w-full max-w-sm rounded-2xl bg-green-600 py-3.5 text-center text-base font-bold text-white shadow hover:bg-green-700"
        >
          Ir a Fichar ahora →
        </Link>
      )}
    </main>
  );
}
