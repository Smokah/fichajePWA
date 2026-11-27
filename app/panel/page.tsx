"use client";

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { obtenerDatosAdministrativos, type AdminSession } from '../actions/admin';
import { solicitarAccesoAdmin, cerrarSesionAdmin } from '../actions/auth';
import { ReportesTab } from '@/components/panel/ReportesTab';
import { RegistrosTab } from '@/components/panel/RegistrosTab';
import { SucursalesEmpleadosTab } from '@/components/panel/SucursalesEmpleadosTab';
import { UsuariosAdminTab } from '@/components/panel/UsuariosAdminTab';
import { AyudaYDemoButtons } from '@/components/AyudaYDemo';

type TabKey = 'reportes' | 'registros' | 'sucursales' | 'admins';

function getFechaArgentinaISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default function PanelAdministrativo() {
  const [email, setEmail] = useState('');
  const [session, setSession] = useState<AdminSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('reportes');
  const hoy = getFechaArgentinaISO();
  const [fechaDesde, setFechaDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [sucursalFiltro, setSucursalFiltro] = useState('TODAS');
  const [datos, setDatos] = useState<{
    sucursales: any[]; empleados: any[]; fichajes: any[]; usuariosAdmin: any[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const cargarDatos = useCallback((desde = fechaDesde, hasta = fechaHasta, suc = sucursalFiltro) => {
    startTransition(async () => {
      try {
        setError('');
        const res = await obtenerDatosAdministrativos({ fechaDesde: desde, fechaHasta: hasta, sucursalId: suc });
        setSession(res.session);
        setDatos({ sucursales: res.sucursales, empleados: res.empleados, fichajes: res.fichajes, usuariosAdmin: res.usuariosAdmin });
      } catch (e) {
        setSession(null);
        setDatos(null);
        if (authReady) setError(e instanceof Error ? e.message : 'No hay una sesión administrativa activa.');
      } finally {
        setAuthReady(true);
      }
    });
  }, [fechaDesde, fechaHasta, sucursalFiltro, authReady]);

  useEffect(() => { cargarDatos(); }, []);

  const enviarEnlace = () => {
    startTransition(async () => {
      try {
        setError('');
        await solicitarAccesoAdmin(email);
        setMagicSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo enviar el enlace.');
      }
    });
  };

  const salir = () => {
    startTransition(async () => {
      await cerrarSesionAdmin();
      setSession(null); setDatos(null); setMagicSent(false);
    });
  };

  if (!authReady && !session) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Verificando sesión administrativa...</main>;
  }

  if (!session || !datos) {
    return (
      <main className="flex min-h-screen flex-col justify-between bg-slate-50 px-5 py-6">
        <header className="mx-auto flex w-full max-w-sm items-center justify-between border-b border-slate-200 pb-4">
          <Link href="/" className="text-xs font-medium text-slate-600 hover:text-slate-900">← Terminal de Fichaje</Link>
          <span className="text-xs font-semibold text-slate-400">Acceso Corporativo</span>
        </header>
        <section className="mx-auto my-auto w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h1 className="text-lg font-semibold text-slate-900">Consola de Administración</h1>
              <p className="mt-1 text-xs text-slate-500">Ingresá tu correo corporativo habilitado. Recibirás un enlace seguro de acceso.</p>
            </div>
            {magicSent ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Si el correo está habilitado, recibirás un enlace de acceso. Revisá también la carpeta de correo no deseado.
              </div>
            ) : (
              <>
                <label className="block text-xs font-medium text-slate-700">
                  Correo corporativo
                  <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <button onClick={enviarEnlace} disabled={isPending || !email.trim()}
                  className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                  {isPending ? 'Enviando...' : 'Enviar enlace seguro'}
                </button>
              </>
            )}
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-center text-xs text-rose-900">{error}</p>}
          </div>
        </section>
        <footer className="mx-auto w-full max-w-sm text-center text-[11px] text-slate-400">AccesoMóvil Enterprise · Gestión de Tiempo y Asistencia</footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:border-none">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">AM</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900">Gestión de Asistencia</h1>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-700">{session.rol}</span>
              </div>
              <p className="text-xs text-slate-500">{session.nombre} · {session.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 print:hidden">
            <AyudaYDemoButtons />
            <button onClick={() => cargarDatos()} disabled={isPending} className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700">
              {isPending ? 'Actualizando...' : 'Sincronizar'}
            </button>
            <button onClick={salir} disabled={isPending} className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white">Cerrar sesión</button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 md:px-8 print:hidden">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {([
              ['reportes', 'Informes y Horas'],
              ['registros', `Registro de Marcas (${datos.fichajes.length})`],
              ['sucursales', `Personal y Sucursales (${datos.empleados.length})`],
              ...(session.rol === 'superadmin' ? [['admins', 'Operadores Administrativos']] : []),
            ] as [TabKey, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold ${tab === key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'}`}>{label}</button>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
          <label className="text-[11px] font-medium text-slate-500">Fecha desde
            <input type="date" value={fechaDesde} onChange={e => {setFechaDesde(e.target.value); cargarDatos(e.target.value, fechaHasta, sucursalFiltro);}} className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800" />
          </label>
          <label className="text-[11px] font-medium text-slate-500">Fecha hasta
            <input type="date" value={fechaHasta} onChange={e => {setFechaHasta(e.target.value); cargarDatos(fechaDesde, e.target.value, sucursalFiltro);}} className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800" />
          </label>
          {session.rol === 'superadmin' && <label className="text-[11px] font-medium text-slate-500">Sucursal
            <select value={sucursalFiltro} onChange={e => {setSucursalFiltro(e.target.value); cargarDatos(fechaDesde, fechaHasta, e.target.value);}} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800">
              <option value="TODAS">Todas las sucursales</option>
              {datos.sucursales.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
            </select>
          </label>}
        </div>
        {tab === 'reportes' && <ReportesTab fichajes={datos.fichajes} totalEmpleados={datos.empleados.length} rangoFechas={{ desde: fechaDesde, hasta: fechaHasta }} />}
        {tab === 'registros' && <RegistrosTab fichajes={datos.fichajes} empleados={datos.empleados} onRefresh={() => cargarDatos()} />}
        {tab === 'sucursales' && <SucursalesEmpleadosTab sucursales={datos.sucursales} empleados={datos.empleados} onRefresh={() => cargarDatos()} />}
        {tab === 'admins' && session.rol === 'superadmin' && <UsuariosAdminTab usuariosAdmin={datos.usuariosAdmin} sucursales={datos.sucursales} onRefresh={() => cargarDatos()} />}
      </div>
    </main>
  );
}
