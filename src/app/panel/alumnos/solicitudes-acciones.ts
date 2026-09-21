'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { inscribirAlumno } from '@/lib/servicios/inscripciones'
import { periodoActual } from '@/lib/periodo-actual'
import { hoyEnCancun } from '@/lib/zona'
import { enviarCorreo } from '@/lib/correo'
import { baseDelSitio } from '@/lib/credencial'
import QRCode from 'qrcode'
import type { Resultado } from '../admin/catalogo/tipos'

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()
const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

/** La solicitud que se va a atender, si existe y nadie la atendió ya. */
async function sinAtender(hash: string) {
  if (!hash) return null
  return prisma.solicitudDeRegistro.findFirst({
    where: { hash, atendidaEn: null },
    include: { tipoCurso: true, horario: true, locker: true },
  })
}

/**
 * Le avisa a quien se registró que ya quedó, con lo único que necesita.
 *
 * Nombre del alumno, su folio y su código: con eso paga en línea y con eso
 * lo reconocen en la alberca. El código va como imagen adjunta y no
 * incrustado, porque los correos bloquean las imágenes de fuera y el suyo
 * no puede depender de eso.
 *
 * Que el correo falle no deshace el alta: el alumno ya existe, y quien lo
 * dio de alta puede dictarle el folio. Por eso se devuelve si salió, para
 * poder decirlo en la pantalla.
 */
async function avisarQueQuedo(datos: {
  correo: string
  nombreCompleto: string
  folio: string
  tokenQR: string
}): Promise<boolean> {
  const enlace = `${await baseDelSitio()}/q/${datos.tokenQR}`
  const png = await QRCode.toDataURL(enlace, { width: 420, margin: 1 })

  return enviarCorreo({
    para: datos.correo,
    asunto: `Tu lugar en la escuela de natación · ${datos.folio}`,
    texto:
      `Aceptamos la solicitud de ${datos.nombreCompleto}.\n\n` +
      `Folio: ${datos.folio}\n\n` +
      'Con ese folio se paga la mensualidad en línea. El código que va adjunto es el' +
      ' del alumno: sirve para entrar a su cuenta y es el mismo de su credencial.\n\n' +
      `Su cuenta: ${enlace}\n\n` +
      'Cruz Roja Mexicana, Delegación Cancún.',
    adjuntos: [
      { nombre: `codigo-${datos.folio}.png`, base64: png.split(',')[1] ?? '' },
    ],
  })
}

/**
 * Convierte una solicitud en alumno.
 *
 * Es el único camino por el que alguien que se registró solo entra al
 * sistema: hasta aquí no había folio, ni meses, ni nada que cobrar. Quien
 * aprieta este botón está diciendo "esta persona existe y vino".
 *
 * Se le apunta a todos los días en que su curso corre a esa hora, que es
 * como se inscribe desde la ventanilla: no se escoge día por día.
 *
 * El locker que pidió puede haberse ocupado mientras tanto —su solicitud no
 * lo aparta— y en ese caso se le da de alta sin locker y se avisa. Es
 * preferible a no poder inscribirlo por una llave.
 */
export async function darDeAltaSolicitud(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requierePermiso('ALUMNOS')

    const solicitud = await sinAtender(texto(datos, 'hash'))
    if (!solicitud) return no('Esa solicitud ya no está pendiente. Recarga la página.')

    const anio = Number(hoyEnCancun().slice(0, 4))
    const ciclo = await prisma.cicloAnual.findUnique({ where: { anio } })
    if (!ciclo) return no(`No hay ciclo de ${anio}. Ábrelo antes de dar de alta a nadie.`)

    const sesiones = await prisma.sesion.findMany({
      where: {
        activo: true,
        tipoCursoId: solicitud.tipoCursoId,
        horarioId: solicitud.horarioId,
      },
      select: { id: true },
    })
    if (sesiones.length === 0) {
      return no('Ese curso ya no se da a esa hora. Dalo de alta desde el formulario normal.')
    }

    // El locker se revisa ahora, no cuando lo pidió: pudo ocuparse.
    const actual = await periodoActual()
    let locker: { id: string; periodoId: string } | undefined
    let seLeFue = false
    if (solicitud.lockerId && actual) {
      const libre = await prisma.asignacionLocker.findFirst({
        where: { lockerId: solicitud.lockerId, periodoId: actual.periodo.id },
        select: { id: true },
      })
      if (libre) seLeFue = true
      else locker = { id: solicitud.lockerId, periodoId: actual.periodo.id }
    }

    const inscripcion = await inscribirAlumno({
      nombreCompleto: solicitud.nombreCompleto,
      cicloAnualId: ciclo.id,
      sesionIds: sesiones.map((s) => s.id),
      ...(locker ? { locker } : {}),
      // Lo que ya llenó al registrarse no se le vuelve a pedir en la
      // ventanilla: sus datos fiscales y su constancia viajan con él.
      ...(solicitud.factura && solicitud.rfc
        ? {
            factura: {
              rfc: solicitud.rfc,
              razonSocial: solicitud.razonSocial ?? '',
              codigoPostal: solicitud.codigoPostal ?? '',
              regimenFiscal: solicitud.regimenFiscal ?? '',
              usoCfdi: solicitud.usoCfdi ?? '',
              correo: solicitud.correoFactura,
              constanciaPdf: solicitud.constanciaPdf
                ? new Uint8Array(solicitud.constanciaPdf)
                : null,
              constanciaNombre: solicitud.constanciaNombre,
            },
          }
        : {}),
    })

    const avisado = solicitud.correo
      ? await avisarQueQuedo({
          correo: solicitud.correo,
          nombreCompleto: solicitud.nombreCompleto,
          folio: inscripcion.folio,
          tokenQR: inscripcion.tokenQR,
        })
      : false

    await prisma.solicitudDeRegistro.update({
      where: { id: solicitud.id },
      data: {
        atendidaEn: new Date(),
        atendidaPorId: usuario.id,
        inscripcionId: inscripcion.id,
        avisadoEn: avisado ? new Date() : null,
      },
    })

    revalidatePath('/panel/alumnos')
    return {
      ok: true,
      mensaje:
        `${solicitud.nombreCompleto} quedó inscrito con el folio ${inscripcion.folio}.` +
        (seLeFue ? ' El locker que pidió ya estaba ocupado: se dio de alta sin locker.' : '') +
        (avisado
          ? ` Se le avisó a ${solicitud.correo}.`
          : solicitud.correo
            ? ` No salió el correo a ${solicitud.correo}: dile tú su folio.`
            : ' No dejó correo: dile tú su folio.'),
    }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo dar de alta.')
  }
}

/**
 * Descarta una solicitud sin crear a nadie.
 *
 * Para los duplicados —alguien que ya estaba inscrito y volvió a llenar el
 * formulario— y para la basura que llega a cualquier formulario abierto.
 *
 * No se borra: queda con su fecha y con quién la descartó. Una solicitud
 * que desaparece sin rastro es una que nadie puede reclamar después.
 */
export async function descartarSolicitud(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requierePermiso('ALUMNOS')

    const solicitud = await sinAtender(texto(datos, 'hash'))
    if (!solicitud) return no('Esa solicitud ya no está pendiente. Recarga la página.')

    await prisma.solicitudDeRegistro.update({
      where: { id: solicitud.id },
      data: { atendidaEn: new Date(), atendidaPorId: usuario.id },
    })

    revalidatePath('/panel/alumnos')
    return { ok: true, mensaje: `Se descartó la solicitud de ${solicitud.nombreCompleto}.` }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo descartar.')
  }
}
