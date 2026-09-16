'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { esRoot } from '@/lib/roles'
import { nuevoHash } from '@/lib/ids'
import { MODOS, seEnciman, mesesQueCorre, type ModoFecha } from '@/lib/temporadas'
import {
  validarCatalogo,
  validarEntero,
  validarFranja,
  normalizarClave,
} from '@/lib/validaciones'
import { exigirAdministrador, falla, texto, numero, casilla } from './guardas'
import type { Resultado } from './guardas'

/**
 * Los cinco catálogos del panel: cursos, días, horarios, tipos de pago y
 * recurrencias. No se relacionan entre sí; cada uno se administra aparte.
 *
 * Ninguna acción recibe el id de la base: recibe el `hash`, los 24
 * caracteres al azar que el registro estrenó al crearse. Un hash inventado
 * no encuentra nada, y el de otra tabla tampoco, porque cada tabla busca en
 * la suya. Cambiar el campo a mano no edita el renglón de al lado: no edita
 * nada.
 */
const RECARGAR = [
  '/panel/admin/cursos',
  '/panel/admin/dias',
  '/panel/admin/horarios',
  '/panel/admin/tipos-pago',
  '/panel/admin/recurrencias',
  '/panel/admin/temporadas',
]

function recargar() {
  for (const ruta of RECARGAR) revalidatePath(ruta)
}

const NO_EXISTE = (que: string): Resultado => ({
  ok: false,
  mensaje: `Ese ${que} ya no existe, o el enlace no es válido. Recarga la página.`,
})

/**
 * ¿Es un alta o una edición? Lo dice el formulario, no la presencia del
 * hash.
 *
 * Antes se miraba si venía `hash`: quitarle ese campo al formulario de un
 * renglón hacía que la edición cayera en la rama de crear y diera de alta
 * un registro nuevo. Ahora lo que no se anuncia como alta tiene que
 * resolver un hash que exista, o no pasa nada.
 */
const esAlta = (datos: FormData) => texto(datos, 'alta') === '1'

const rangoOrden = (bruto: string) => ({ min: 0, max: 999, campo: 'El orden', bruto })

/** El modo de fechas de un curso. Lo que no se reconozca es recurrente. */
const modoDe = (datos: FormData): ModoFecha => {
  const bruto = texto(datos, 'modoFecha') as ModoFecha
  return MODOS.includes(bruto) ? bruto : 'RECURRENTE'
}

/** La descripción es una nota opcional: en blanco se guarda como nada. */
const descripcionDe = (datos: FormData) => texto(datos, 'descripcion') || null

/**
 * ¿Ya hay otro renglón con ese nombre? Se compara sin distinguir mayúsculas
 * ni espacios de sobra.
 *
 * Importa porque el nombre es lo que ve el alumno: dos cursos habilitados
 * llamados "Curso Adultos" no se distinguen en ninguna pantalla, y al
 * inscribir nadie sabría cuál escoger.
 *
 * Solo cuentan los habilitados. Si el anterior está desactivado, su nombre
 * queda libre: es justo como se reemplaza un curso por otro sin perder el
 * historial del viejo.
 *
 * `hashPropio` deja pasar el renglón que se está editando: renombrarse a
 * sí mismo no es un choque.
 */
function nombreRepetido<T extends { hash: string; activo?: boolean }>(
  renglones: T[],
  nombre: string,
  hashPropio?: string,
): T | undefined {
  const buscado = nombre.trim().toLocaleLowerCase('es')
  return renglones.find(
    (r) =>
      r.hash !== hashPropio &&
      // Uno desactivado no estorba: ya no se ofrece, así que el nombre
      // queda libre para el que lo reemplaza.
      r.activo !== false &&
      (r as T & { nombre: string }).nombre.trim().toLocaleLowerCase('es') === buscado,
  )
}

const YA_EXISTE = (nombre: string): Resultado => ({
  ok: false,
  mensaje: `Ya hay otro con el nombre "${nombre.trim()}". Ponle uno distinto.`,
})

/**
 * La clave sale del nombre y ya no se teclea. Si el nombre no deja ninguna
 * letra —"!!!"— no hay clave, y el alta se rechaza antes de llegar aquí.
 */
async function claveLibre(
  nombre: string,
  existe: (clave: string) => Promise<boolean>,
): Promise<string | null> {
  const base = normalizarClave(nombre)
  if (!base) return null
  if (!(await existe(base))) return base

  // Dos nombres distintos pueden normalizar igual ("Pago único" y "Pago
  // Unico"). Se numera en vez de rechazar: el nombre es del usuario, la
  // clave es cosa del sistema y no tiene por qué estorbarle.
  for (let n = 2; n <= 99; n++) {
    const intento = `${base}_${n}`.slice(0, 30)
    if (!(await existe(intento))) return intento
  }
  return null
}

// ------------------------------------------------------- días de la semana

export async function guardarDiaSemana(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const nombre = texto(datos, 'nombre')
    const numeroDia = numero(datos, 'numero')
    const hash = texto(datos, 'hash')

    const problema =
      validarCatalogo({ nombre, descripcion: texto(datos, 'descripcion') }) ??
      validarEntero(numeroDia, {
        min: 0, max: 6, campo: 'El día del calendario', bruto: texto(datos, 'numero'),
      })
    if (problema) return { ok: false, mensaje: problema }

    // El número es el del calendario y es único: dos días no pueden ser
    // ambos "el 3".
    const choque = await prisma.diaSemana.findUnique({ where: { numero: numeroDia } })

    if (!esAlta(datos)) {
      const actual = await prisma.diaSemana.findUnique({ where: { hash } })
      if (!actual) return NO_EXISTE('día')
      if (choque && choque.id !== actual.id) {
        return { ok: false, mensaje: `${choque.nombre} ya ocupa el número ${numeroDia}.` }
      }

      const gemelo = nombreRepetido(await prisma.diaSemana.findMany(), nombre, hash)
      if (gemelo) return YA_EXISTE(nombre)

      await prisma.diaSemana.update({
        where: { hash },
        data: {
          nombre,
          descripcion: descripcionDe(datos),
          numero: numeroDia,
          activo: casilla(datos, 'activo'),
        },
      })
      recargar()
      return { ok: true, mensaje: `${nombre} quedó guardado.` }
    }

    if (choque) return { ok: false, mensaje: `${choque.nombre} ya ocupa el número ${numeroDia}.` }

    if (nombreRepetido(await prisma.diaSemana.findMany(), nombre)) return YA_EXISTE(nombre)

    const clave = await claveLibre(nombre, async (c) =>
      Boolean(await prisma.diaSemana.findUnique({ where: { clave: c } })))
    if (!clave) return { ok: false, mensaje: 'Ese nombre no deja ninguna letra ni número.' }

    await prisma.diaSemana.create({
      data: {
        hash: nuevoHash(), clave, nombre,
        descripcion: descripcionDe(datos), numero: numeroDia,
      },
    })
    recargar()
    return { ok: true, mensaje: `${nombre} quedó creado.` }
  } catch (e) {
    return falla(e)
  }
}

export async function eliminarDiaSemana(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await exigirAdministrador()
    const hash = texto(datos, 'hash')
    const actual = hash ? await prisma.diaSemana.findUnique({ where: { hash } }) : null
    if (!actual) return NO_EXISTE('día')

    // El Administrador apaga; borrar de verdad es de Root.
    if (!esRoot(usuario)) {
      await prisma.diaSemana.update({ where: { hash }, data: { activo: false } })
      recargar()
      return { ok: true, mensaje: `${actual.nombre} quedó desactivado.` }
    }

    await prisma.diaSemana.delete({ where: { hash } })
    recargar()
    return { ok: true, mensaje: `${actual.nombre} se eliminó.` }
  } catch (e) {
    return falla(e)
  }
}

// ------------------------------------------------------ catálogo de horarios

export async function guardarHorario(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const hash = texto(datos, 'hash')

    const problemaTexto = validarCatalogo({
      nombre: 'franja', // la franja no tiene nombre: se revisa solo la nota
      descripcion: texto(datos, 'descripcion'),
    })
    if (problemaTexto) return { ok: false, mensaje: problemaTexto }

    // Las horas no se editan: son la identidad de la franja. Cambiarlas es
    // crear otra y dar de baja esta.
    if (!esAlta(datos)) {
      const actual = await prisma.horario.findUnique({ where: { hash } })
      if (!actual) return NO_EXISTE('horario')

      await prisma.horario.update({
        where: { hash },
        data: { descripcion: descripcionDe(datos), activo: casilla(datos, 'activo') },
      })
      recargar()
      return { ok: true, mensaje: `La franja ${actual.horaInicio}—${actual.horaFin} quedó guardada.` }
    }

    const horaInicio = texto(datos, 'horaInicio')
    const horaFin = texto(datos, 'horaFin')
    const problema = validarFranja(horaInicio, horaFin)
    if (problema) return { ok: false, mensaje: problema }

    const existe = await prisma.horario.findUnique({
      where: { horaInicio_horaFin: { horaInicio, horaFin } },
    })
    if (existe) return { ok: false, mensaje: `Esa franja ya existe: ${horaInicio}—${horaFin}.` }

    await prisma.horario.create({
      data: { hash: nuevoHash(), horaInicio, horaFin, descripcion: descripcionDe(datos) },
    })
    recargar()
    return { ok: true, mensaje: `Franja ${horaInicio}—${horaFin} creada.` }
  } catch (e) {
    return falla(e)
  }
}

export async function eliminarHorario(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const hash = texto(datos, 'hash')
    const actual = hash ? await prisma.horario.findUnique({ where: { hash } }) : null
    if (!actual) return NO_EXISTE('horario')

    const franja = `${actual.horaInicio}—${actual.horaFin}`
    if (!actual.activo) return { ok: true, mensaje: `${franja} ya estaba apagada.` }

    // Una franja no se borra nunca, ni siendo Root: las clases que ya se
    // marcaron la nombran, y el catálogo de 24 horas está completo a
    // propósito. Apagarla la saca de circulación sin perder nada.
    await prisma.horario.update({ where: { hash }, data: { activo: false } })
    recargar()
    return { ok: true, mensaje: `${franja} quedó apagada.` }
  } catch (e) {
    return falla(e)
  }
}

// ----------------------------------------------------------- tipos de pago

export async function guardarTipoPago(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const nombre = texto(datos, 'nombre')
    const hash = texto(datos, 'hash')

    const problema = validarCatalogo({ nombre, descripcion: texto(datos, 'descripcion') })
    if (problema) return { ok: false, mensaje: problema }

    if (!esAlta(datos)) {
      if (!(await prisma.tipoPago.findUnique({ where: { hash } }))) return NO_EXISTE('tipo de pago')
      if (nombreRepetido(await prisma.tipoPago.findMany(), nombre, hash)) return YA_EXISTE(nombre)

      await prisma.tipoPago.update({
        where: { hash },
        data: {
          nombre,
          descripcion: descripcionDe(datos),
          activo: casilla(datos, 'activo'),
        },
      })
      recargar()
      return { ok: true, mensaje: `${nombre} quedó guardado.` }
    }

    if (nombreRepetido(await prisma.tipoPago.findMany(), nombre)) return YA_EXISTE(nombre)

    const clave = await claveLibre(nombre, async (c) =>
      Boolean(await prisma.tipoPago.findUnique({ where: { clave: c } })))
    if (!clave) return { ok: false, mensaje: 'Ese nombre no deja ninguna letra ni número.' }

    await prisma.tipoPago.create({
      data: { hash: nuevoHash(), clave, nombre, descripcion: descripcionDe(datos) },
    })
    recargar()
    return { ok: true, mensaje: `${nombre} quedó creado.` }
  } catch (e) {
    return falla(e)
  }
}

export async function eliminarTipoPago(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const hash = texto(datos, 'hash')
    const actual = hash ? await prisma.tipoPago.findUnique({ where: { hash } }) : null
    if (!actual) return NO_EXISTE('tipo de pago')
    if (!actual.activo) return { ok: true, mensaje: `${actual.nombre} ya estaba apagado.` }

    // No se borra nunca, ni siendo Root: los precios lo nombran, y un cargo
    // ya emitido quedaría sin decir cómo se cobró.
    await prisma.tipoPago.update({ where: { hash }, data: { activo: false } })
    recargar()
    return { ok: true, mensaje: `${actual.nombre} quedó apagado.` }
  } catch (e) {
    return falla(e)
  }
}

// ----------------------------------------------------- recurrencias de pago

export async function guardarRecurrencia(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const nombre = texto(datos, 'nombre')
    const meses = numero(datos, 'meses')
    const hash = texto(datos, 'hash')

    const problema =
      validarCatalogo({ nombre, descripcion: texto(datos, 'descripcion') }) ??
      validarEntero(meses, { min: 1, max: 120, campo: 'Los meses', bruto: texto(datos, 'meses') })
    if (problema) return { ok: false, mensaje: problema }

    if (!esAlta(datos)) {
      if (!(await prisma.frecuenciaPago.findUnique({ where: { hash } }))) {
        return NO_EXISTE('tipo de recurrencia')
      }
      if (nombreRepetido(await prisma.frecuenciaPago.findMany(), nombre, hash)) {
        return YA_EXISTE(nombre)
      }

      await prisma.frecuenciaPago.update({
        where: { hash },
        data: {
          nombre,
          descripcion: descripcionDe(datos),
          meses,
          activo: casilla(datos, 'activo'),
        },
      })
      recargar()
      return { ok: true, mensaje: `${nombre} quedó guardada.` }
    }

    if (nombreRepetido(await prisma.frecuenciaPago.findMany(), nombre)) return YA_EXISTE(nombre)

    const clave = await claveLibre(nombre, async (c) =>
      Boolean(await prisma.frecuenciaPago.findUnique({ where: { clave: c } })))
    if (!clave) return { ok: false, mensaje: 'Ese nombre no deja ninguna letra ni número.' }

    await prisma.frecuenciaPago.create({
      data: { hash: nuevoHash(), clave, nombre, descripcion: descripcionDe(datos), meses },
    })
    recargar()
    return { ok: true, mensaje: `${nombre} quedó creada.` }
  } catch (e) {
    return falla(e)
  }
}

export async function eliminarRecurrencia(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await exigirAdministrador()
    const hash = texto(datos, 'hash')
    const actual = hash ? await prisma.frecuenciaPago.findUnique({ where: { hash } }) : null
    if (!actual) return NO_EXISTE('tipo de recurrencia')

    const enUso = await prisma.tarifa.count({ where: { frecuenciaId: actual.id } })

    if (enUso > 0 || !esRoot(usuario)) {
      await prisma.frecuenciaPago.update({ where: { hash }, data: { activo: false } })
      recargar()
      return {
        ok: true,
        mensaje: enUso > 0
          ? `${actual.nombre} quedó desactivada. No se borra porque ya hay precios que la usan.`
          : `${actual.nombre} quedó desactivada.`,
      }
    }

    await prisma.frecuenciaPago.delete({ where: { hash } })
    recargar()
    return { ok: true, mensaje: `${actual.nombre} se eliminó.` }
  } catch (e) {
    return falla(e)
  }
}

// --------------------------------------------------------- tipos de curso

/**
 * ¿Estorba otro curso con ese nombre?
 *
 * Dos cursos pueden llamarse igual mientras no corran al mismo tiempo: uno
 * de enero a marzo y otro de abril a diciembre son dos cosas distintas y se
 * distinguen por sus fechas. Lo que no puede haber son dos corriendo a la
 * vez con el mismo nombre, porque al inscribir nadie sabría cuál es cuál.
 *
 * Un curso sin fechas capturadas todavía no estorba: no hay con qué
 * compararlo. En cuanto se le ponga una que se encime, se rechaza desde
 * Fechas por curso.
 */
async function cursoQueEstorba(nombre: string, hashPropio?: string): Promise<Resultado> {
  const buscado = nombre.trim().toLocaleLowerCase('es')
  const gemelos = (
    await prisma.tipoCurso.findMany({
      where: { activo: true },
      include: { temporadas: { select: { desde: true, hasta: true } } },
    })
  ).filter((c) => c.hash !== hashPropio && c.nombre.trim().toLocaleLowerCase('es') === buscado)

  if (gemelos.length === 0) return null

  const anio = new Date().getFullYear()
  const mio = hashPropio
    ? await prisma.tipoCurso.findUnique({
        where: { hash: hashPropio },
        include: { temporadas: { select: { desde: true, hasta: true } } },
      })
    : null
  const misTemporadas = mio?.temporadas ?? []
  const miModo = (mio?.modoFecha ?? 'RECURRENTE') as ModoFecha

  for (const otro of gemelos) {
    if (seEnciman(anio, misTemporadas, miModo, otro.temporadas, otro.modoFecha as ModoFecha)) {
      return {
        ok: false,
        mensaje: `Ya hay otro "${otro.nombre}" corriendo en los mismos meses. Pueden llamarse igual, pero no correr a la vez.`,
      }
    }
  }
  return null
}

export async function guardarTipoCurso(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const nombre = texto(datos, 'nombre')
    const hash = texto(datos, 'hash')

    const problema = validarCatalogo({ nombre, descripcion: texto(datos, 'descripcion') })
    if (problema) return { ok: false, mensaje: problema }

    // Cuántos meses dura el curso. En blanco es sin tope: así estuvo el
    // sistema hasta que se pidió limitarlo, y así se deja quien no lo use.
    const brutoTope = texto(datos, 'maxMeses')
    const maxMeses = brutoTope === '' ? null : numero(datos, 'maxMeses')
    if (maxMeses !== null) {
      const malTope = validarEntero(maxMeses, {
        min: 1, max: 120, campo: 'El máximo de meses', bruto: brutoTope,
      })
      if (malTope) return { ok: false, mensaje: malTope }
    }

    if (!esAlta(datos)) {
      if (!(await prisma.tipoCurso.findUnique({ where: { hash } }))) return NO_EXISTE('curso')
      const choque = await cursoQueEstorba(nombre, hash)
      if (choque) return choque

      // La clave no se toca al editar: es de lo que se agarran el motor de
      // cobro y el seeder. El nombre sí, y es el que ve el alumno.
      await prisma.tipoCurso.update({
        where: { hash },
        data: {
          nombre,
          descripcion: descripcionDe(datos),
          modoFecha: modoDe(datos),
          maxMeses,
          activo: casilla(datos, 'activo'),
        },
      })
      recargar()
      return { ok: true, mensaje: `${nombre} quedó guardado.` }
    }

    const choque = await cursoQueEstorba(nombre)
    if (choque) return choque

    const clave = await claveLibre(nombre, async (c) =>
      Boolean(await prisma.tipoCurso.findUnique({ where: { clave: c } })))
    if (!clave) return { ok: false, mensaje: 'Ese nombre no deja ninguna letra ni número.' }

    await prisma.tipoCurso.create({
      data: {
        hash: nuevoHash(), clave, nombre,
        descripcion: descripcionDe(datos), modoFecha: modoDe(datos), maxMeses,
      },
    })
    recargar()
    return { ok: true, mensaje: `${nombre} quedó creado.` }
  } catch (e) {
    return falla(e)
  }
}

export async function eliminarTipoCurso(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const hash = texto(datos, 'hash')
    const actual = hash ? await prisma.tipoCurso.findUnique({ where: { hash } }) : null
    if (!actual) return NO_EXISTE('curso')
    if (!actual.activo) return { ok: true, mensaje: `${actual.nombre} ya estaba desactivado.` }

    // Un curso no se borra nunca, ni siendo Root: sus cargos, sus sesiones
    // y quién estuvo inscrito lo nombran. Desactivarlo lo saca de
    // circulación —deja de ofrecerse, de agendarse y de cobrarse— sin
    // perder nada, y deja su nombre libre para el que lo reemplace.
    await prisma.tipoCurso.update({ where: { hash }, data: { activo: false } })
    recargar()
    return { ok: true, mensaje: `${actual.nombre} quedó desactivado.` }
  } catch (e) {
    return falla(e)
  }
}

// ------------------------------------------------------- días laborales

/**
 * Prende o apaga una celda del marco: el cruce de un día con una franja.
 *
 * Si la celda no existe se crea prendida; si existe, se invierte. Nunca se
 * borra: apagarla es suficiente y así el renglón conserva su hash.
 */
export async function alternarFranjaLaboral(
  _previo: Resultado,
  datos: FormData,
): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const diaHash = texto(datos, 'dia')
    const horarioHash = texto(datos, 'horario')

    const [dia, horario] = await Promise.all([
      diaHash ? prisma.diaSemana.findUnique({ where: { hash: diaHash } }) : null,
      horarioHash ? prisma.horario.findUnique({ where: { hash: horarioHash } }) : null,
    ])
    if (!dia || !horario) return NO_EXISTE('día u horario')

    const llave = { diaSemanaId_horarioId: { diaSemanaId: dia.id, horarioId: horario.id } }
    const actual = await prisma.franjaLaboral.findUnique({ where: llave })

    if (!actual) {
      await prisma.franjaLaboral.create({
        data: { hash: nuevoHash(), diaSemanaId: dia.id, horarioId: horario.id },
      })
    } else {
      await prisma.franjaLaboral.update({ where: llave, data: { activo: !actual.activo } })
    }

    revalidatePath('/panel/admin/dias-laborales')
    revalidatePath('/panel/admin/rejilla')
    const prendida = !actual || !actual.activo
    return {
      ok: true,
      mensaje: `${dia.nombre} ${horario.horaInicio}—${horario.horaFin}: ${prendida ? 'abierto' : 'cerrado'}.`,
    }
  } catch (e) {
    return falla(e)
  }
}
