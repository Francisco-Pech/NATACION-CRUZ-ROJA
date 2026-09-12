import { prisma } from '@/lib/db'
import {
  calcularTotalConComision, comisionesDelEntorno, type MetodoConComision,
} from '@/lib/comisiones'
import { EstadoCargo, MetodoPago } from '@prisma/client'

export type ColorSemaforo = 'VERDE' | 'AMARILLO' | 'AZUL' | 'ROJO' | 'GRIS'

export function colorDeEstado(estado: EstadoCargo): ColorSemaforo {
  switch (estado) {
    case EstadoCargo.PAGADO: return 'VERDE'
    case EstadoCargo.PENDIENTE: return 'AMARILLO'
    case EstadoCargo.EN_REVISION: return 'AZUL'
    case EstadoCargo.VENCIDO: return 'ROJO'
    case EstadoCargo.CANCELADO: return 'GRIS'
  }
}

export const ETIQUETA_ESTADO: Record<EstadoCargo, string> = {
  PAGADO: 'Al corriente',
  PENDIENTE: 'Pendiente de pago',
  EN_REVISION: 'Comprobante en revisión',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
}

/** Devuelve todo lo que la página del alumno necesita, y nada más. */
export async function obtenerEstadoCuenta(token: string, mesActual?: number) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    include: {
      alumno: true,
      ciclo: true,
      descuento: true,
      sesiones: { include: { sesion: { include: { tipoCurso: true, horario: true } } } },
      cargos: {
        include: {
          periodo: true,
          pagos: { orderBy: { fechaPago: 'desc' } },
          solicitudFactura: true,
        },
        orderBy: { periodo: { mes: 'asc' } },
      },
      lockers: { include: { locker: true, periodo: true } },
    },
  })
  if (!inscripcion) return null

  const mes = mesActual ?? new Date().getMonth() + 1
  // Quien lleva dos cursos debe dos cargos este mes, cada uno con su cobro.
  const cargosDelMes = inscripcion.cargos.filter((c) => c.periodo.mes === mes)
  const cargoActual = cargosDelMes[0] ?? null

  const precios = cargoActual ? await calcularPrecios(cargoActual.montoNeto) : []

  return { inscripcion, cargoActual, cargosDelMes, historial: inscripcion.cargos, precios }
}

export type PrecioPorMetodo = {
  metodo: MetodoPago
  etiqueta: string
  total: number
  comision: number
}

const ETIQUETA_METODO: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo en recepción',
  TRANSFERENCIA: 'Transferencia directa',
  TARJETA: 'Tarjeta en línea',
  SPEI: 'Transferencia en línea (SPEI)',
  OXXO: 'Pago en OXXO',
}

/**
 * El precio se presenta por método, no como "770 + comisión": las reglas
 * de las marcas de tarjetas en México restringen el recargo explícito.
 */
export async function calcularPrecios(neto: number): Promise<PrecioPorMetodo[]> {
  const porMetodo = comisionesDelEntorno()
  const configuraciones = (Object.keys(porMetodo) as MetodoConComision[])
    .map((metodo) => ({ metodo, ...porMetodo[metodo] }))
    .filter((c) => c.activo)

  return (Object.keys(ETIQUETA_METODO) as MetodoPago[]).map((metodo) => {
    const config = configuraciones.find((c) => c.metodo === metodo)
    if (!config) {
      return { metodo, etiqueta: ETIQUETA_METODO[metodo], total: neto, comision: 0 }
    }
    const { total, comision } = calcularTotalConComision(neto, config)
    return { metodo, etiqueta: ETIQUETA_METODO[metodo], total, comision }
  })
}

/**
 * Lo único que un profesor necesita saber en la puerta. Devuelve
 * exactamente estos campos: nunca importes, teléfonos ni domicilios.
 */
export async function verificarAcceso(token: string, mesActual?: number) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    select: {
      folio: true,
      alumno: { select: { nombreCompleto: true, fotoUrl: true } },
      cargos: { select: { estado: true, periodo: { select: { mes: true, clave: true } } } },
    },
  })
  if (!inscripcion) return null

  const mes = mesActual ?? new Date().getMonth() + 1
  const cargo = inscripcion.cargos.find((c) => c.periodo.mes === mes)

  return {
    nombre: inscripcion.alumno.nombreCompleto,
    folio: inscripcion.folio,
    fotoUrl: inscripcion.alumno.fotoUrl,
    alCorriente: cargo?.estado === EstadoCargo.PAGADO,
    mes: cargo?.periodo.clave ?? '',
  }
}

/** Respaldo del escáner: cuando el QR está borrado, se busca por folio. */
export async function tokenDeFolio(folio: string): Promise<string | null> {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { folio: folio.toUpperCase() },
    select: { tokenQR: true },
  })
  return inscripcion?.tokenQR ?? null
}
