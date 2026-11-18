"use client";

import { useState } from 'react';
import Link from 'next/link';

interface PasoDemo {
  numero: number;
  rol: string;
  titulo: string;
  ruta: string;
  queHace: string;
  detalleTecnico: string;
  accionSimulada: string;
  resultadoSimulado: string;
  pantalla: 'panel-sedes' | 'kiosco' | 'alta' | 'terminal-qr' | 'reportes';
}

const PASOS_DEMO: PasoDemo[] = [
  {
    numero: 1,
    rol: 'Administrador / Dueño',
    titulo: 'Alta de Sucursal y Código de Vinculación',
    ruta: '/panel → Personal y Sucursales',
    queHace:
      'El administrador crea las sedes físicas de la empresa y emite un código alfanumérico de 16 caracteres (válido por 30 días o 30 altas) para habilitar a los empleados.',
    detalleTecnico:
      'El código se almacena encriptado con SHA-256 y controla el cupo de altas mediante una transacción atómica en base de datos.',
    accionSimulada: 'Emitir código de vinculación para "Sucursal Central"',
    resultadoSimulado: 'Código generado: 8f4a92c1e03b7d14 · Kiosco habilitado',
    pantalla: 'panel-sedes',
  },
  {
    numero: 2,
    rol: 'Punto de Control (Mostrador)',
    titulo: 'Pantalla Kiosco con QR Dinámico Efímero',
    ruta: '/kiosco',
    queHace:
      'Una tablet o monitor en el local muestra un código QR que cambia cada 60 segundos y se destruye automáticamente apenas un empleado lo escanea.',
    detalleTecnico:
      'Evita el fraude por fotos o capturas enviadas por WhatsApp: cada token QR es de un solo uso y certifica presencialidad física en esa sede.',
    accionSimulada: 'Simular rotación automática de QR efímero',
    resultadoSimulado: 'Token único activo (vigencia 60s) · Listo para lectura',
    pantalla: 'kiosco',
  },
  {
    numero: 3,
    rol: 'Empleado (Día 1 · Única vez)',
    titulo: 'Vinculación Biométrica del Teléfono',
    ruta: '/registro',
    queHace:
      'El colaborador ingresa su nombre, correo y el código de 16 caracteres, y registra su huella dactilar o Face ID. Este paso se hace una sola vez.',
    detalleTecnico:
      'Utiliza el estándar criptográfico FIDO2 / WebAuthn: la huella nunca sale del chip de seguridad del teléfono; al servidor solo viaja una clave pública.',
    accionSimulada: 'Simular enrolamiento de huella dactilar',
    resultadoSimulado: 'Dispositivo vinculado a Martín Gómez · Sin volver a pedir correo',
    pantalla: 'alta',
  },
  {
    numero: 4,
    rol: 'Empleado (Uso Diario)',
    titulo: 'Fichaje de Entrada o Salida por QR',
    ruta: '/',
    queHace:
      'El sistema sugiere automáticamente Entrada o Salida según la última marca del día, pero el empleado tiene control manual para elegir. Luego escanea el QR del kiosco y confirma con su huella.',
    detalleTecnico:
      'El empleado puede marcar en cualquier sucursal de la empresa; el sistema identifica la sede exacta donde se escaneó el QR en hora Argentina (ART).',
    accionSimulada: 'Simular escaneo de QR + confirmación biométrica',
    resultadoSimulado: 'Entrada registrada en Sucursal Central a las 08:59 hs (ART)',
    pantalla: 'terminal-qr',
  },
  {
    numero: 5,
    rol: 'RRHH / Supervisión',
    titulo: 'Cálculo de Horas, Auditoría y Exportación',
    ruta: '/panel → Informes y Horas',
    queHace:
      'Empareja automáticamente entradas y salidas por rango de fechas, detecta turnos abiertos, permite cargar correcciones manuales, crear operadores RRHH y exportar a Excel (CSV) o PDF.',
    detalleTecnico:
      'Permite delegar acceso con roles (Superadmin, Administrativo RRHH o Supervisor restringido a una sola sucursal).',
    accionSimulada: 'Simular exportación de planilla de liquidación',
    resultadoSimulado: 'Archivo informe_horas.csv generado con 176h 30m computadas',
    pantalla: 'reportes',
  },
];

export function AyudaYDemoButtons() {
  const [modalAbierto, setModalAbierto] = useState<'ayuda' | 'demo' | null>(null);
  const [pasoIndex, setPasoIndex] = useState(0);
  const [simulacionEjecutada, setSimulacionEjecutada] = useState(false);

  const pasoActual = PASOS_DEMO[pasoIndex];

  const abrirDemo = () => {
    setPasoIndex(0);
    setSimulacionEjecutada(false);
    setModalAbierto('demo');
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModalAbierto('ayuda')}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Ayuda
        </button>
        <button
          type="button"
          onClick={abrirDemo}
          className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
        >
          Demo
        </button>
      </div>

      {/* MODAL DE AYUDA OPERATIVA */}
      {modalAbierto === 'ayuda' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Guía Rápida de Uso · AccesoMóvil</h2>
                <p className="text-xs text-slate-500">Manual operativo según perfil de usuario</p>
              </div>
              <button
                onClick={() => setModalAbierto(null)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5 text-xs text-slate-600 leading-relaxed">
              {/* Bloque 1 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">1. Para el Empleado (Alta y Fichaje Diario)</h3>
                  <Link
                    href="/registro"
                    onClick={() => setModalAbierto(null)}
                    className="font-semibold text-slate-900 underline"
                  >
                    Ir a Alta Única →
                  </Link>
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Vinculación (una sola vez):</strong> Ingresá a <em>Alta Única</em>, completá tu nombre, correo y el código de 16 caracteres entregado por RRHH, y confirmá tu huella o Face ID.
                  </li>
                  <li>
                    <strong>Selección de movimiento:</strong> En la pantalla principal, verificá si vas a marcar <strong>Entrada</strong> o <strong>Salida</strong> (el sistema te sugiere el movimiento lógico según tu última marca del día, pero podés cambiarlo manualmente).
                  </li>
                  <li>
                    <strong>Escaneo presencial:</strong> Tocá <strong>Escanear QR</strong>, apuntá al monitor de la sucursal (podés marcar en cualquier sede habilitada) y validá con tu huella.
                  </li>
                </ul>
              </div>

              {/* Bloque 2 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">2. Modo Kiosco (Pantalla en Sucursal)</h3>
                  <Link
                    href="/kiosco"
                    onClick={() => setModalAbierto(null)}
                    className="font-semibold text-slate-900 underline"
                  >
                    Abrir Kiosco →
                  </Link>
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    Se abre en una tablet, monitor de caja o PC de recepción usando la <strong>Clave Kiosco</strong> de esa sucursal.
                  </li>
                  <li>
                    Muestra un <strong>QR dinámico de un solo uso</strong> que caduca cada 60 segundos o apenas un empleado lo escanea, evitando fotos o reenvíos a distancia.
                  </li>
                </ul>
              </div>

              {/* Bloque 3 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">3. Consola Administrativa (Dirección y RRHH)</h3>
                  <Link
                    href="/panel"
                    onClick={() => setModalAbierto(null)}
                    className="font-semibold text-slate-900 underline"
                  >
                    Ir a Administración →
                  </Link>
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Informes y Horas:</strong> Filtra por fechas y sucursal, calcula horas trabajadas automáticamente y permite exportar planillas en <strong>CSV (Excel)</strong> o <strong>PDF</strong>.
                  </li>
                  <li>
                    <strong>Registro de Marcas:</strong> Auditoría en vivo en horario Argentina (ART) con carga manual para corregir olvidos.
                  </li>
                  <li>
                    <strong>Personal y Sucursales:</strong> Alta de sedes, emisión de códigos de vinculación, edición de empleados y reseteo de huella si alguien cambia de celular.
                  </li>
                  <li>
                    <strong>Operadores Administrativos:</strong> Creación de usuarios con PIN propio para personal de RRHH o supervisores de sucursal.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <span className="text-[11px] text-slate-500">¿Querés ver cada paso en acción?</span>
              <button
                onClick={abrirDemo}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Iniciar Tour Demo Interactivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DEMO INTERACTIVA PASO A PASO */}
      {modalAbierto === 'demo' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header Demo */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold">
                    PASO {pasoActual.numero} DE {PASOS_DEMO.length}
                  </span>
                  <span className="text-xs text-slate-300">{pasoActual.rol}</span>
                </div>
                <h2 className="mt-1 text-base font-semibold">{pasoActual.titulo}</h2>
              </div>
              <button
                onClick={() => setModalAbierto(null)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Salir de Demo
              </button>
            </div>

            {/* Barra de progreso */}
            <div className="h-1.5 w-full bg-slate-100">
              <div
                className="h-full bg-slate-900 transition-all duration-300"
                style={{ width: `${((pasoIndex + 1) / PASOS_DEMO.length) * 100}%` }}
              />
            </div>

            {/* Cuerpo dividido: Explicación + Simulador Visual */}
            <div className="grid flex-1 overflow-y-auto md:grid-cols-2">
              {/* Columna Izquierda: Explicación detallada */}
              <div className="p-6 space-y-4 border-b md:border-b-0 md:border-r border-slate-200">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Módulo en la app
                  </span>
                  <p className="font-mono text-xs font-semibold text-slate-800 mt-0.5">{pasoActual.ruta}</p>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    ¿Qué hace esta opción?
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{pasoActual.queHace}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-800">Control y Seguridad</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{pasoActual.detalleTecnico}</p>
                </div>
              </div>

              {/* Columna Derecha: Vista previa interactiva simulada */}
              <div className="flex flex-col justify-between bg-slate-50 p-6 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-semibold text-slate-400">SIMULACIÓN EN VIVO</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>

                  {pasoActual.pantalla === 'panel-sedes' && (
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                        <span className="font-semibold text-slate-800">Sucursal Central</span>
                        <span className="font-mono text-slate-500">Kiosco: a91c4e02</span>
                      </div>
                      <div className="rounded-lg border border-dashed border-slate-300 p-2.5 text-center">
                        <p className="text-[11px] text-slate-500">Cupos disponibles: 30 altas · Validez: 30 días</p>
                      </div>
                    </div>
                  )}

                  {pasoActual.pantalla === 'kiosco' && (
                    <div className="flex flex-col items-center py-2 space-y-2">
                      <div className="grid grid-cols-5 gap-1 rounded-xl border-2 border-slate-900 p-3 bg-white">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-3 w-3 rounded-[2px] ${
                              (i + (simulacionEjecutada ? 3 : 0)) % 2 === 0 ? 'bg-slate-900' : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="font-mono text-[11px] text-slate-500">
                        {simulacionEjecutada ? 'Nuevo QR emitido · 60s' : 'QR Efímero · Expira al escanear'}
                      </p>
                    </div>
                  )}

                  {pasoActual.pantalla === 'alta' && (
                    <div className="space-y-2 text-xs">
                      <div className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700">
                        Martín Gómez · martin@empresa.com
                      </div>
                      <div className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-700">
                        Código: 8F4A92C1E03B7D14
                      </div>
                      <div className="rounded-lg bg-slate-100 px-3 py-2 text-center font-medium text-slate-700">
                        Sensor biométrico: {simulacionEjecutada ? 'Huella verificada ✓' : 'Esperando huella...'}
                      </div>
                    </div>
                  )}

                  {pasoActual.pantalla === 'terminal-qr' && (
                    <div className="space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 text-center font-semibold">
                        <span className="rounded-md bg-white py-1.5 text-slate-900 shadow-2xs">Entrada (Sugerido)</span>
                        <span className="py-1.5 text-slate-500">Salida</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-2.5 text-center text-slate-600">
                        Cámara enfocando QR de <strong>Sucursal Central</strong>
                      </div>
                    </div>
                  )}

                  {pasoActual.pantalla === 'reportes' && (
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                          <p className="text-[10px] text-slate-500">Horas Mes</p>
                          <p className="font-mono font-bold text-slate-900">176h 30m</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                          <p className="text-[10px] text-slate-500">En Turno</p>
                          <p className="font-bold text-emerald-700">12 / 12</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSimulacionEjecutada(true)}
                    className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    {simulacionEjecutada ? 'Volver a probar acción' : pasoActual.accionSimulada}
                  </button>

                  {simulacionEjecutada && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-900">
                      {pasoActual.resultadoSimulado}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Seleccioná cualquier paso:</span>
                  <div className="flex gap-1.5">
                    {PASOS_DEMO.map((p, idx) => (
                      <button
                        key={p.numero}
                        onClick={() => {
                          setPasoIndex(idx);
                          setSimulacionEjecutada(false);
                        }}
                        className={`h-6 w-6 rounded-md font-mono text-xs font-semibold ${
                          idx === pasoIndex
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p.numero}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Navegación Demo */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5">
              <button
                type="button"
                disabled={pasoIndex === 0}
                onClick={() => {
                  setPasoIndex((i) => Math.max(0, i - 1));
                  setSimulacionEjecutada(false);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                ← Anterior
              </button>

              {pasoIndex < PASOS_DEMO.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setPasoIndex((i) => Math.min(PASOS_DEMO.length - 1, i + 1));
                    setSimulacionEjecutada(false);
                  }}
                  className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Siguiente Paso →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalAbierto(null)}
                  className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Finalizar Demo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
