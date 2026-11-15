"use client";

import { useState, useTransition } from 'react';
import {
  crearSucursalAdmin,
  generarCodigoSucursalAdmin,
  resetearPasskeyEmpleado,
} from '@/app/actions/admin';

interface SucursalesTabProps {
  credenciales: { identificador: string; pin: string };
  sucursales: any[];
  empleados: any[];
  onRefresh: () => void;
}

export function SucursalesEmpleadosTab({
  credenciales,
  sucursales,
  empleados,
  onRefresh,
}: SucursalesTabProps) {
  const [nuevaSucursal, setNuevaSucursal] = useState('');
  const [sucursalCodigo, setSucursalCodigo] = useState<number>(sucursales[0]?.id || 1);
  const [codigoGenerado, setCodigoGenerado] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleCrearSucursal = () => {
    if (!nuevaSucursal.trim()) return;
    startTransition(async () => {
      try {
        await crearSucursalAdmin(credenciales, nuevaSucursal);
        setNuevaSucursal('');
        onRefresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error creando sucursal');
      }
    });
  };

  const handleGenerarCodigo = () => {
    startTransition(async () => {
      try {
        const res = await generarCodigoSucursalAdmin(credenciales, sucursalCodigo, 30, 30);
        setCodigoGenerado(res.codigoPlano);
        onRefresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error generando código');
      }
    });
  };

  const handleResetPasskey = (empleadoId: string, nombre: string) => {
    if (!confirm(`¿Desvincular el celular de ${nombre} para que pueda registrar uno nuevo?`)) return;
    startTransition(async () => {
      try {
        await resetearPasskeyEmpleado(credenciales, empleadoId);
        onRefresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error reseteando dispositivo');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Sucursales ({sucursales.length})</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre nueva sucursal..."
              value={nuevaSucursal}
              onChange={(e) => setNuevaSucursal(e.target.value)}
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={handleCrearSucursal}
              disabled={isPending}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              + Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sucursales.map((s) => (
              <span key={s.id} className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                #{s.id} {s.nombre}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Generar Código de Alta</h2>
          <div className="flex gap-2">
            <select
              value={sucursalCodigo}
              onChange={(e) => setSucursalCodigo(Number(e.target.value))}
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <button
              onClick={handleGenerarCodigo}
              disabled={isPending}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Generar Código
            </button>
          </div>
          {codigoGenerado && (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-center">
              <p className="text-xs text-blue-800">Código listo para compartir (30 usos / 30 días):</p>
              <p className="font-mono text-xl font-bold tracking-widest text-blue-950 select-all">
                {codigoGenerado}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Nómina de Empleados ({empleados.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="py-3 px-2">Nombre</th>
                <th className="py-3 px-2">Email</th>
                <th className="py-3 px-2">Sucursal</th>
                <th className="py-3 px-2">Dispositivo</th>
                <th className="py-3 px-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empleados.map((emp) => {
                const vinculado = (emp.credenciales_biometricas?.length ?? 0) > 0;
                return (
                  <tr key={emp.id}>
                    <td className="py-3 px-2 font-medium text-gray-900">{emp.nombre}</td>
                    <td className="py-3 px-2 text-gray-500">{emp.email}</td>
                    <td className="py-3 px-2 text-gray-600">{emp.sucursales?.nombre || '-'}</td>
                    <td className="py-3 px-2">
                      {vinculado ? (
                        <span className="text-xs font-semibold text-green-700">✓ Vinculado</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600">Pendiente</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {vinculado && (
                        <button
                          onClick={() => handleResetPasskey(emp.id, emp.nombre)}
                          className="text-xs text-red-600 underline hover:text-red-800"
                        >
                          Resetear celular
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
