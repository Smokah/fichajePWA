"use client";

import { useState, useTransition } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { iniciarAltaEmpleado, verificarRegistro } from '../acciones';

export default function RegistroBiometrico() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState('');
  const [isPending, startTransition] = useTransition();

  const enrolarDispositivo = () => {
    if (nombre.trim().length < 2) return setEstado('Ingresá tu nombre y apellido.');
    if (!email.trim()) return setEstado('Ingresá tu correo electrónico.');
    if (!/^[a-fA-F0-9]{16}$/.test(codigo.trim())) {
      return setEstado('Ingresá el código de sucursal de 16 caracteres que te entregó el administrador.');
    }

    startTransition(async () => {
      try {
        setEstado('Validando el código de sucursal y creando tu registro...');
        const { options, challengeId, empleadoNombre } = await iniciarAltaEmpleado(nombre, email, codigo);

        setEstado(`Hola ${empleadoNombre}. Confirmá tu identidad con huella, Face ID o el bloqueo de pantalla del dispositivo...`);
        const response = await startRegistration({ optionsJSON: options });

        setEstado('Verificando y guardando tu Passkey...');
        const result = await verificarRegistro(email, response, challengeId);

        if (result.success) {
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
    <main className="flex min-h-screen flex-col items-center justify-center space-y-8 bg-gray-50 p-4">
      <div className="w-full max-w-sm space-y-2 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Alta de empleado</h1>
        <p className="text-sm text-gray-600">Ingresá tus datos y el código de tu sucursal. Después registrá una Passkey para fichar desde este dispositivo.</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Nombre y apellido</span>
          <input
            type="text"
            autoComplete="name"
            placeholder="Tu nombre completo"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            disabled={isPending}
            maxLength={120}
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-center text-lg focus:border-blue-500 focus:outline-none"
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
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-center text-lg focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Código de sucursal</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={16}
            placeholder="Código de 16 caracteres"
            value={codigo}
            onChange={(event) => setCodigo(event.target.value.replace(/[^a-fA-F0-9]/g, '').slice(0, 16))}
            disabled={isPending}
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-center font-mono text-lg uppercase tracking-widest focus:border-blue-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500">Solicitá el código al administrador de tu sucursal. Tiene una cantidad limitada de altas y una fecha de vencimiento.</p>
        </label>

        <button
          onClick={enrolarDispositivo}
          disabled={isPending}
          className="w-full rounded-2xl bg-blue-600 py-4 text-xl font-bold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
        >
          {isPending ? 'Procesando...' : 'Crear cuenta y registrar Passkey'}
        </button>
      </div>

      {estado && (
        <div role="status" aria-live="polite" className="w-full max-w-sm rounded-xl bg-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-800">
          {estado}
        </div>
      )}
    </main>
  );
}
