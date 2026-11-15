export interface FichajeRaw {
  id: number;
  tipo: string;
  hora_registro: string;
  empleado_id: string;
  empleados?: {
    nombre: string;
    email: string;
    sucursal_id: number | null;
    sucursales?: { nombre: string } | null;
  } | null;
}

export interface ResumenEmpleado {
  empleadoId: string;
  nombre: string;
  email: string;
  sucursal: string;
  totalMinutos: number;
  horasFormateadas: string;
  cantidadEntradas: number;
  cantidadSalidas: number;
  estadoActual: 'En turno' | 'Fuera de turno' | 'Incompleto';
  ultimoMovimiento: string;
}

export function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function calcularEstadisticasEmpleados(fichajes: FichajeRaw[]): ResumenEmpleado[] {
  // Ordenar cronológicamente ascendente para emparejar Entrada -> Salida
  const ordenados = [...fichajes].sort(
    (a, b) => new Date(a.hora_registro).getTime() - new Date(b.hora_registro).getTime()
  );

  const porEmpleado = new Map<string, {
    nombre: string;
    email: string;
    sucursal: string;
    entradaPendiente: Date | null;
    totalMinutos: number;
    entradas: number;
    salidas: number;
    ultimoMovimiento: string;
  }>();

  for (const f of ordenados) {
    const empId = f.empleado_id;
    if (!empId) continue;

    if (!porEmpleado.has(empId)) {
      porEmpleado.set(empId, {
        nombre: f.empleados?.nombre || 'Desconocido',
        email: f.empleados?.email || '',
        sucursal: f.empleados?.sucursales?.nombre || 'Sin sucursal',
        entradaPendiente: null,
        totalMinutos: 0,
        entradas: 0,
        salidas: 0,
        ultimoMovimiento: f.hora_registro,
      });
    }

    const acc = porEmpleado.get(empId)!;
    const tipo = String(f.tipo).toLowerCase();
    const fecha = new Date(f.hora_registro);
    acc.ultimoMovimiento = f.hora_registro;

    if (tipo === 'entrada') {
      acc.entradas += 1;
      acc.entradaPendiente = fecha;
    } else if (tipo === 'salida') {
      acc.salidas += 1;
      if (acc.entradaPendiente) {
        const diffMin = Math.max(0, (fecha.getTime() - acc.entradaPendiente.getTime()) / 60000);
        // Tope de seguridad de 18h por turno continuo para evitar olvidos de salida
        if (diffMin <= 18 * 60) {
          acc.totalMinutos += diffMin;
        }
        acc.entradaPendiente = null;
      }
    }
  }

  const resultado: ResumenEmpleado[] = [];
  for (const [empleadoId, data] of porEmpleado.entries()) {
    let estadoActual: ResumenEmpleado['estadoActual'] = 'Fuera de turno';
    if (data.entradaPendiente) {
      const horasAbierto = (Date.now() - data.entradaPendiente.getTime()) / 3600000;
      estadoActual = horasAbierto > 16 ? 'Incompleto' : 'En turno';
    }

    resultado.push({
      empleadoId,
      nombre: data.nombre,
      email: data.email,
      sucursal: data.sucursal,
      totalMinutos: Math.round(data.totalMinutos),
      horasFormateadas: formatearDuracion(data.totalMinutos),
      cantidadEntradas: data.entradas,
      cantidadSalidas: data.salidas,
      estadoActual,
      ultimoMovimiento: data.ultimoMovimiento,
    });
  }

  return resultado.sort((a, b) => b.totalMinutos - a.totalMinutos);
}
