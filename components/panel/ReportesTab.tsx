"use client";

import { useMemo } from 'react';
import { calcularEstadisticasEmpleados, formatearDuracion, type FichajeRaw } from '@/lib/horas-utils';

interface ReportesTabProps {
  fichajes: FichajeRaw[];
  totalEmpleados: number;
}

export function ReportesTab({ fichajes, totalEmpleados }: ReportesTabProps) {
  const resumenEmpleados = useMemo(() => calcularEstadisticasEmpleados(fichajes), [fichajes]);

  const kpis = useMemo(() => {
    const totalMinutos = resumenEmpleados.reduce((acc, e) => acc + e.totalMinutos, 0);
    const enTurno = resumenEmpleados.filter((e) => e.estadoActual === 'En turno').length;
    const incompletos = resumenEmpleados.filter((e) => e.estadoActual === 'Incompleto').length;
    return {
      totalHoras: formatearDuracion(totalMinutos),
      enTurno,
      incompletos,
      totalRegistros: fichajes.length,
    };
  }, [resumenEmpleados, fichajes.length]);

  const exportarCSV = () => {
    const headers = ['Empleado', 'Email', 'Sucursal', 'Entradas', 'Salidas', 'Total Horas', 'Minutos Totales', 'Estado Actual'];
    const rows = resumenEmpleados.map((r) => [
      `"${r.nombre}"`,
      `"${r.email}"`,
      `"${r.sucursal}"`,
      r.cantidadEntradas,
      r.cantidadSalidas,
      `"${r.horasFormateadas}"`,
      r.totalMinutos,
      `"${r.estadoActual}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_horas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Estadísticas (KPIs) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">Horas Acumuladas</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-900">{kpis.totalHoras}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">Activos en Turno</p>
          <p className="mt-2 text-2xl font-extrabold text-green-600">
            {kpis.enTurno} <span className="text-sm font-normal text-gray-400">/ {totalEmpleados}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">Fichajes en Período</p>
          <p className="mt-2 text-2xl font-extrabold text-blue-600">{kpis.totalRegistros}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">Turnos Sin Cerrar (+16h)</p>
          <p className={`mt-2 text-2xl font-extrabold ${kpis.incompletos > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {kpis.incompletos}
          </p>
        </div>
      </div>

      {/* Tabla de Cálculo de Horas por Empleado */}
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Cálculo de Horas Trabajadas</h2>
            <p className="text-xs text-gray-500">Emparejamiento automático de Entrada y Salida en el rango seleccionado</p>
          </div>
          <button
            onClick={exportarCSV}
            className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            ↓ Exportar Reporte Excel (CSV)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="py-3 px-2">Empleado</th>
                <th className="py-3 px-2">Sucursal</th>
                <th className="py-3 px-2 text-center">Entradas / Salidas</th>
                <th className="py-3 px-2">Horas Totales</th>
                <th className="py-3 px-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resumenEmpleados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No hay suficientes registros en este rango de fechas para calcular horas.
                  </td>
                </tr>
              ) : (
                resumenEmpleados.map((r) => (
                  <tr key={r.empleadoId} className="hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <p className="font-semibold text-gray-900">{r.nombre}</p>
                      <p className="text-xs text-gray-400">{r.email}</p>
                    </td>
                    <td className="py-3 px-2 text-gray-600">{r.sucursal}</td>
                    <td className="py-3 px-2 text-center font-mono text-xs text-gray-600">
                      {r.cantidadEntradas} E / {r.cantidadSalidas} S
                    </td>
                    <td className="py-3 px-2 font-mono text-base font-bold text-gray-900">
                      {r.horasFormateadas}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.estadoActual === 'En turno'
                            ? 'bg-green-100 text-green-800'
                            : r.estadoActual === 'Incompleto'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.estadoActual}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
