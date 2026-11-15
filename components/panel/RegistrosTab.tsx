"use client";

import { useState, useTransition } from 'react';
import { registrarFichajeManualAdmin } from '@/app/actions/admin';
import type { FichajeRaw } from '@/lib/horas-utils';

interface RegistrosTabProps {
  credenciales: { identificador: string; pin: string };
  fichajes: FichajeRaw[];
  empleados: any[];
  onRefresh: () => void;
}

export function RegistrosTab({ credenciales, fichajes, empleados, onRefresh }: RegistrosTabProps) {
  const [empManual, setEmpManual] = useState('');
  const [tipoManual, setTipoManual] = useState<'entrada' | 'salida'>('salida');
  const [fechaManual, setFechaManual] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleFichajeManual = () => {
    if (!empManual || !fechaManual) return alert('Seleccioná empleado y fecha/hora.');
    startTransition(async () => {
      try {
        await registrarFichajeManualAdmin(credenciales, empManual, tipoManual, fechaManual);
        setFechaManual('');
        onRefresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error cargando registro');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Carga Manual / Corrección Administrativa */}
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-gray-800">Registrar Fichaje Manual (Corrección por olvido)</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={empManual}
            onChange={(e) => setEmpManual(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">Seleccionar empleado...</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} ({e.sucursales?.nombre || 'Sin sucursal'})
              </option>
            ))}
          </select>
          <select
            value={tipoManual}
            onChange={(e) => setTipoManual(e.target.value as 'entrada' | 'salida')}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
          <input
            type="datetime-local"
            value={fechaManual}
            onChange={(e) => setFechaManual(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleFichajeManual}
            disabled={isPending}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : '+ Agregar Registro'}
          </button>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Historial de Movimientos ({fichajes.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="py-3 px-2">Empleado</th>
                <th className="py-3 px-2">Sucursal</th>
                <th className="py-3 px-2">Tipo</th>
                <th className="py-3 px-2">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fichajes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    Sin movimientos en el período seleccionado.
                  </td>
                </tr>
              ) : (
                fichajes.map((f) => {
                  const esEntrada = String(f.tipo).toLowerCase() === 'entrada';
                  const fecha = new Date(f.hora_registro).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-900">{f.empleados?.nombre || 'Desconocido'}</td>
                      <td className="py-3 px-2 text-gray-600">{f.empleados?.sucursales?.nombre || 'Sin sucursal'}</td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                            esEntrada ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {f.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-mono text-xs text-gray-600">{fecha}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
