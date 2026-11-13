"use client";
import { useState, useTransition } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { generarOpcionesRegistro, verificarRegistro } from '../acciones';

export default function RegistroBiometrico() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('');
  const [isPending, startTransition] = useTransition();

  const enrolarDispositivo = () => {
    if (!email) return setEstado('Por favor, ingresa tu correo electrónico.');
    
    startTransition(async () => {
      try {
        setEstado('Generando protocolo...');
        const opciones = await generarOpcionesRegistro(email);

        setEstado('Usa tu huella/FaceID para vincular...');
        const respuestaBiometrica = await startRegistration({ optionsJSON: opciones });

        setEstado('Guardando credencial...');
        const resultado = await verificarRegistro(email, respuestaBiometrica, opciones.challenge);

        if (resultado.success) {
          setEstado('¡Celular vinculado exitosamente! Ya puedes ir a fichar.');
        } else {
          setEstado(`Error: ${resultado.error}`);
        }
      } catch (error: any) {
        setEstado(error.message || 'Operación cancelada.');
      }
    });
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Vincular Celular</h1>
      
      <div className="w-full max-w-sm space-y-4">
        <input 
          type="email" 
          placeholder="tu@email.com" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          className="w-full px-4 py-4 text-center text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={enrolarDispositivo}
          disabled={isPending}
          className="w-full py-4 text-xl font-bold text-white bg-blue-600 rounded-2xl active:bg-blue-700 disabled:opacity-50"
        >
          Registrar Huella / FaceID
        </button>
      </div>

      {estado && <div className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-center w-full max-w-sm">{estado}</div>}
    </main>
  );
}
