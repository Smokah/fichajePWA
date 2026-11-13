"use client";
import { useState, useTransition } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { generarOpcionesAutenticacion, verificarAutenticacion } from './acciones';

export default function PantallaFichaje() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('');
  const [isPending, startTransition] = useTransition();

  const registrarFichaje = (tipo: 'entrada' | 'salida') => {
    if (!email) return setEstado('Ingresa tu correo para fichar.');

    startTransition(async () => {
      setEstado('Validando identidad...');
      try {
        const opciones = await generarOpcionesAutenticacion(email);
        setEstado('Usa tu huella o FaceID...');
        
        const respuestaBiometrica = await startAuthentication({ optionsJSON: opciones });
        setEstado(`Registrando ${tipo}...`);
        
        const resultado = await verificarAutenticacion(email, respuestaBiometrica, opciones.challenge, tipo);

        if (resultado.success) {
          setEstado(`¡${tipo.toUpperCase()} registrada exitosamente!`);
          setTimeout(() => setEstado(''), 4000);
        } else {
          setEstado(`Error: ${resultado.error}`);
        }
      } catch (error: any) {
        setEstado(error.message || 'Fichaje cancelado.');
      }
    });
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 space-y-8">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Fichajes</h1>
        <p className="text-gray-500">Control de Asistencia Biométrico</p>
      </div>

      <div className="w-full max-w-sm space-y-6 mt-4">
        <input 
          type="email" 
          placeholder="tu@email.com" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          className="w-full px-4 py-4 text-center text-xl font-medium text-gray-700 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-green-500"
        />

        <button
          onClick={() => registrarFichaje('entrada')}
          disabled={isPending}
          className="w-full py-12 text-4xl font-extrabold text-white bg-green-600 rounded-[2rem] shadow-xl active:scale-95 transition-all disabled:opacity-50"
        >
          ENTRADA
        </button>

        <button
          onClick={() => registrarFichaje('salida')}
          disabled={isPending}
          className="w-full py-12 text-4xl font-extrabold text-white bg-red-600 rounded-[2rem] shadow-xl active:scale-95 transition-all disabled:opacity-50"
        >
          SALIDA
        </button>
      </div>

      {estado && (
        <div className={`px-6 py-4 rounded-xl text-center w-full max-w-sm font-semibold shadow-sm ${estado.includes('exitosamente') ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
          {estado}
        </div>
      )}
    </main>
  );
}
