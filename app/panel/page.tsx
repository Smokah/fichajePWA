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
        setError(e instanceof Error ? e.message : 'Error de autenticación');
      }
    });
  };

  if (!session || !datos) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Panel Administrativo</h1>
            <p className="text-xs text-gray-500">
              Dueño: dejá el correo vacío e ingresá el PIN maestro (1234).<br />
              Administrativos: ingresá tu correo y PIN asignado.
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              placeholder="Correo administrativo (opcional para Dueño)"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none"
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN de acceso"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && cargarDatos()}
              className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-gray-900 focus:outline-none"
            />
          </div>

          <button
            onClick={() => cargarDatos()}
            disabled={isPending}
            className="w-full rounded-xl bg-gray-900 py-3.5 text-base font-bold text-white hover:bg-black disabled:opacity-50"
          >
            {isPending ? 'Ingresando...' : 'Acceder al Panel'}
          </button>

          {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}

          <div className="text-center">
            <Link href="/" className="text-xs text-gray-500 underline">
              ← Volver al fichador
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Panel Administrativo</h1>
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold uppercase text-indigo-800">
                {session.rol}
              </span>
            </div>
            <p className="text-xs text-gray-500">Sesión activa: {session.nombre}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => cargarDatos()}
              disabled={isPending}
              className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? 'Sincronizando...' : '↻ Actualizar Datos'}
            </button>
            <button
              onClick={() => {
                setSession(null);
                setDatos(null);
                setPin('');
              }}
              className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Salir
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                cargarDatos(e.target.value, fechaHasta, sucursalFiltro);
              }}
              className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                cargarDatos(fechaDesde, e.target.value, sucursalFiltro);
              }}
              className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          {!session.sucursal_id && (
            <div>
              <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Sucursal</label>
              <select
                value={sucursalFiltro}
                onChange={(e) => {
                  setSucursalFiltro(e.target.value);
                  cargarDatos(fechaDesde, fechaHasta, e.target.value);
                }}
                className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm bg-white"
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

        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => setTab('reportes')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === 'reportes' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-200'
            }`}
          >
            📊 Reportes y Horas
          </button>
          <button
            onClick={() => setTab('registros')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === 'registros' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-200'
            }`}
          >
            🕒 Fichajes ({datos.fichajes.length})
          </button>
          <button
            onClick={() => setTab('sucursales')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === 'sucursales' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-200'
            }`}
          >
            🏢 Sucursales y Empleados
          </button>
          {session.rol === 'superadmin' && (
            <button
              onClick={() => setTab('admins')}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                tab === 'admins' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              🔐 Usuarios Administrativos (CRUD)
            </button>
          )}
        </div>

        {tab === 'reportes' && (
          <ReportesTab fichajes={datos.fichajes} totalEmpleados={datos.empleados.length} />
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
