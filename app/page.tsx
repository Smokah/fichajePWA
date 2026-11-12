"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { solicitarBiometria } from '@/lib/webauthn';

export default function PantallaFichaje() {
  const [estado, setEstado] = useState<string>('');
  const [cargando, setCargando] = useState<boolean>(false);
  
  // MVP: Asumimos que el ID del empleado ya está disponible (ej. por sesión activa)
  const empleadoId = "ID_DEL_EMPLEADO_AQUI"; 

  const registrarFichaje = async (tipo: 'entrada' | 'salida') => {
    setCargando(true);
    setEstado('Esperando biometría...');

    const autenticado = await solicitarBiometria();

    if (!autenticado) {
      setEstado('Fichaje cancelado: biometría no validada.');
      setCargando(false);
      return;
    }

    setEstado(`Registrando ${tipo} en la base de datos...`);

    const { error } = await supabase
      .from('fichajes')
      .insert([
        { 
          empleado_id: empleadoId, 
          tipo: tipo 
          // hora_registro no se envía, asumiendo que Supabase usa default now()
        }
      ]);

    if (error) {
      setEstado(`Error al guardar: ${error.message}`);
    } else {
      setEstado(`¡${tipo.toUpperCase()} registrada exitosamente!`);
    }
    
    setCargando(false);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Control de Asistencia</h1>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => registrarFichaje('entrada')}
          disabled={cargando}
          className="w-full py-16 text-4xl font-extrabold text-white bg-green-600 rounded-3xl shadow-lg active:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
        >
          ENTRADA
        </button>

        <button
          onClick={() => registrarFichaje('salida')}
          disabled={cargando}
          className="w-full py-16 text-4xl font-extrabold text-white bg-red-600 rounded-3xl shadow-lg active:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
        >
          SALIDA
        </button>
      </div>

      {estado && (
        <div className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-lg text-center w-full max-w-sm">
          {estado}
        </div>
      )}
    </main>
  );
}
