"use client";

import { useMemo } from 'react';
import { calcularEstadisticasEmpleados, formatearDuracion, type FichajeRaw } from '@/lib/horas-utils';

const TZ_ARGENTINA = 'America/Argentina/Buenos_Aires';

interface ReportesTabProps {
  fichajes: FichajeRaw[];
  totalEmpleados: number;
  rangoFechas: { desde: string; hasta: string };
}

export function ReportesTab({ fichajes, totalEmpleados, rangoFechas }: ReportesTabProps) {
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

  const exportarCSVResumen = () => {
    const sep = ';';
    const headers = ['Empleado', 'Correo', 'Sucursal', 'Entradas', 'Salidas', 'Horas Trabajadas', 'Minutos', 'Estado'];
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
    const bom = '\uFEFF';
    const csvContent = bom + [headers.join(sep), ...rows.map((e) => e.join(sep))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_horas_${rangoFechas.desde}_a_${rangoFechas.hasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportarCSVDetallado = () => {
    const sep = ';';
    const headers = ['ID', 'Empleado', 'Correo', 'Sucursal', 'Movimiento', 'Fecha (ART)', 'Hora (ART)'];
    const rows = fichajes.map((f) => {
      const dt = new Date(f.hora_registro);
      return [
        f.id,
        `"${f.empleados?.nombre || ''}"`,
        `"${f.empleados?.email || ''}"`,
        `"${(f as any).sucursales?.nombre || f.empleados?.sucursales?.nombre || 'Sin sucursal'}"`,
        `"${String(f.tipo).toUpperCase()}"`,
        `"${dt.toLocaleDateString('es-AR', { timeZone: TZ_ARGENTINA })}"`,
        `"${dt.toLocaleTimeString('es-AR', { timeZone: TZ_ARGENTINA, hour: '2-digit', minute: '2-digit', second: '2-digit' })}"`,
      ];
    });
    const bom = '\uFEFF';
    const csvContent = bom + [headers.join(sep), ...rows.map((e) => e.join(sep))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `detalle_marcas_${rangoFechas.desde}_a_${rangoFechas.hasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const imprimirPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Horas Computadas</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900">{kpis.totalHoras}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Personal en Turno</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {kpis.enTurno} <span className="text-sm font-normal text-slate-400">/ {totalEmpleados}</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total de Marcas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{kpis.totalRegistros}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Jornadas Abiertas (+16h)</p>
          <p className={`mt-2 text-2xl font-semibold ${kpis.incompletos > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {kpis.incompletos}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Consolidado de Horas por Empleado</h2>
            <p className="text-xs text-slate-500">
              Período: {rangoFechas.desde} al {rangoFechas.hasta} (Hora Argentina)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={exportarCSVResumen}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Exportar Resumen (CSV)
            </button>
            <button
              onClick={exportarCSVDetallado}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Exportar Marcas Detalladas (CSV)
            </button>
            <button
              onClick={imprimirPDF}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
            >
              Imprimir / Guardar PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Colaborador</th>
                <th className="py-3 px-3">Sucursal</th>
                <th className="py-3 px-3 text-center">Marcas (E/S)</th>
                <th className="py-3 px-3">Total Horas</th>
                <th className="py-3 px-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resumenEmpleados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                    No existen registros en el período seleccionado.
                  </td>
                </tr>
              ) : (
                resumenEmpleados.map((r) => (
                  <tr key={r.empleadoId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3">
                      <p className="font-medium text-slate-900">{r.nombre}</p>
                      <p className="text-xs text-slate-500">{r.email}</p>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">{r.sucursal}</td>
                    <td className="py-3.5 px-3 text-center font-mono text-xs text-slate-600">
                      {r.cantidadEntradas} / {r.cantidadSalidas}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-sm font-semibold text-slate-900">
                      {r.horasFormateadas}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          r.estadoActual === 'En turno'
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20'
                            : r.estadoActual === 'Incompleto'
                            ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20'
                            : 'bg-slate-100 text-slate-600'
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
