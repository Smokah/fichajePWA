"use client";

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { obtenerDatosAdministrativos, type AdminSession } from '../actions/admin';
import { ReportesTab } from '@/components/panel/ReportesTab';
import { RegistrosTab } from '@/components/panel/RegistrosTab';
import { SucursalesEmpleadosTab } from '@/components/panel/SucursalesEmpleadosTab';
import { UsuariosAdminTab } from '@/components/panel/UsuariosAdminTab';

type TabKey = 'reportes' | 'registros' | 'sucursales' | 'admins';

export default function PanelAdministrativo() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('reportes');

  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const [fechaDesde, setFechaDesde] = useState(inicioMes);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [sucursalFiltro, setSucursalFiltro] = useState('TODAS');

  const [datos, setDatos] = useState<{
    sucursales: any[];
    empleados: any[];
    fichajes: any[];
    usuariosAdmin: any[];
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const cargarDatos = (customDesde = fechaDesde, customHasta = fechaHasta, customSuc = sucursalFiltro) => {
    startTransition(async () => {
      try {
        setError('');
        const res = await obtenerDatosAdministrativos(
          { identificador, pin },
          { fechaDesde: customDesde, fechaHasta: customHasta, sucursalId: customSuc }
        );
        setSession(res.session);
        setDatos({
          sucursales: res.sucursales,
          empleados: res.empleados,
          fichajes: res.fichajes,
          usuariosAdmin: res.usuariosAdmin,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Credenciales inválidas');
      }
    });
  };

  if (!session || !datos) {
    return (
      <main className="flex min-h-screen flex-col justify-between bg-slate-50 px-5 py-6">
        <header className="mx-auto flex w-full max-w-sm items-center justify-between border-b border-slate-200 pb-4">
          <Link href="/" className="text-xs font-medium text-slate-600 hover:text-slate-900">
            ← Terminal de Fichaje
          </Link>
          <span className="text-xs font-semibold text-slate-400">Acceso Corporativo</span>
        </header>

        <section className="mx-auto my-auto w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h1 className="text-lg font-semibold text-slate-900">Consola de Administración</h1>
              <p className="text-xs text-slate-500 mt-1">
                Dirección General: ingresar únicamente PIN maestro.<br />
                Operadores RRHH: ingresar correo y PIN asignado.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Correo del operador</label>
                <input
                  type="email"
                  placeholder="Opcional para Dirección General"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">PIN de seguridad</label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && cargarDatos()}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.35em] text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => cargarDatos()}
              disabled={isPending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? 'Verificando...' : 'Iniciar Sesión'}
            </button>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-center text-xs font-medium text-rose-900">
                {error}
              </div>
            )}
          </div>
        </section>

        <footer className="mx-auto w-full max-w-sm text-center text-[11px] text-slate-400">
          AccesoMóvil Enterprise · Gestión de Tiempo y Asistencia
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Navbar Empresarial */}
      <header className="border-b border-slate-200 bg-white print:border-none">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold tracking-wider text-white">
              AM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900">Gestión de Asistencia</h1>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-700 ring-1 ring-inset ring-slate-300/60">
                  {session.rol}
                </span>
              </div>
              <p className="text-xs text-slate-500">{session.nombre}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 print:hidden">
            <button
              onClick={() => cargarDatos()}
              disabled={isPending}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isPending ? 'Actualizando...' : 'Sincronizar'}
            </button>
            <button
              onClick={() => {
                setSession(null);
                setDatos(null);
                setPin('');
              }}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación Corporativa */}
        <div className="mx-auto max-w-6xl px-4 md:px-8 print:hidden">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            <button
              onClick={() => setTab('reportes')}
              className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${
                tab === 'reportes'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              Informes y Horas
            </button>
            <button
              onClick={() => setTab('registros')}
              className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${
                tab === 'registros'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              Registro de Marcas ({datos.fichajes.length})
            </button>
            <button
              onClick={() => setTab('sucursales')}
              className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${
                tab === 'sucursales'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              Personal y Sucursales ({datos.empleados.length})
            </button>
            {session.rol === 'superadmin' && (
              <button
                onClick={() => setTab('admins')}
                className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${
                  tab === 'admins'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                Operadores Administrativos
              </button>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                cargarDatos(e.target.value, fechaHasta, sucursalFiltro);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                cargarDatos(fechaDesde, e.target.value, sucursalFiltro);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            />
          </div>
          {!session.sucursal_id && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Sucursal</label>
              <select
                value={sucursalFiltro}
                onChange={(e) => {
                  setSucursalFiltro(e.target.value);
                  cargarDatos(fechaDesde, fechaHasta, e.target.value);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 bg-white focus:border-slate-900 focus:outline-none"
              >
                <option value="TODAS">Todas las sucursales</option>
                {datos.sucursales.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Vistas Modulares */}
        {tab === 'reportes' && (
          <ReportesTab
            fichajes={datos.fichajes}
            totalEmpleados={datos.empleados.length}
            rangoFechas={{ desde: fechaDesde, hasta: fechaHasta }}
          />
        )}

        {tab === 'registros' && (
          <RegistrosTab
            credenciales={{ identificador, pin }}
            fichajes={datos.fichajes}
            empleados={datos.empleados}
            onRefresh={() => cargarDatos()}
          />
        )}

        {tab === 'sucursales' && (
          <SucursalesEmpleadosTab
            credenciales={{ identificador, pin }}
            sucursales={datos.sucursales}
            empleados={datos.empleados}
            onRefresh={() => cargarDatos()}
          />
        )}

        {tab === 'admins' && session.rol === 'superadmin' && (
          <UsuariosAdminTab
            credenciales={{ identificador, pin }}
            usuariosAdmin={datos.usuariosAdmin}
            sucursales={datos.sucursales}
            onRefresh={() => cargarDatos()}
          />
        )}
      </div>
    </main>
  );
}
