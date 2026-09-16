'use server'

import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { REGIMENES_FISCALES, USO_CFDI } from '@/lib/facturacion'
import { ETIQUETA_METODO } from '@/lib/metodos-pago'
import { agruparCobros } from '@/lib/cobros-para-facturar'
import { EstadoPago } from '@prisma/client'

/** Cómo se lee una clave de régimen. La clave sola no le dice nada a nadie. */
const nombreRegimen = (clave: string | null) =>
  REGIMENES_FISCALES.find((r) => r.clave === clave)?.nombre ?? null

/**
 * Todo lo que hace falta para facturarle a un alumno.
 *
 * Es informativo: esta pantalla no expide nada ni sabe si la factura se
 * mandó. Junta en un solo lugar lo que hoy está repartido —los datos
 * fiscales viven en el alumno, la forma de pago en cada pago— porque quien
 * va a facturar necesita las dos cosas a la vez y el CFDI pide la forma de
 * pago real: no es lo mismo timbrar un efectivo que una transferencia.
 *
 * Solo los pagos confirmados. Uno en revisión todavía puede rechazarse, y
 * facturar sobre dinero que no entró obliga a cancelar el CFDI después.
 */
export async function obtenerFactura(inscripcionId: string) {
  await requierePermiso('ALUMNOS')

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    include: {
      alumno: true,
      ciclo: true,
      cargos: {
        include: {
          periodo: true,
          tipoCurso: true,
          pagos: { where: { estado: EstadoPago.CONFIRMADO }, orderBy: { fechaPago: 'asc' } },
        },
        orderBy: { periodo: { mes: 'asc' } },
      },
    },
  })
  if (!inscripcion) return null

  const a = inscripcion.alumno

  return {
    alumno: a.nombreCompleto,
    folio: inscripcion.folio,
    anio: inscripcion.ciclo.anio,

    /** Lo contestó él en su página, o se capturó al darlo de alta. */
    requiere: a.factura,

    datos: {
      rfc: a.rfc,
      razonSocial: a.razonSocial,
      codigoPostal: a.codigoPostal,
      regimenClave: a.regimenFiscal,
      regimenNombre: nombreRegimen(a.regimenFiscal),
      // Siempre Donativos: la delegación es donataria autorizada.
      usoCfdi: `${USO_CFDI.clave} · ${USO_CFDI.nombre}`,
      correo: a.email,
    },

    /** La constancia solo se anuncia; el archivo sale por su propia ruta. */
    constancia: a.constanciaPdf
      ? { nombre: a.constanciaNombre, subidaEn: a.constanciaSubidaEn?.toISOString() ?? null }
      : null,

    /**
     * El dinero como de verdad entró, no mes por mes.
     *
     * La mensualidad es mensual, pero el cobro no siempre: quien deja
     * pagados tres meses de una vez entregó el dinero una sola vez. El CFDI
     * se timbra sobre ese movimiento —su forma de pago, su total y los meses
     * que cubre—, no sobre tres renglones inventados.
     */
    cobros: agruparCobros(
      inscripcion.cargos.flatMap((c) =>
        c.pagos.map((p) => ({
          id: p.id,
          mes: c.periodo.mes,
          etiquetaMetodo: ETIQUETA_METODO[p.metodo] ?? p.metodo,
          montoCobrado: p.montoCobrado,
          referencia: p.referencia,
          fechaPago: p.fechaPago,
          montoMensualidad: c.montoMensualidad,
          montoLockers: c.montoLockers,
          montoDescuento: c.montoDescuento,
          montoRecargo: c.montoRecargo,
        })),
      ),
    ).map((c) => ({ ...c, fechaPago: c.fechaPago.toISOString() })),

    /** Lo que todavía no se cobra: no se puede timbrar lo que no entró. */
    sinCobrar: inscripcion.cargos
      .filter((c) => c.pagos.length === 0 && c.estado !== 'CANCELADO')
      .map((c) => ({ mes: c.periodo.mes, curso: c.tipoCurso.nombre, montoNeto: c.montoNeto })),
  }
}
