'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { esAdministrativo } from '@/lib/permisos'
import {
  inscribirAlumno, cambiarSesiones, rehacerMesesPendientes,
} from '@/lib/servicios/inscripciones'
import {
  validarDatosFactura, validarConstancia, normalizarRfc, validarCorreoFactura,
} from '@/lib/facturacion'
import { LARGO_NOMBRE } from '@/lib/validaciones'
import { nombreDeAlumno } from '@/lib/formato'
import { validarVigencia } from '@/lib/descuentos'
import { armarCredencial } from '@/lib/credencial'
import { periodoActual } from '@/lib/periodo-actual'
import type { Resultado } from '../admin/catalogo/tipos'

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()
const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

export async function darDeAltaAlumno(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await requierePermiso('ALUMNOS')

    const nombreCompleto = nombreDeAlumno(texto(datos, 'nombreCompleto'))
    if (nombreCompleto.length < LARGO_NOMBRE.min) {
      return no(`El nombre debe tener al menos ${LARGO_NOMBRE.min} letras.`)
    }
    if (nombreCompleto.length > LARGO_NOMBRE.max) {
      return no(`El nombre es muy largo: máximo ${LARGO_NOMBRE.max} letras.`)
    }

    // ---- a qué días y horarios va ----
    //
    // Se resuelve antes que nada porque de aquí sale el año: cada renglón
    // de la rejilla cuelga de una temporada, y la temporada dice a qué año
    // pertenece el curso. Ese año es el del folio y el del ciclo, no el del
    // calendario: quien se inscribe en diciembre al curso de 2027 lleva un
    // folio CR2027 y sus cargos caen en el ciclo 2027.
    const sesionHashes = datos.getAll('sesiones').map(String).filter(Boolean)
    if (sesionHashes.length === 0) {
      return no('Escoge el curso y su horario: sin curso no se le genera cargo.')
    }
    const sesiones = await prisma.sesion.findMany({
      where: { hash: { in: sesionHashes }, activo: true },
      include: { temporada: true, tipoCurso: true },
    })
    if (sesiones.length !== sesionHashes.length) {
      return no('Ese horario ya no está disponible. Vuelve a escogerlo.')
    }

    const sinTemporada = sesiones.find((s) => !s.temporada)
    if (sinTemporada) {
      return no(
        `${sinTemporada.tipoCurso.nombre} no tiene fechas capturadas, así que no se sabe ` +
          'a qué año pertenece. Ponlas en "Fechas por curso".',
      )
    }

    const anios = [...new Set(sesiones.map((s) => s.temporada!.desde.getFullYear()))]
    if (anios.length > 1) {
      return no(
        `Esos días y horarios son de años distintos (${anios.join(' y ')}). ` +
          'Una inscripción pertenece a un solo año.',
      )
    }
    const anio = anios[0]

    const ciclo = await prisma.cicloAnual.findUnique({ where: { anio } })
    if (!ciclo) return no(`No hay un ciclo ${anio} abierto. Ábrelo antes de inscribir a nadie.`)
    if (ciclo.estado !== 'ABIERTO') return no(`El ciclo ${anio} está cerrado.`)

    // ---- el descuento, si le toca alguno ----
    let descuentoId: string | null = null
    let descuentoDesde: Date | null = null
    let descuentoHasta: Date | null = null
    const hashDescuento = texto(datos, 'descuento')
    if (hashDescuento) {
      const descuento = await prisma.descuento.findUnique({ where: { hash: hashDescuento } })
      if (!descuento || !descuento.activo) return no('Ese descuento ya no está disponible.')
      descuentoId = descuento.id

      // Hasta cuándo le dura a esta persona. Las dos vacías quieren decir
      // sin límite: es el caso de INAPAM, que vale mientras tenga la
      // credencial. Una cortesía se pone del día al mismo día.
      //
      // Al mediodía y no a medianoche: con la hora en cero, un cambio de
      // horario o un servidor en otra zona correrían la fecha un día.
      const leerFecha = (campo: string) => {
        const bruto = texto(datos, campo)
        return bruto ? new Date(`${bruto}T12:00:00`) : null
      }
      descuentoDesde = leerFecha('descuentoDesde')
      descuentoHasta = leerFecha('descuentoHasta')

      const malVigencia = validarVigencia(descuentoDesde, descuentoHasta)
      if (malVigencia) return no(malVigencia)
    }

    // ---- el locker, si pidió uno ----
    //
    // Se revisa aquí aunque la pantalla solo ofrezca los libres: entre que
    // se pintó y se apretó el botón pudo pasar un rato, y alguien más pudo
    // tomarlo desde el mostrador.
    let locker: { id: string; periodoId: string } | null = null
    const hashLocker = texto(datos, 'locker')
    if (hashLocker) {
      const actual = await periodoActual()
      if (!actual) return no('No hay periodo abierto para asignarle un locker.')

      const fila = await prisma.locker.findUnique({
        where: { id: hashLocker },
        include: {
          deProfesor: true,
          asignaciones: { where: { periodoId: actual.periodo.id } },
        },
      })
      if (!fila || !fila.activo) return no('Ese locker ya no está disponible.')
      if (fila.deProfesor) return no(`El locker ${fila.numero} está apartado para un profesor.`)
      if (fila.asignaciones.length > 0) {
        return no(`El locker ${fila.numero} ya lo tomaron. Escoge otro.`)
      }
      locker = { id: fila.id, periodoId: actual.periodo.id }
    }

    // ---- la facturación ----
    const quiereFactura = datos.get('factura') === 'on'
    let factura = null

    if (quiereFactura) {
      const capturados = {
        rfc: normalizarRfc(texto(datos, 'rfc')),
        razonSocial: texto(datos, 'razonSocial'),
        codigoPostal: texto(datos, 'codigoPostal'),
        regimenFiscal: texto(datos, 'regimenFiscal'),
        usoCfdi: texto(datos, 'usoCfdi'),
      }
      const malos = validarDatosFactura(capturados)
      if (malos) return no(malos)

      const correo = texto(datos, 'correoFactura')
      const malCorreo = validarCorreoFactura(correo)
      if (malCorreo) return no(malCorreo)

      const archivo = datos.get('constancia')
      const subido = archivo instanceof File && archivo.size > 0 ? archivo : null
      const malArchivo = validarConstancia(
        subido ? { tipo: subido.type, tamano: subido.size } : null,
      )
      if (malArchivo) return no(malArchivo)

      factura = {
        ...capturados,
        correo: correo || null,
        constanciaPdf: subido ? new Uint8Array(await subido.arrayBuffer()) : null,
        constanciaNombre: subido ? subido.name : null,
      }
    }

    const inscripcion = await inscribirAlumno({
      nombreCompleto,
      cicloAnualId: ciclo.id,
      sesionIds: sesiones.map((s) => s.id),
      descuentoId,
      descuentoDesde,
      descuentoHasta,
      locker,
      factura,
    })

    revalidatePath('/panel/alumnos')
    if (locker) revalidatePath('/panel/lockers')
    return { ok: true, mensaje: `${nombreCompleto} quedó inscrito con el folio ${inscripcion.folio}.` }
  } catch (e) {
    // El cupo revienta aquí dentro, con su propio mensaje: "Sin cupo en
    // Curso Adultos de 06:00: 35 de 35". Es lo que quien captura necesita
    // leer, así que se deja pasar tal cual.
    return no(e instanceof Error ? e.message : 'No se pudo dar de alta.')
  }
}

/**
 * La credencial de un alumno, para pintarla sin cambiar de pantalla.
 *
 * El código QR se dibuja aquí, en el servidor, y no viaja con la lista: son
 * unos 8 KB por alumno, y mandarlos todos de antemano para enseñar uno
 * haría pesada la tabla entera. Se pide cuando se abre la ventana.
 */
export async function obtenerCredencial(id: string) {
  await requierePermiso('ALUMNOS')
  return armarCredencial({ id })
}

/**
 * Lo que se puede cambiar de un alumno ya inscrito, para llenar la ventana.
 *
 * Solo lo que la ventana edita. El curso, el horario y el locker no salen a
 * propósito: cambiarlos toca cargos que ya se generaron, y el locker además
 * tiene su propia pantalla, donde se ve cuál está libre.
 */
export async function obtenerAlumno(inscripcionId: string) {
  const usuario = await requierePermiso('ALUMNOS')

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    include: {
      alumno: true,
      descuento: true,
      sesiones: { include: { sesion: { include: { tipoCurso: true, horario: true } } } },
    },
  })
  if (!inscripcion) return null

  const a = inscripcion.alumno
  const aFecha = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

  // A qué curso y hora va hoy. Todas sus sesiones son del mismo grupo: se
  // escoge el curso y la hora, y queda apuntado a los días en que eso corre.
  const suya = inscripcion.sesiones[0]?.sesion
  const grupo = suya ? `${suya.tipoCurso.hash}|${suya.horario.hash}` : ''

  return {
    folio: inscripcion.folio,
    nombreCompleto: a.nombreCompleto,
    grupo,
    /**
     * Mover el curso a media temporada rehace los meses que se deben, con
     * el precio del curso nuevo. Eso lo decide quien manda en la escuela,
     * no quien captura en la ventanilla.
     */
    puedeMoverGrupo: esAdministrativo(usuario),
    descuento: inscripcion.descuento?.hash ?? '',
    descuentoDesde: aFecha(inscripcion.descuentoDesde),
    descuentoHasta: aFecha(inscripcion.descuentoHasta),
    factura: a.factura,
    rfc: a.rfc ?? '',
    razonSocial: a.razonSocial ?? '',
    codigoPostal: a.codigoPostal ?? '',
    regimenFiscal: a.regimenFiscal ?? '',
    correoFactura: a.email ?? '',
    tieneConstancia: a.constanciaPdf !== null,
    constanciaNombre: a.constanciaNombre,
  }
}

/**
 * Cambia los datos de un alumno ya inscrito, sin sacar a nadie de la lista.
 *
 * Toca tres cosas: su nombre, el descuento que lleva con su vigencia, y si
 * factura y con qué datos. Nada de eso mueve cargos ya generados — un cargo
 * guarda sus montos al nacer, así que quitarle hoy el descuento no le
 * recalcula lo de meses pasados, y eso es lo correcto: ya se le cobró.
 *
 * El folio no se toca nunca. Se imprime, se dicta por teléfono y es como se
 * nombra la inscripción en papel.
 */
export async function editarAlumno(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requierePermiso('ALUMNOS')

    const inscripcion = await prisma.inscripcion.findUnique({
      where: { id: texto(datos, 'inscripcionId') },
      select: { id: true, alumnoId: true },
    })
    if (!inscripcion) return no('Esa inscripción ya no existe.')

    const nombreCompleto = nombreDeAlumno(texto(datos, 'nombreCompleto'))
    if (nombreCompleto.length < LARGO_NOMBRE.min) {
      return no(`El nombre va completo: al menos ${LARGO_NOMBRE.min} letras.`)
    }
    if (nombreCompleto.length > LARGO_NOMBRE.max) {
      return no(`Ese nombre es larguísimo: el tope son ${LARGO_NOMBRE.max} letras.`)
    }

    // ---- el descuento y hasta cuándo le dura ----
    let descuentoId: string | null = null
    let descuentoDesde: Date | null = null
    let descuentoHasta: Date | null = null

    const hashDescuento = texto(datos, 'descuento')
    if (hashDescuento) {
      const descuento = await prisma.descuento.findUnique({ where: { hash: hashDescuento } })
      if (!descuento || !descuento.activo) return no('Ese descuento ya no está disponible.')
      descuentoId = descuento.id

      // Al mediodía, como en el alta: con la hora en cero un servidor en
      // otra zona correría la fecha un día.
      const leerFecha = (campo: string) => {
        const bruto = texto(datos, campo)
        return bruto ? new Date(`${bruto}T12:00:00`) : null
      }
      descuentoDesde = leerFecha('descuentoDesde')
      descuentoHasta = leerFecha('descuentoHasta')

      const malVigencia = validarVigencia(descuentoDesde, descuentoHasta)
      if (malVigencia) return no(malVigencia)
    }

    // ---- la facturación ----
    //
    // Si la apaga, los datos que tenía se quedan escritos a propósito: si el
    // mes que entra vuelve a pedirla, nadie tiene que teclearlo todo otra
    // vez. Con `factura` apagado no se le expide nada de todos modos.
    const quiereFactura = datos.get('factura') === 'on'
    let factura = {}

    if (quiereFactura) {
      const capturados = {
        rfc: normalizarRfc(texto(datos, 'rfc')),
        razonSocial: texto(datos, 'razonSocial'),
        codigoPostal: texto(datos, 'codigoPostal'),
        regimenFiscal: texto(datos, 'regimenFiscal'),
        usoCfdi: texto(datos, 'usoCfdi'),
      }
      const malos = validarDatosFactura(capturados)
      if (malos) return no(malos)

      const correo = texto(datos, 'correoFactura')
      const malCorreo = validarCorreoFactura(correo)
      if (malCorreo) return no(malCorreo)

      const archivo = datos.get('constancia')
      const subido = archivo instanceof File && archivo.size > 0 ? archivo : null
      const malArchivo = validarConstancia(
        subido ? { tipo: subido.type, tamano: subido.size } : null,
      )
      if (malArchivo) return no(malArchivo)

      factura = {
        ...capturados,
        // Vacío se guarda como nulo, no se ignora: si alguien lo borra a
        // propósito es porque ya no quiere que llegue ahí.
        email: correo || null,
        // Sin archivo nuevo se queda el que ya tenía: volver a pedirle la
        // constancia solo por corregirle un dígito al código postal sería
        // hacerlo dar una vuelta de más.
        ...(subido
          ? {
              constanciaPdf: new Uint8Array(await subido.arrayBuffer()),
              constanciaNombre: subido.name,
              constanciaSubidaEn: new Date(),
            }
          : {}),
      }
    }

    await prisma.$transaction([
      prisma.alumno.update({
        where: { id: inscripcion.alumnoId },
        data: {
          nombreCompleto,
          factura: quiereFactura,
          ...factura,
        },
      }),
      prisma.inscripcion.update({
        where: { id: inscripcion.id },
        data: { descuentoId, descuentoDesde, descuentoHasta },
      }),
    ])

    /**
     * El curso y el horario: solo Administrador y Root.
     *
     * La pantalla ya no le enseña el campo a nadie más, pero esto es la
     * regla: un formulario alterado puede traer el campo igual, y mover a
     * alguien de curso cambia lo que paga.
     */
    let cambioDeGrupo = ''
    const grupo = texto(datos, 'grupo')
    if (grupo && esAdministrativo(usuario)) {
      const [cursoHash = '', horarioHash = ''] = grupo.split('|')
      const sesiones = await prisma.sesion.findMany({
        where: {
          activo: true,
          tipoCurso: { hash: cursoHash, activo: true },
          horario: { hash: horarioHash },
        },
        select: { id: true },
      })
      if (sesiones.length === 0) return no('Ese curso ya no se da a esa hora.')
      await cambiarSesiones(inscripcion.id, sesiones.map((s) => s.id))
      cambioDeGrupo = ' Se le rehicieron los meses que debe con el curso nuevo.'
    }

    // Lo que debe se vuelve a armar con lo que acaba de quedar: su curso y
    // su descuento. Lo pagado no se toca.
    await rehacerMesesPendientes(inscripcion.id)

    revalidatePath('/panel/alumnos')
    return { ok: true, mensaje: `${nombreCompleto} quedó actualizado.${cambioDeGrupo}` }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo guardar.')
  }
}
