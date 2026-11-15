"use client";

import { useState, useTransition } from 'react';
import {
  crearSucursalAdmin,
  generarCodigoSucursalAdmin,
  resetearPasskeyEmpleado,
  editarEmpleadoAdmin,
  eliminarEmpleadoAdmin,
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

  // Estado para edición de empleado
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSucursalId, setEditSucursalId] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');

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

  const abrirEdicion = (emp: any) => {
    setEditId(emp.id);
    setEditNombre(emp.nombre);
    setEditEmail(emp.email || '');
    setEditSucursalId(emp.sucursal_id ? String(emp.sucursal_id) : '');
  };

  const guardarEdicion = () => {
    if (!editId) return;
    startTransition(async () => {
      try {
        await editarEmpleadoAdmin(credenciales, editId, {
          nombre: editNombre,
          email: editEmail,
          sucursalId: editSucursalId ? Number(editSucursalId) : null,
        });
        setEditId(null);
        onRefresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error actualizando empleado');
      }
    });
  };

  const handleEliminarEmpleado = (emp: any) => {
    if (!confirm(`¿Eliminar al empleado ${emp.nombre} y todo su historial de marcas?`)) return;
    startTransition(async () => {
      try {
        await eliminarEmpleadoAdmin(credenciales, emp.id);
        onRefresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error eliminando empleado');
      }
    });
  };

  const handleResetPasskey = (empleadoId: string, nombre: string) => {
    if (!confirm(`¿Desvincular el dispositivo móvil de ${nombre}?`)) return;
    startTransition(async () => {
      try {
        await resetearPasskeyEmpleado(credenciales, empleadoId);
        onRefresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error desvinculando dispositivo');
      }
    });
  };

  const empleadosFiltrados = empleados.filter((e) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      String(e.nombre).toLowerCase().includes(q) ||
      String(e.email).toLowerCase().includes(q) ||
      String(e.sucursales?.nombre || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Sucursales y Códigos */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Sucursales Operativas</h2>
            <p className="text-xs text-slate-500">Sedes habilitadas para el registro de personal</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre de nueva sede..."
              value={nuevaSucursal}
              onChange={(e) => setNuevaSucursal(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
            <button
              onClick={handleCrearSucursal}
              disabled={isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {sucursales.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {s.nombre}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Código de Vinculación por Sede</h2>
            <p className="text-xs text-slate-500">Clave temporal (30 días / 30 altas) para que el empleado enrolle su celular</p>
          </div>
          <div className="flex gap-2">
            <select
              value={sucursalCodigo}
              onChange={(e) => setSucursalCodigo(Number(e.target.value))}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-slate-900 focus:outline-none"
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
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Emitir Código
            </button>
          </div>
          {codigoGenerado && (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Código generado (copiar y enviar):</p>
                <p className="font-mono text-base font-semibold tracking-wider text-slate-900 select-all">
                  {codigoGenerado}
                </p>
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(codigoGenerado)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Copiar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nómina de Empleados con Edición Inline */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Nómina de Personal ({empleados.length})</h2>
            <p className="text-xs text-slate-500">Edición de datos, reasignación de sucursal y gestión biométrica</p>
          </div>
          <input
            type="search"
            placeholder="Buscar por nombre, correo o sede..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Colaborador</th>
                <th className="py-3 px-3">Correo Electrónico</th>
                <th className="py-3 px-3">Sucursal</th>
                <th className="py-3 px-3">Biometría</th>
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empleadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No se encontraron colaboradores.
                  </td>
                </tr>
              ) : (
                empleadosFiltrados.map((emp) => {
                  const vinculado = (emp.credenciales_biometricas?.length ?? 0) > 0;
                  const enEdicion = editId === emp.id;

                  if (enEdicion) {
                    return (
                      <tr key={emp.id} className="bg-slate-50">
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={editSucursalId}
                            onChange={(e) => setEditSucursalId(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          >
                            <option value="">Sin asignar</option>
                            {sucursales.map((s) => (
                              <option key={s.id} value={String(s.id)}>
                                {s.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-400">Editando...</td>
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <button
                            onClick={guardarEdicion}
                            disabled={isPending}
                            className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                          >
                            Cancelar
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-900">{emp.nombre}</td>
                      <td className="py-3 px-3 text-slate-600">{emp.email}</td>
                      <td className="py-3 px-3 text-slate-600">{emp.sucursales?.nombre || 'Sin asignar'}</td>
                      <td className="py-3 px-3">
                        {vinculado ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                            Vinculado
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right space-x-3 text-xs font-medium">
                        <button
                          onClick={() => abrirEdicion(emp)}
                          className="text-slate-700 hover:text-slate-950 underline"
                        >
                          Editar
                        </button>
                        {vinculado && (
                          <button
                            onClick={() => handleResetPasskey(emp.id, emp.nombre)}
                            className="text-amber-700 hover:text-amber-900 underline"
                          >
                            Resetear huella
                          </button>
                        )}
                        <button
                          onClick={() => handleEliminarEmpleado(emp)}
                          className="text-rose-700 hover:text-rose-900 underline"
                        >
                          Eliminar
                        </button>
                      </td>
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
