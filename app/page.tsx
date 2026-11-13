"use client";

import { useState, useTransition } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { generarOpcionesAutenticacion, verificarAutenticacion } from './acciones';

export default function PantallaFichaje() {
  const [estado, setEstado] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  
  // Recuerda mantener el mismo ID con el que te registraste
  const empleadoId = "EMPLEADO_test_2"; 

  const registrarFichaje = (tipo: 'entrada' | 'salida') => {
    // startTransition maneja la promesa asíncrona sin romper la hidratación de React
    startTransition(async () => {
      setEstado('Validando identidad...');

      try {
        const opciones = await generarOpcionesAutenticacion(empleadoId);
        setEstado('Por favor, usa tu huella o FaceID...');
        
        const respuestaBiometrica = await startAuthentication({ optionsJSON: opciones });
        setEstado(`Registrando ${tipo} de forma segura...`);
        
        const resultado = await verificarAutenticacion(
          empleadoId, 
          respuestaBiometrica, 
          opciones.challenge, 
          tipo
        );

        if (resultado.success) {
          setEstado(`¡${tipo.toUpperCase()} registrada exitosamente!`);
          setTimeout(() => setEstado(''), 4000);
        } else {
          setEstado(`Error al fichar: ${resultado.error}`);
        }
      } catch (error: any) {
        console.error(error);
        setEstado(error.message || 'Fichaje cancelado o fallido.');
      }
    });
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 space-y-8">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Fichajes</h1>
        <p className="text-gray-500 font-medium">Control de Asistencia Biométrico</p>
      </div>

      <div className="w-full max-w-sm space-y-6 mt-4">
        <button
          onClick={() => registrarFichaje('entrada')}
          disabled={isPending}
          className="w-full py-16 text-4xl font-extrabold text-white bg-green-600 rounded-[2rem] shadow-xl active:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
        >
          ENTRADA
        </button>

        <button
          onClick={() => registrarFichaje('salida')}
          disabled={isPending}
          className="w-full py-16 text-4xl font-extrabold text-white bg-red-600 rounded-[2rem] shadow-xl active:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
        >
          SALIDA
        </button>
      </div>

      {estado && (
        <div className={`px-6 py-4 rounded-xl text-center w-full max-w-sm font-semibold shadow-sm transition-all ${
          estado.includes('exitosamente') ? 'bg-green-100 text-green-800' : 
          estado.includes('Error') || estado.includes('cancelado') || estado.includes('fallido') ? 'bg-red-100 text-red-800' : 
          'bg-blue-100 text-blue-800'
        }`}>
          {estado}
        </div>
      )}
    </main>
  );
}
