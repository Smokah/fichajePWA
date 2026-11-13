"use client";

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { generarOpcionesAutenticacion, verificarAutenticacion } from './acciones';

export default function PantallaFichaje() {
  const [estado, setEstado] = useState<string>('');
  const [cargando, setCargando] = useState<boolean>(false);
  
  // Debe coincidir con el ID que vinculaste en /registro
  const empleadoId = "EMPLEADO_TEST_2"; 

  const registrarFichaje = async (tipo: 'entrada' | 'salida') => {
    setCargando(true);
    setEstado('Validando identidad...');

    try {
      // 1. Pedimos al servidor el desafío criptográfico para este empleado
      const opciones = await generarOpcionesAutenticacion(empleadoId);

      setEstado('Por favor, usa tu huella o FaceID...');
      
      // 2. Invocamos el lector biométrico del celular
      const respuestaBiometrica = await startAuthentication({ optionsJSON: opciones });

      setEstado(`Registrando ${tipo} de forma segura...`);
      
      // 3. Enviamos la firma para verificar e insertar en Supabase
      const resultado = await verificarAutenticacion(
        empleadoId, 
        respuestaBiometrica, 
        opciones.challenge, 
        tipo
      );

      if (resultado.success) {
        setEstado(`¡${tipo.toUpperCase()} registrada exitosamente!`);
        // Limpiar el mensaje de éxito después de 4 segundos para el próximo fichaje
        setTimeout(() => setEstado(''), 4000);
      } else {
        setEstado(`Error al fichar: ${resultado.error}`);
      }
    } catch (error: any) {
      console.error(error);
      // Atrapa si el empleado cancela el prompt de la huella o no tiene credenciales
      setEstado(error.message || 'Fichaje cancelado o fallido.');
    } finally {
      setCargando(false);
    }
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
          disabled={cargando}
          className="w-full py-16 text-4xl font-extrabold text-white bg-green-600 rounded-[2rem] shadow-xl active:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
        >
          ENTRADA
        </button>

        <button
          onClick={() => registrarFichaje('salida')}
          disabled={cargando}
          className="w-full py-16 text-4xl font-extrabold text-white bg-red-600 rounded-[2rem] shadow-xl active:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
        >
          SALIDA
        </button>
      </div>

      {estado && (
        <div className={`px-6 py-4 rounded-xl text-center w-full max-w-sm font-semibold shadow-sm transition-all ${
          estado.includes('exitosamente') ? 'bg-green-100 text-green-800' : 
          estado.includes('Error') || estado.includes('cancelado') ? 'bg-red-100 text-red-800' : 
          'bg-blue-100 text-blue-800'
        }`}>
          {estado}
        </div>
      )}
    </main>
  );
}
