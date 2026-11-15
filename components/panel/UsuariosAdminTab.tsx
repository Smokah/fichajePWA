"use client";

import { useState, useTransition } from 'react';
import {
  crearUsuarioAdmin,
  actualizarUsuarioAdmin,
  eliminarUsuarioAdmin,
} from '@/app/actions/admin';

interface UsuariosAdminTabProps {
  credenciales: { identificador: string; pin: string };
  usuariosAdmin: any[];
  sucursales: any[];
  onRefresh: () => void;
}

export function UsuariosAdminTab({
  credenciales,
  usuariosAdmin,
  sucursales,
  onRefresh,
}: UsuariosAdminTabProps) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [rol, setRol] = useState('administrativo');
  const [sucursalId, setSucursalId] = useState('TODAS');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [isPending, startTransition] = useTransition();

  const limpiarFormulario = () => {
    setNombre('');
    setEmail('');
    setPinNuevo('');
    setRol('administrativo');
    setSucursalId('TODAS');
    setEditandoId(null);
  };

  const handleGuardar = () => {
    startTransition(async () => {
      try {
        setMensaje('');
        if (editandoId) {
          await actualizarUsuarioAdmin(credenciales, editandoId, {
            nombre,
            rol,
            sucursalId,
            activo: true,
            pinNuevo: pinNuevo || undefined,
          });
          setMensaje('Usuario administrativo actualizado.');
        } else {
          await crearUsuarioAdmin(credenciales, {
            nombre,
            email,
            pinNuevo,
            rol,
            sucursalId,
          });
          setMensaje('Usuario administrativo creado correctamente.');
        }
        limpiarFormulario();
        onRefresh();
      } catch (e) {
        setMensaje(e instanceof Error ? e.message : 'Error guardando usuario.');
      }
    });
  };

  const iniciarEdicion = (u: any) => {
    setEditandoId(u.id);
    setNombre(u.nombre);
    setEmail(u.email);
    setPinNuevo('');
    setRol(u.rol);
    setSucursalId(u.sucursal_id ? String(u.sucursal_id) : 'TODAS');
    setMensaje('');
  };

  const handleToggleActivo = (u: any) => {
    startTransition(async () => {
      try {
        await actualizarUsuarioAdmin(credenciales, u.id, {
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
    if (!confirm(`¿Eliminar definitivamente al usuario administrativo ${u.nombre}?`)) return;
    startTransition(async () => {
      try {
        await eliminarUsuarioAdmin(credenciales, u.id);
        onRefresh();
      } catch (e) {
        setMensaje(e instanceof Error ? e.message : 'Error eliminando usuario.');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Formulario Crear / Editar */}
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {editandoId ? 'Editar Usuario Administrativo' : 'Crear Usuario Administrativo'}
            </h2>
            <p className="text-xs text-gray-500">
              Permite que encargados de RRHH o supervisores accedan al panel para consultar reportes y horas.
            </p>
          </div>
          {editandoId && (
            <button onClick={limpiarFormulario} className="text-xs text-gray-500 underline">
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <input
            type="text"
            placeholder="Nombre y Apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
          />
          <input
            type="email"
            placeholder="Correo de acceso"
            value={email}
            disabled={!!editandoId}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm disabled:bg-gray-100"
          />
          <input
            type="password"
            inputMode="numeric"
            placeholder={editandoId ? 'Nuevo PIN (opcional)' : 'PIN (4-8 dígitos)'}
            value={pinNuevo}
            onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white"
          >
            <option value="administrativo">Administrativo (RRHH)</option>
            <option value="supervisor">Supervisor de Sucursal</option>
            <option value="superadmin">Superadmin (Total)</option>
          </select>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white"
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
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : editandoId ? 'Actualizar Usuario' : '+ Crear Usuario Administrativo'}
          </button>
          {mensaje && <p className="text-sm font-medium text-blue-700">{mensaje}</p>}
        </div>
      </div>

      {/* Tabla CRUD */}
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-gray-800">Usuarios con Acceso al Panel ({usuariosAdmin.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="py-3 px-2">Nombre</th>
                <th className="py-3 px-2">Correo</th>
                <th className="py-3 px-2">Rol</th>
                <th className="py-3 px-2">Alcance</th>
                <th className="py-3 px-2">Estado</th>
                <th className="py-3 px-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuariosAdmin.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    No hay usuarios administrativos secundarios creados todavía.
                  </td>
                </tr>
              ) : (
                usuariosAdmin.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{u.nombre}</td>
                    <td className="py-3 px-2 text-gray-600">{u.email}</td>
                    <td className="py-3 px-2 uppercase text-xs font-bold text-indigo-700">{u.rol}</td>
                    <td className="py-3 px-2 text-gray-600">{u.sucursales?.nombre || 'Todas'}</td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => handleToggleActivo(u)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          u.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.activo ? 'Activo' : 'Suspendido'}
                      </button>
                    </td>
                    <td className="py-3 px-2 text-right space-x-3">
                      <button onClick={() => iniciarEdicion(u)} className="text-xs text-blue-600 underline">
                        Editar
                      </button>
                      <button onClick={() => handleEliminar(u)} className="text-xs text-red-600 underline">
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
