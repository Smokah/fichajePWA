"use client";

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  obtenerDatosPanel,
  crearSucursalAdmin,
  generarCodigoSucursalAdmin,
  resetearPasskeyEmpleado,
} from '../acciones';

export default function PanelDueno() {
  const [pin, setPin] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<{
    sucursales: any[];
    empleados: any[];
    fichajes: any[];
    codigos: any[];
  } | null>(null);

  const [nuevaSucursal, setNuevaSucursal] = useState('');
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<number>(0);
  const [codigoGenerado, setCodigoGenerado] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState<string>('TODAS');
  const [isPending, startTransition] = useTransition();

  const cargarPanel = (pinIngresado: string) => {
    startTransition(async () => {
      try {
        setError('');
        const res = await obtenerDatosPanel(pinIngresado);
        setDatos(res);
        setAutenticado(true);
        if (res.sucursales.length > 0 && !sucursalSeleccionada) {
          setSucursalSeleccionada(res.sucursales[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al ingresar');
      }
    });
  };

  const handleCrearSucursal = () => {
    if (!nuevaSucursal.trim()) return;
    startTransition(async () => {
      try {
        await crearSucursalAdmin(pin, nuevaSucursal);
        setNuevaSucursal('');
        cargarPanel(pin);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error creando sucursal');
      }
    });
  };

  const handleGenerarCodigo = () => {
    startTransition(async () => {
      try {
        setError('');
        const res = await generarCodigoSucursalAdmin(pin, sucursalSeleccionada, 30, 30);
        setCodigoGenerado(res.codigoPlano);
        cargarPanel(pin);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error generando código');
      }
    });
  };

  const handleResetPasskey = (empleadoId: string, nombre: string) => {
    if (!confirm(`¿Seguro que querés desvincular el celular de ${nombre}?`)) return;
    startTransition(async () => {
      try {
        await resetearPasskeyEmpleado(pin, empleadoId);
        cargarPanel(pin);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error reseteando Passkey');
      }
    });
  };

  if (!autenticado) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-gray-800">Panel del Dueño</h1>
            <p className="text-sm text-gray-500">Ingresá tu PIN de administrador (por defecto: 1234)</p>
          </div>

          <input
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargarPanel(pin)}
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-gray-800 focus:outline-none"
          />

          <button
            onClick={() => cargarPanel(pin)}
            disabled={isPending}
            className="w-full rounded-xl bg-gray-900 py-3.5 text-lg font-bold text-white hover:bg-black disabled:opacity-50"
          >
            {isPending ? 'Verificando...' : 'Ingresar al Panel'}
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

  const fichajesFiltrados = (datos?.fichajes ?? []).filter((f) => {
    if (filtroSucursal === 'TODAS') return true;
    return f.empleados?.sucursales?.nombre === filtroSucursal;
  });

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Cabecera */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control Centralizado de Asistencia</h1>
            <p className="text-sm text-gray-500">Vista en tiempo real de todas las sucursales</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => cargarPanel(pin)}
              disabled={isPending}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? 'Actualizando...' : '↻ Actualizar'}
            </button>
            <Link
              href="/"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Ir a Fichar
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-100 p-4 text-sm font-medium text-red-800">{error}</div>
        )}

        {/* Gestión rápida: Sucursales y Códigos de Alta */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Crear Sucursal */}
          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-800">1. Sucursales ({datos?.sucursales.length ?? 0})</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej: Sucursal Norte"
                value={nuevaSucursal}
                onChange={(e) => setNuevaSucursal(e.target.value)}
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleCrearSucursal}
                disabled={isPending}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                + Agregar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {datos?.sucursales.map((s) => (
                <span key={s.id} className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  #{s.id} {s.nombre}
                </span>
              ))}
            </div>
          </div>

          {/* Generar Código de Alta */}
          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-800">2. Generar Código de Alta (para /registro)</h2>
            <div className="flex gap-2">
              <select
                value={sucursalSeleccionada}
                onChange={(e) => setSucursalSeleccionada(Number(e.target.value))}
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                {datos?.sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <button
                onClick={handleGenerarCodigo}
                disabled={isPending}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Generar Código
              </button>
            </div>

            {codigoGenerado && (
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-center space-y-1">
                <p className="text-xs font-medium text-blue-800">
                  Copiá este código y dáselo a tus empleados (se muestra una sola vez):
                </p>
                <p className="font-mono text-xl font-bold tracking-widest text-blue-950 select-all">
                  {codigoGenerado}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de Fichajes en Vivo */}
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-800">Últimos Fichajes</h2>
            <select
              value={filtroSucursal}
              onChange={(e) => setFiltroSucursal(e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm bg-white"
            >
              <option value="TODAS">Todas las sucursales</option>
              {datos?.sucursales.map((s) => (
                <option key={s.id} value={s.nombre}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

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
                {fichajesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      Todavía no hay fichajes registrados.
                    </td>
                  </tr>
                ) : (
                  fichajesFiltrados.map((f) => {
                    const esEntrada = String(f.tipo).toLowerCase() === 'entrada';
                    const fecha = new Date(f.hora_registro).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="py-3 px-2 font-medium text-gray-900">
                          {f.empleados?.nombre || 'Desconocido'}
                        </td>
                        <td className="py-3 px-2 text-gray-600">
                          {f.empleados?.sucursales?.nombre || 'Sin sucursal'}
                        </td>
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

        {/* Lista de Empleados */}
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Empleados Registrados ({datos?.empleados.length ?? 0})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-3 px-2">Nombre</th>
                  <th className="py-3 px-2">Email</th>
                  <th className="py-3 px-2">Sucursal</th>
                  <th className="py-3 px-2">Celular</th>
                  <th className="py-3 px-2">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(datos?.empleados ?? []).map((emp) => {
                  const tienePasskey = (emp.credenciales_biometricas?.length ?? 0) > 0;
                  return (
                    <tr key={emp.id}>
                      <td className="py-3 px-2 font-medium text-gray-900">{emp.nombre}</td>
                      <td className="py-3 px-2 text-gray-500">{emp.email}</td>
                      <td className="py-3 px-2 text-gray-600">{emp.sucursales?.nombre || '-'}</td>
                      <td className="py-3 px-2">
                        {tienePasskey ? (
                          <span className="text-xs font-semibold text-green-700">✓ Vinculado</span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600">Pendiente</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {tienePasskey && (
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
    </main>
  );
}
