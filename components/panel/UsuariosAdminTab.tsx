"use client";

import { useState, useTransition } from 'react';
import {
  crearUsuarioAdmin,
  actualizarUsuarioAdmin,
  eliminarUsuarioAdmin,
} from '@/app/actions/admin';

interface UsuariosAdminTabProps {
  usuariosAdmin: any[];
  sucursales: any[];
  onRefresh: () => void;
}

export function UsuariosAdminTab({
  usuariosAdmin,
  sucursales,
  onRefresh,
}: UsuariosAdminTabProps) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('administrativo');
  const [sucursalId, setSucursalId] = useState('TODAS');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [isPending, startTransition] = useTransition();

  const limpiarFormulario = () => {
    setNombre('');
    setEmail('');
    setRol('administrativo');
    setSucursalId('TODAS');
    setEditandoId(null);
  };

  const handleGuardar = () => {
    startTransition(async () => {
      try {
        setMensaje('');
        if (editandoId) {
          await actualizarUsuarioAdmin(editandoId, {
            nombre,
            rol,
            sucursalId,
            activo: true,
          });
          setMensaje('Permisos actualizados correctamente.');
        } else {
          await crearUsuarioAdmin({
            nombre,
            email,
            rol,
            sucursalId,
          });
          setMensaje('Operador administrativo creado.');
        }
        limpiarFormulario();
        onRefresh();
      } catch (e) {
        setMensaje(e instanceof Error ? e.message : 'Error guardando operador.');
      }
    });
  };

  const iniciarEdicion = (u: any) => {
    setEditandoId(u.id);
    setNombre(u.nombre);
    setEmail(u.email);
    setRol(u.rol);
    setSucursalId(u.sucursal_id ? String(u.sucursal_id) : 'TODAS');
    setMensaje('');
  };

  const handleToggleActivo = (u: any) => {
    startTransition(async () => {
      try {
        await actualizarUsuarioAdmin(u.id, {
          nombre: u.nombre,
          rol: u.rol,
          sucursalId: u.sucursal_id ? String(u.sucursal_id) : 'TODAS',
          activo: !u.activo,
        });
        onRefresh();
      } catch (e) {
        setMensaje(e instanceof Error ? e.message : 'Error cambiando estado.');
      }
    });
  };

  const handleEliminar = (u: any) => {
    if (!confirm(`¿Revocar y eliminar permanentemente el acceso de ${u.nombre}?`)) return;
    startTransition(async () => {
      try {
        await eliminarUsuarioAdmin(u.id);
        onRefresh();
      } catch (e) {
        setMensaje(e instanceof Error ? e.message : 'Error eliminando operador.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editandoId ? 'Modificar Operador' : 'Alta de Operador Administrativo'}
            </h2>
            <p className="text-xs text-slate-500">
              Se enviará una invitación segura al correo para activar el acceso
            </p>
          </div>
          {editandoId && (
            <button onClick={limpiarFormulario} className="text-xs text-slate-500 underline">
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <input
            type="text"
            placeholder="Nombre y apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
          />
          <input
            type="email"
            placeholder="Correo corporativo"
            value={email}
            disabled={!!editandoId}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:bg-slate-100 focus:border-slate-900 focus:outline-none"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white focus:border-slate-900 focus:outline-none"
          >
            <option value="administrativo">Administrativo (RRHH)</option>
            <option value="supervisor">Supervisor de Sede</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white focus:border-slate-900 focus:outline-none"
          >
            <option value="TODAS">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                Solo: {s.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleGuardar}
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : editandoId ? 'Guardar Cambios' : 'Crear Operador'}
          </button>
          {mensaje && <p className="text-xs font-medium text-slate-700">{mensaje}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Operadores Habilitados ({usuariosAdmin.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Operador</th>
                <th className="py-3 px-3">Correo</th>
                <th className="py-3 px-3">Perfil</th>
                <th className="py-3 px-3">Jurisdicción</th>
                <th className="py-3 px-3">Estado</th>
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuariosAdmin.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No hay operadores secundarios configurados.
                  </td>
                </tr>
              ) : (
                usuariosAdmin.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-medium text-slate-900">{u.nombre}</td>
                    <td className="py-3 px-3 text-slate-600">{u.email}</td>
                    <td className="py-3 px-3 capitalize text-xs font-medium text-slate-700">{u.rol}</td>
                    <td className="py-3 px-3 text-slate-600">{u.sucursales?.nombre || 'Global'}</td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleToggleActivo(u)}
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          u.activo
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20'
                            : 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-600/20'
                        }`}
                      >
                        {u.activo ? 'Activo' : 'Suspendido'}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right space-x-3 text-xs font-medium">
                      <button onClick={() => iniciarEdicion(u)} className="text-slate-700 underline hover:text-slate-950">
                        Editar
                      </button>
                      <button onClick={() => handleEliminar(u)} className="text-rose-700 underline hover:text-rose-900">
                        Eliminar
                      </button>
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
