import { ZONA } from '@/lib/zona'

/**
 * Un pago con lo que cobra su mes.
 *
 * El desglose viaja con el pago y no se recalcula: el cargo guardó sus
 * montos al nacer, así que un cambio de precio o de descuento posterior no
 * debe mover lo que ya se cobró.
 */
export type PagoParaFacturar = {
  id: string
  mes: number
  etiquetaMetodo: string
  montoCobrado: number
  referencia: string | null
  fechaPago: Date
  montoMensualidad: number
  montoLockers: number
  montoDescuento: number
  montoRecargo: number
}

export type Cobro = {
  /** Cuándo se recibió el dinero. */
  fechaPago: Date
  etiquetaMetodo: string
  referencia: string | null
  /** Qué meses quedaron cubiertos con ese dinero, en orden. */
  meses: number[]
  total: number
  /** Los conceptos, para que el CFDI no los tenga que desglosar a mano. */
  mensualidad: number
  lockers: number
  descuento: number
  recargo: number
}

/** El día en Cancún. En UTC, un cobro de las 9 de la noche cae al día siguiente. */
const DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Junta los pagos en los cobros que de verdad ocurrieron.
 *
 * La mensualidad es mensual, pero el dinero no siempre: quien deja pagados
 * tres meses de una vez entregó el dinero una sola vez, y el sistema lo
 * escribió como tres pagos porque cada mes tiene su cargo. Timbrarlos por
 * separado contaría tres movimientos donde hubo uno.
 *
 * Se agrupa por día, forma de pago y referencia. La forma de pago no se
 * puede juntar —el CFDI pide la real, y mezclar dos obligaría a mentir en
 * una—, y la referencia distingue dos tickets del mismo día.
 *
 * Sale del cobro más nuevo al más viejo: quien va a facturar busca el de
 * hoy, no el de marzo.
 */
export function agruparCobros(pagos: PagoParaFacturar[]): Cobro[] {
  const porCobro = new Map<string, Cobro & { meses: number[] }>()

  for (const p of pagos) {
    const clave = `${DIA.format(p.fechaPago)}|${p.etiquetaMetodo}|${p.referencia ?? ''}`
    const cobro = porCobro.get(clave)

    if (!cobro) {
      porCobro.set(clave, {
        fechaPago: p.fechaPago,
        etiquetaMetodo: p.etiquetaMetodo,
        referencia: p.referencia,
        meses: [p.mes],
        total: p.montoCobrado,
        mensualidad: p.montoMensualidad,
        lockers: p.montoLockers,
        descuento: p.montoDescuento,
        recargo: p.montoRecargo,
      })
      continue
    }

    // Quien lleva dos cursos paga dos cargos del mismo mes: el cobro cubre
    // ese mes una vez, aunque el dinero sume por los dos.
    if (!cobro.meses.includes(p.mes)) cobro.meses.push(p.mes)
    cobro.total += p.montoCobrado
    cobro.mensualidad += p.montoMensualidad
    cobro.lockers += p.montoLockers
    cobro.descuento += p.montoDescuento
    cobro.recargo += p.montoRecargo
    // La hora del cobro es la del primer pago que lo abrió; queda la más
    // temprana del grupo, que es cuando la persona llegó al mostrador.
    if (p.fechaPago < cobro.fechaPago) cobro.fechaPago = p.fechaPago
  }

  return [...porCobro.values()]
    .map((c) => ({ ...c, meses: [...c.meses].sort((a, b) => a - b) }))
    .sort((a, b) => b.fechaPago.getTime() - a.fechaPago.getTime())
}
