'use server'

import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { nombreDeAlumno } from '@/lib/formato'
import { LARGO_NOMBRE } from '@/lib/validaciones'
import { validarDatosFactura, normalizarRfc, USO_CFDI, validarConstancia } from '@/lib/facturacion'
import type { Resultado } from '../panel/admin/catalogo/tipos'

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()
const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

/**
 * Guarda la solicitud de quien quiere inscribirse.
 *
 * Es el mismo formulario del mostrador, sin descuento, y hace lo mismo
 * salvo lo único que importa: no crea alumno, ni folio, ni cargos. Crea
 * una solicitud que alguien de la delegación tiene que dar de alta.
 *
 * Aquí entra gente sin contraseña, así que nada de lo que llega se cree:
 * el curso, el horario y el locker se buscan en la base por su clave
 * pública, y lo que no exista o esté cerrado se rechaza.
 */
export async function pedirRegistro(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const nombreCompleto = nombreDeAlumno(texto(datos, 'nombreCompleto'))
    if (nombreCompleto.length < LARGO_NOMBRE.min) {
      return no('Escribe el nombre completo del alumno, con apellidos.')
    }
    if (nombreCompleto.length > LARGO_NOMBRE.max) return no('Ese nombre es demasiado largo.')

    // El correo: es por donde se le va a avisar si lo aceptan, así que sin
    // él la solicitud no sirve de nada aunque se guarde.
    const correo = texto(datos, 'correo').toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
      return no('Escribe un correo electrónico válido: ahí te avisamos si te aceptan.')
    }

    // ---- el curso y el horario ----
    const sesionHashes = datos.getAll('sesiones').map(String).filter(Boolean)
    if (sesionHashes.length === 0) return no('Escoge el curso y el horario.')

    const sesiones = await prisma.sesion.findMany({
      where: { hash: { in: sesionHashes }, activo: true, tipoCurso: { activo: true } },
      include: { tipoCurso: true, horario: true },
    })
    if (sesiones.length !== sesionHashes.length) {
      return no('Ese curso ya no está abierto. Vuelve a escoger.')
    }

    // ---- el locker, si pidió uno ----
    //
    // Se apunta cuál quiere, pero no se aparta: entre hoy y el día que lo
    // den de alta pueden pasar semanas, y dejar un locker congelado por una
    // solicitud que quizá nunca se atienda se lo quita a quien sí vino.
    const idLocker = texto(datos, 'locker')
    const locker = idLocker
      ? await prisma.locker.findFirst({
          where: { id: idLocker, activo: true, deProfesor: null },
          select: { id: true },
        })
      : null
    if (idLocker && !locker) return no('Ese locker ya no está disponible. Escoge otro.')

    // ---- la facturación ----
    const quiereFactura = datos.get('factura') === 'on'
    let factura: Record<string, string | null> = {}
    let constancia: { pdf: Uint8Array<ArrayBuffer>; nombre: string } | null = null

    if (quiereFactura) {
      const problema = validarDatosFactura({
        rfc: texto(datos, 'rfc'),
        razonSocial: texto(datos, 'razonSocial'),
        codigoPostal: texto(datos, 'codigoPostal'),
        regimenFiscal: texto(datos, 'regimenFiscal'),
        usoCfdi: USO_CFDI.clave,
      })
      if (problema) return no(problema)

      const archivo = datos.get('constancia')
      if (archivo instanceof File && archivo.size > 0) {
        const malArchivo = validarConstancia({ tipo: archivo.type, tamano: archivo.size })
        if (malArchivo) return no(malArchivo)
        constancia = {
          pdf: new Uint8Array(await archivo.arrayBuffer()),
          nombre: archivo.name.slice(0, 120),
        }
      }

      factura = {
        rfc: normalizarRfc(texto(datos, 'rfc')),
        razonSocial: texto(datos, 'razonSocial'),
        codigoPostal: texto(datos, 'codigoPostal'),
        regimenFiscal: texto(datos, 'regimenFiscal'),
        usoCfdi: USO_CFDI.clave,
        correoFactura: texto(datos, 'correoFactura') || null,
      }
    }

    await prisma.solicitudDeRegistro.create({
      data: {
        hash: nuevoHash(),
        nombreCompleto,
        correo,
        tipoCursoId: sesiones[0].tipoCursoId,
        horarioId: sesiones[0].horarioId,
        lockerId: locker?.id ?? null,
        factura: quiereFactura,
        ...factura,
        constanciaPdf: constancia?.pdf ?? null,
        constanciaNombre: constancia?.nombre ?? null,
      },
    })

    return {
      ok: true,
      mensaje:
        `Recibimos tu solicitud. Cuando la Cruz Roja la revise te avisamos a ${correo}:` +
        ' ahí te llegan el folio del alumno y su código. Todavía no se te ha cobrado nada.',
    }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo enviar la solicitud.')
  }
}
