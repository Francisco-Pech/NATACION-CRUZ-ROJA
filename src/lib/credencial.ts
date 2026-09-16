import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { prisma } from '@/lib/db'
import { resumenDias } from '@/lib/dias-semana'
import { periodoActual } from '@/lib/periodo-actual'

/**
 * De dónde cuelga el enlace que se le comparte al alumno.
 *
 * Sale de la petición y no de una constante: en local es `localhost:3000` y
 * en la delegación será su dominio, sin que nadie tenga que acordarse de
 * cambiarlo antes de desplegar.
 */
export async function baseDelSitio(): Promise<string> {
  const cabeceras = await headers()
  const host = cabeceras.get('host') ?? 'localhost:3000'
  const protocolo = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  return `${protocolo}://${host}`
}

const CON_LO_QUE_HACE_FALTA = {
  alumno: true,
  ciclo: true,
  sesiones: { include: { sesion: { include: { tipoCurso: true } } } },
} as const

/**
 * Todo lo que se pinta en una credencial, buscando por lo que se tenga a
 * la mano: el id cuando se llega desde el panel, el token cuando se llega
 * por el enlace compartido.
 *
 * El QR apunta al estado de cuenta y lleva el token, nunca el folio: el
 * folio va impreso en este mismo papel y se dicta en voz alta.
 */
export async function armarCredencial(
  buscarPor: { id: string } | { tokenQR: string },
) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: buscarPor,
    include: CON_LO_QUE_HACE_FALTA,
  })
  if (!inscripcion) return null

  const base = await baseDelSitio()
  const enlace = `${base}/q/${inscripcion.tokenQR}`

  // El locker es del mes, no del ciclo: se pide el de hoy. Sin periodo
  // abierto no hay locker que enseñar, y no es un error — pasa entre un
  // ciclo y el siguiente.
  const actual = await periodoActual()
  const asignado = actual
    ? await prisma.asignacionLocker.findFirst({
        where: { inscripcionId: inscripcion.id, periodoId: actual.periodo.id },
        include: { locker: true },
      })
    : null

  return {
    id: inscripcion.id,
    nombre: inscripcion.alumno.nombreCompleto,
    folio: inscripcion.folio,
    anio: inscripcion.ciclo.anio,
    /** Solo el sí o el no. El RFC y su constancia no salen de aquí: esta
     *  credencial se abre con un enlace, sin contraseña. */
    factura: inscripcion.alumno.factura,
    cursos: [
      ...new Map(
        inscripcion.sesiones.map((s) => [s.sesion.tipoCursoId, s.sesion.tipoCurso.nombre]),
      ).values(),
    ],
    dias: resumenDias(inscripcion.sesiones.map((s) => s.sesion.diaSemana)),
    /** El número de su locker este mes, si trae uno. */
    locker: asignado?.locker.numero ?? null,
    enlace,
    /** El enlace de esta misma hoja, para compartirla o volver a imprimirla. */
    enlaceCredencial: `${base}/q/${inscripcion.tokenQR}/credencial`,
    qr: await QRCode.toDataURL(enlace, { width: 420, margin: 1 }),
  }
}
