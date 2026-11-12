"use client";

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { generarOpcionesRegistro, verificarRegistro } from '../acciones';

export default function RegistroBiometrico() {
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(false);
  
  const empleadoId = "ID_DEL_EMPLEADO_AQUI"; 

  const enrolarDispositivo = async () => {
    setCargando(true);
    try {
      setEstado('Generando protocolo de seguridad...');
      const opciones = await generarOpcionesRegistro(empleadoId);

      setEstado('Por favor, usa tu huella o rostro para vincular este celular...');
      // WebAuthn v10+ requiere envolver las opciones en optionsJSON
      const respuestaBiometrica = await startRegistration({ optionsJSON: opciones });

      setEstado('Guardando credencial en el servidor...');
      const resultado = await verificarRegistro(empleadoId, respuestaBiometrica, opciones.challenge);

      if (resultado.success) {
        setEstado('¡Celular vinculado exitosamente! Ya puedes ir a fichar.');
      } else {
        setEstado(`Error al guardar: ${resultado.error}`);
      }
    } catch (error: any) {
      setEstado(`Operación cancelada o fallida.`);
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Vincular Celular</h1>
      <p className="text-center text-gray-600 max-w-xs">
        Registra tu huella o FaceID en este dispositivo para poder fichar tu entrada y salida.
      </p>

      <button
        onClick={enrolarDispositivo}
        disabled={cargando}
        className="w-full max-w-sm py-4 text-xl font-bold text-white bg-blue-600 rounded-2xl shadow-lg active:bg-blue-700 transition-all disabled:opacity-50"
      >
        Registrar Huella / FaceID
      </button>

      {estado && (
        <div className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-center w-full max-w-sm">
          {estado}
        </div>
      )}
    </main>
  );
}
