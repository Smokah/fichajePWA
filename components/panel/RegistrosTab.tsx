"use client";

import { useState, useTransition } from 'react';
import { registrarFichajeManualAdmin } from '@/app/actions/admin';
import type { FichajeRaw } from '@/lib/horas-utils';

const TZ_ARGENTINA = 'America/Argentina/Buenos_Aires';

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
    if (!empManual || !fechaManual) return alert('Seleccioná colaborador y fecha/hora.');
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
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Corrección Manual de Asistencia</h3>
          <p className="text-xs text-slate-500">Carga administrativa ante omisión de marca biométrica (Hora Argentina)</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={empManual}
            onChange={(e) => setEmpManual(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white focus:border-slate-900 focus:outline-none"
          >
            <option value="">Seleccionar colaborador...</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} ({e.sucursales?.nombre || 'Sin sede'})
              </option>
            ))}
          </select>
          <select
            value={tipoManual}
            onChange={(e) => setTipoManual(e.target.value as 'entrada' | 'salida')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white focus:border-slate-900 focus:outline-none"
          >
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
          <input
            type="datetime-local"
            value={fechaManual}
            onChange={(e) => setFechaManual(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
          />
          <button
            onClick={handleFichajeManual}
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? 'Registrando...' : 'Registrar Marca'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Log de Auditoría ({fichajes.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Colaborador</th>
                <th className="py-3 px-3">Sucursal</th>
                <th className="py-3 px-3">Movimiento</th>
                <th className="py-3 px-3 text-right">Fecha y Hora (ART)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fichajes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                    No hay movimientos registrados en este rango.
                  </td>
                </tr>
              ) : (
                fichajes.map((f) => {
                  const esEntrada = String(f.tipo).toLowerCase() === 'entrada';
                  const fecha = new Date(f.hora_registro).toLocaleString('es-AR', {
                    timeZone: TZ_ARGENTINA,
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 font-medium text-slate-900">{f.empleados?.nombre || 'Desconocido'}</td>
                      <td className="py-3 px-3 text-slate-600">{f.sucursales?.nombre || f.empleados?.sucursales?.nombre || 'Sin sede'}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                            esEntrada
                              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20'
                              : 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-600/20'
                          }`}
                        >
                          {f.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-600">{fecha}</td>
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
