"use client";

import { useState, useTransition } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { generarOpcionesAutenticacion, verificarAutenticacion } from './acciones';

export default function PantallaFichaje() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('');
  const [isPending, startTransition] = useTransition();

  const registrarFichaje = (tipo: 'entrada' | 'salida') => {
    if (!email.trim()) return setEstado('Ingresá tu correo para fichar.');

    startTransition(async () => {
      try {
        setEstado('Buscando tu Passkey...');
        const { options, challengeId } = await generarOpcionesAutenticacion(email);

        setEstado('Confirmá tu identidad con huella, Face ID o el bloqueo de pantalla...');
        const response = await startAuthentication({ optionsJSON: options });

        setEstado(`Registrando ${tipo}...`);
        const result = await verificarAutenticacion(email, response, challengeId, tipo);

        if (result.success) {
          setEstado(`¡${tipo.toUpperCase()} registrada exitosamente!`);
        } else {
          setEstado(`Error: ${result.error}`);
        }
      } catch (error) {
        setEstado(error instanceof Error ? error.message : 'Fichaje cancelado o no pudo completarse.');
      }
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center space-y-8 bg-gray-50 p-4">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">Fichajes</h1>
        <p className="text-gray-500">Control de asistencia biométrico</p>
      </div>

      <div className="mt-4 w-full max-w-sm space-y-6">
        <input
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
          className="w-full rounded-2xl border-2 border-gray-300 px-4 py-4 text-center text-xl font-medium text-gray-700 focus:border-green-500 focus:outline-none"
        />

        <button
          onClick={() => registrarFichaje('entrada')}
          disabled={isPending}
          className="w-full rounded-[2rem] bg-green-600 py-12 text-4xl font-extrabold text-white shadow-xl transition-all active:scale-95 disabled:opacity-50"
        >
          ENTRADA
        </button>

        <button
          onClick={() => registrarFichaje('salida')}
          disabled={isPending}
          className="w-full rounded-[2rem] bg-red-600 py-12 text-4xl font-extrabold text-white shadow-xl transition-all active:scale-95 disabled:opacity-50"
        >
          SALIDA
        </button>
      </div>

      {estado && (
        <div role="status" aria-live="polite" className={`w-full max-w-sm rounded-xl px-6 py-4 text-center font-semibold shadow-sm ${estado.includes('exitosamente') ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
          {estado}
        </div>
      )}
    </main>
  );
}
