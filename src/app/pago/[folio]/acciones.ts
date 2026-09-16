'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { normalizarFolio } from '@/lib/folio'
import { faltaUnPeriodoAntes } from '@/lib/cargos'
import { pasaElTope } from '@/lib/cobros'
import { iniciarCobroDeCargo, iniciarCobroEnLaPagina } from '@/lib/servicios/cobro-en-linea'
import type { Siguiente } from '@/lib/pasarela'
import { toBuffer } from 'bwip-js/node'

/** La referencia de OXXO dibujada como el código que lee la caja. */
async function codigoDeBarrasDe(referencia: string): Promise<string | null> {
  try {
    const imagen = await toBuffer({
      bcid: 'code128',
      text: referencia,
      scale: 3,
      height: 16,
      includetext: false,
      paddingwidth: 6,
      paddingheight: 6,
    })
    return `data:image/png;base64,${imagen.toString('base64')}`
  } catch {
    // Sin código de barras se sigue pudiendo pagar: queda la referencia
    // tecleada y el recibo de Stripe, que trae el suyo.
    return null
  }
}
import { validarComprobante } from '@/lib/comprobante'
import { sePuedePagarEnLinea } from '@/lib/metodos-pago'
import {
  USO_CFDI, validarDatosFactura, normalizarRfc, validarCorreoFactura, validarConstancia,
} from '@/lib/facturacion'
import { validarReporte, telefonoCompleto } from '@/lib/reportes'
import { enviarCorreo, correoDelAdministrador } from '@/lib/correo'
import { EstadoCargo, MetodoPago } from '@prisma/client'

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()

/** Vuelve a la misma pantalla con un recado, bueno o malo. */
const volver = (folio: string, recado: string, mal = false) =>
  redirect(`/pago/${folio}?${mal ? 'mal' : 'bien'}=${encodeURIComponent(recado)}`)

/**
 * Todos los cargos del alumno dueño de ese folio, de todos sus años.
 *
 * Se llega por el folio pero se buscan por el alumno: alguien inscrito dos
 * años seguidos tiene dos folios, y su deuda de 2025 sigue siendo suya
 * cuando entra con el de 2026.
 */
export async function cuentaDelFolio(folioTecleado: string) {
  const folio = normalizarFolio(folioTecleado)
  if (!folio) return null

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { folio },
    include: {
      alumno: true,
      sesiones: { include: { sesion: { include: { tipoCurso: true, horario: true } } } },
    },
  })
  if (!inscripcion) return null

  const cargos = await prisma.cargo.findMany({
    where: { inscripcion: { alumnoId: inscripcion.alumnoId } },
    include: { periodo: { include: { ciclo: true } }, tipoCurso: true, pagos: true },
  })

  return { inscripcion, cargos: cargos.sort((a, b) => a.periodo.clave.localeCompare(b.periodo.clave)) }
}

/**
 * ¿Ese cargo es de quien dice el folio, y le toca pagarlo ya?
 *
 * Las dos preguntas juntas porque las dos se contestan igual de mal desde el
 * formulario: cambiar el id del cargo por el de otra persona, o saltarse los
 * meses que debe para pagar uno de más adelante.
 */
async function elCargoQueToca(folioTecleado: string, cargoId: string) {
  const cuenta = await cuentaDelFolio(folioTecleado)
  if (!cuenta) return { mal: 'No encontramos ese folio.' }

  const cargo = cuenta.cargos.find((c) => c.id === cargoId)
  if (!cargo) return { mal: 'Ese mes no es de esta cuenta.' }
  if (cargo.estado === EstadoCargo.PAGADO) return { mal: 'Ese mes ya está pagado.' }
  if (cargo.estado === EstadoCargo.CANCELADO) return { mal: 'Ese mes está cancelado.' }

  // El curso dura lo que dura. La pantalla ya no enseña el mes que sobra,
  // pero el formulario se puede alterar y aquí es donde se decide.
  const sobra = pasaElTope(
    cuenta.cargos
      .filter((c) => c.tipoCursoId === cargo.tipoCursoId)
      .map((c) => ({ clave: c.periodo.clave, cancelado: c.estado === EstadoCargo.CANCELADO })),
    cargo.periodo.clave,
    cargo.tipoCurso.maxMeses,
  )
  if (sobra) {
    return {
      mal: `Ese mes pasa de los ${cargo.tipoCurso.maxMeses} meses que dura ${cargo.tipoCurso.nombre}:`
        + ' ya no se cobra. Si crees que es un error, avísanos.',
    }
  }

  const falta = faltaUnPeriodoAntes(
    cuenta.cargos.map((c) => ({
      clave: c.periodo.clave,
      cubierto: c.estado === EstadoCargo.PAGADO || c.estado === EstadoCargo.CANCELADO,
    })),
    cargo.periodo.clave,
  )
  if (falta) {
    const [anio, mes] = falta.split('-')
    return { mal: `Antes tienes que pagar el mes ${mes} de ${anio}.` }
  }

  // La pantalla ya esconde los botones de un mes vencido, pero la acción lo
  // vuelve a preguntar: la pantalla es una cortesía y esto es la regla.
  if (!sePuedePagarEnLinea(cargo.periodo.fechaLimite)) {
    return {
      mal: 'Se pasó la fecha límite de ese mes: ya no se cobra en línea. Pasa a la delegación'
        + ' para regularizarlo.',
    }
  }

  return { cargo }
}

export type Arranque =
  | { ok: false; mensaje: string }
  | {
      ok: true
      siguiente: Siguiente
      metodo: MetodoPago
      total: number
      /**
       * El código de barras del recibo de OXXO: lo que pasa el cajero.
       *
       * Es Code128, que es lo que lee su escáner, y se dibuja con una
       * librería y no a mano: un código mal trazado se ve idéntico y no
       * pasa en la caja, y eso se descubre con la persona formada.
       *
       * En el servidor, que es donde ya vive la referencia y donde la
       * librería no tiene que viajar al navegador.
       */
      codigoDeBarras: string | null
    }

/**
 * Arranca el cobro de un mes y devuelve con qué sigue la persona.
 *
 * No redirige: cada método termina de una manera distinta —la tarjeta pide
 * la tarjeta, OXXO entrega un recibo, la transferencia una CLABE— y todo
 * eso se enseña en una ventana, sin sacar a nadie de su cuenta.
 *
 * Nada de esto da el pago por bueno. Eso solo lo hace el aviso firmado de
 * la pasarela.
 */
export async function iniciarPago(_previo: unknown, datos: FormData): Promise<Arranque> {
  const folio = normalizarFolio(texto(datos, 'folio'))
  const metodo = texto(datos, 'metodo') as MetodoPago

  const { cargo, mal } = await elCargoQueToca(folio, texto(datos, 'cargoId'))
  if (mal || !cargo) return { ok: false, mensaje: mal ?? 'No se pudo cobrar.' }

  try {
    const { siguiente, pago } = await iniciarCobroDeCargo(cargo.id, metodo, `/pago/${folio}`)

    // La pasarela de demostración no cobra: sigue teniendo su pantalla.
    if (siguiente.tipo === 'DEMOSTRACION') redirect(siguiente.url)

    const codigoDeBarras =
      siguiente.tipo === 'RECIBO' && siguiente.numero
        ? await codigoDeBarrasDe(siguiente.numero)
        : null

    return { ok: true, siguiente, metodo, total: pago.montoCobrado, codigoDeBarras }
  } catch (e) {
    // `redirect` funciona lanzando: no es un error que haya que tapar.
    if (e && typeof e === 'object' && 'digest' in e) throw e
    return {
      ok: false,
      mensaje: e instanceof Error
        ? `No se pudo arrancar el cobro: ${e.message}`
        : 'No se pudo arrancar el cobro.',
    }
  }
}

/**
 * Guarda el comprobante de un mes.
 *
 * Lo sube quien paga y no el mostrador: pagó en OXXO o transfirió, y el
 * cobro tarda en reflejarse. Con su ticket aquí, quien atiende ve con qué
 * respaldar el pago; sin él tendría que creerle de palabra.
 */
export async function subirComprobante(datos: FormData) {
  const folio = normalizarFolio(texto(datos, 'folio'))

  const cuenta = await cuentaDelFolio(folio)
  if (!cuenta) return volver(folio, 'No encontramos ese folio.', true)

  // Contra la cuenta y no solo por el id: sin esto, cambiar el cargoId en el
  // formulario le subiría comprobantes a la cuenta de otro.
  const cargo = cuenta.cargos.find((c) => c.id === texto(datos, 'cargoId'))
  if (!cargo) return volver(folio, 'Ese mes no es de esta cuenta.', true)

  const archivo = datos.get('comprobante')
  if (!(archivo instanceof File) || archivo.size === 0) {
    return volver(folio, 'Escoge el archivo antes de enviarlo.', true)
  }

  const mal = validarComprobante({ tipo: archivo.type, tamano: archivo.size })
  if (mal) return volver(folio, mal, true)

  await prisma.cargo.update({
    where: { id: cargo.id },
    data: {
      comprobanteImagen: new Uint8Array(await archivo.arrayBuffer()),
      comprobanteTipo: archivo.type,
      comprobanteNombre: archivo.name.slice(0, 120),
      comprobanteSubidoEn: new Date(),
    },
  })

  volver(folio, 'Recibimos tu comprobante. En recepción lo revisan y registran tu pago.')
}

/**
 * Guarda lo que contestó sobre su factura: la quiere, la corrige o la quita.
 *
 * Si dice que no, los datos que tenía se quedan escritos a propósito —si el
 * mes que entra vuelve a pedirla no teclea todo otra vez— pero con `factura`
 * apagado nadie le expide nada.
 *
 * Si dice que sí, se validan igual que en el mostrador. Un RFC mal escrito
 * no se nota hasta que el SAT rechaza el CFDI y hay que reexpedirlo.
 */
export async function guardarFactura(datos: FormData) {
  const folio = normalizarFolio(texto(datos, 'folio'))

  const cuenta = await cuentaDelFolio(folio)
  if (!cuenta) return volver(folio, 'No encontramos ese folio.', true)

  const alumnoId = cuenta.inscripcion.alumnoId

  const capturados = {
    rfc: normalizarRfc(texto(datos, 'rfc')),
    razonSocial: texto(datos, 'razonSocial'),
    codigoPostal: texto(datos, 'codigoPostal'),
    regimenFiscal: texto(datos, 'regimenFiscal'),
    usoCfdi: USO_CFDI.clave,
  }

  const mal = validarDatosFactura(capturados)
  if (mal) return volver(folio, mal, true)

  // El correo es donde llega el CFDI: sin él la factura se expide y no
  // llega a ninguna parte.
  const correo = texto(datos, 'correoFactura')
  const malCorreo = validarCorreoFactura(correo)
  if (malCorreo) return volver(folio, malCorreo, true)

  // La constancia es opcional y se puede traer después: quien la tiene a
  // mano la sube ahora, quien no, guarda sus datos igual.
  const archivo = datos.get('constancia')
  let constancia: { pdf: Uint8Array<ArrayBuffer>; nombre: string } | null = null
  if (archivo instanceof File && archivo.size > 0) {
    const malPdf = validarConstancia({ tipo: archivo.type, tamano: archivo.size })
    if (malPdf) return volver(folio, malPdf, true)
    constancia = {
      pdf: new Uint8Array(await archivo.arrayBuffer()),
      nombre: archivo.name.slice(0, 120),
    }
  }

  await prisma.alumno.update({
    where: { id: alumnoId },
    data: {
      ...capturados,
      email: correo || null,
      factura: true,
      ...(constancia
        ? {
            constanciaPdf: constancia.pdf,
            constanciaNombre: constancia.nombre,
            constanciaSubidaEn: new Date(),
          }
        : {}),
    },
  })
  volver(folio, constancia
    ? 'Guardamos tus datos de factura y tu constancia.'
    : 'Guardamos tus datos de factura.')
}

/**
 * Apaga la factura.
 *
 * Los datos no se borran: si el mes que entra vuelve a pedirla, no tiene que
 * teclear todo otra vez. Lo que se apaga es que se le expida.
 *
 * Va en su propia acción y detrás de una confirmación porque es lo único de
 * esta pantalla que deshace algo — y que se descubra al recibir el pago sin
 * CFDI es descubrirlo tarde.
 */
export async function quitarFactura(datos: FormData) {
  const folio = normalizarFolio(texto(datos, 'folio'))

  const cuenta = await cuentaDelFolio(folio)
  if (!cuenta) return volver(folio, 'No encontramos ese folio.', true)

  await prisma.alumno.update({
    where: { id: cuenta.inscripcion.alumnoId },
    data: { factura: false },
  })
  volver(folio, 'Listo: ya no se te expedirá factura. Tus datos quedan guardados por si la pides otra vez.')
}

/**
 * Guarda el recado de quien no pudo pagar y avisa al Administrador.
 *
 * Primero se guarda y luego se avisa, en ese orden: si el correo falla —no
 * hay servicio, el buzón rebota, la clave venció— el recado ya está escrito
 * y alguien puede devolverle la llamada igual. Al revés se perdería justo la
 * persona que más necesita que la llamen.
 */
export async function reportarProblema(_previo: unknown, datos: FormData) {
  const folio = normalizarFolio(texto(datos, 'folio'))

  const reporte = {
    nombre: texto(datos, 'nombre'),
    correo: texto(datos, 'correo'),
    lada: texto(datos, 'lada') || '52',
    telefono: texto(datos, 'telefono'),
    mensaje: texto(datos, 'mensaje'),
  }

  const mal = validarReporte(reporte)
  if (mal) return { ok: false, mensaje: mal }

  // La imagen es opcional: suele ser la captura del error, que dice más que
  // la descripción. Se revisa igual que un comprobante.
  let imagen: Uint8Array<ArrayBuffer> | null = null
  let imagenTipo: string | null = null
  const archivo = datos.get('imagen')
  if (archivo instanceof File && archivo.size > 0) {
    const malArchivo = validarComprobante({ tipo: archivo.type, tamano: archivo.size })
    if (malArchivo) return { ok: false, mensaje: malArchivo }
    imagen = new Uint8Array(await archivo.arrayBuffer())
    imagenTipo = archivo.type
  }

  const guardado = await prisma.reporteDePago.create({
    data: {
      folio: folio || null,
      nombre: reporte.nombre,
      correo: reporte.correo,
      telefono: telefonoCompleto(reporte.lada, reporte.telefono),
      mensaje: reporte.mensaje,
      imagen,
      imagenTipo,
    },
  })

  const para = correoDelAdministrador()
  const avisado = para
    ? await enviarCorreo({
        para,
        asunto: `Falló un pago en línea · ${reporte.nombre}`,
        texto: [
          `${reporte.nombre} no pudo pagar en línea.`,
          '',
          `Folio: ${folio || '(no llegó a tenerlo)'}`,
          `Teléfono: ${telefonoCompleto(reporte.lada, reporte.telefono)}`,
          `Correo: ${reporte.correo}`,
          imagen ? 'Adjuntó una imagen; se ve en el sistema.' : 'Sin imagen.',
          '',
          'Lo que cuenta:',
          reporte.mensaje,
        ].join('\n'),
      })
    : false

  if (avisado) {
    await prisma.reporteDePago.update({
      where: { id: guardado.id },
      data: { avisadoPorCorreo: true },
    })
  }

  return {
    ok: true,
    mensaje: avisado
      ? 'Recibimos tu reporte y ya avisamos a la delegación. Te buscan al teléfono que dejaste.'
      : 'Recibimos tu reporte. Queda anotado con tus datos para que la delegación te busque.',
  }
}

/**
 * Manda a pagar a la página de Stripe.
 *
 * La salida para quien no quiera teclear su tarjeta en una pantalla que no
 * conoce: la de Stripe la ha visto en otras tiendas. Se cobra lo mismo y
 * se confirma por el mismo aviso firmado.
 */
export async function pagarEnLaPaginaDeStripe(datos: FormData) {
  const folio = normalizarFolio(texto(datos, 'folio'))
  const metodo = texto(datos, 'metodo') as MetodoPago

  const { cargo, mal } = await elCargoQueToca(folio, texto(datos, 'cargoId'))
  if (mal || !cargo) return volver(folio, mal ?? 'No se pudo cobrar.', true)

  const { url } = await iniciarCobroEnLaPagina(cargo.id, metodo, `/pago/${folio}`)
  redirect(url)
}
