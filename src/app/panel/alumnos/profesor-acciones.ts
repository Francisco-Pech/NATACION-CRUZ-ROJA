'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requierePermiso, type UsuarioSesion } from '@/lib/sesion'
import { supervisaListas, puedeMoverAsistencia, claseYaOcurrio } from '@/lib/permisos'
import { clasesEnRango } from '@/lib/clases-del-mes'
import { mesCubierto } from '@/lib/cargos'
import { festivosQueCuentan } from '@/lib/dias-inhabiles'
import { anioEnCurso, mesEnCurso, hoyEnCancun } from '@/lib/zona'
import type { Resultado } from '../admin/catalogo/tipos'

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()
const dos = (n: number) => String(n).padStart(2, '0')
const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

/** "hashCurso|hashHorario": así ningún id de la base sale a la pantalla. */
const claveGrupo = (cursoHash: string, horarioHash: string) => `${cursoHash}|${horarioHash}`

/**
 * ¿Este puede tocar la lista de ese mes?
 *
 * La regla vive en `permisos`, donde se puede probar sin base de datos. Aquí
 * solo se le dice en qué mes estamos.
 */
const sePuedeEditar = (usuario: UsuarioSesion, anio: number, mes: number) =>
  puedeMoverAsistencia(usuario, anio, mes, { anio: anioEnCurso(), mes: mesEnCurso() })

/** Los grupos que imparte quien está adentro. */
export async function misGrupos() {
  const usuario = await requierePermiso('ASISTENCIA')

  const grupos = await prisma.profesorDeGrupo.findMany({
    where: { usuarioId: usuario.id },
    include: { tipoCurso: true, horario: true },
  })

  return grupos
    .filter((g) => g.tipoCurso.activo && g.horario.activo)
    .map((g) => ({
      clave: claveGrupo(g.tipoCurso.hash, g.horario.hash),
      curso: g.tipoCurso.nombre,
      horario: `${g.horario.horaInicio}–${g.horario.horaFin}`,
    }))
    .sort((a, b) => a.curso.localeCompare(b.curso, 'es') || a.horario.localeCompare(b.horario))
}

/**
 * Todos los grupos que corren, para quien supervisa.
 *
 * Administrador y Root no imparten nada: si se les ofrecieran "sus" grupos,
 * el selector saldría vacío. Ven el catálogo completo, que es justo lo que
 * necesitan para revisar si las listas se están llevando.
 */
export async function todosLosGrupos() {
  const usuario = await requierePermiso('ASISTENCIA')
  if (!supervisaListas(usuario)) throw new Error('No autorizado')

  const sesiones = await prisma.sesion.findMany({
    where: { activo: true, tipoCurso: { activo: true }, horario: { activo: true } },
    include: { tipoCurso: true, horario: true },
  })

  // Un grupo es el curso a una hora: sus días son renglones distintos en la
  // rejilla, pero la misma lista.
  const porClave = new Map<string, { clave: string; curso: string; horario: string }>()
  for (const s of sesiones) {
    porClave.set(claveGrupo(s.tipoCurso.hash, s.horario.hash), {
      clave: claveGrupo(s.tipoCurso.hash, s.horario.hash),
      curso: s.tipoCurso.nombre,
      horario: `${s.horario.horaInicio}–${s.horario.horaFin}`,
    })
  }

  return [...porClave.values()].sort(
    (a, b) => a.curso.localeCompare(b.curso, 'es') || a.horario.localeCompare(b.horario),
  )
}

/**
 * La lista de un grupo entre dos fechas: sus alumnos y sus días de clase.
 *
 * Trae los días desde la rejilla, no un mes entero de casillas: un grupo que
 * corre lunes y miércoles no debería enseñar treinta columnas de las que
 * veintidós no existen.
 *
 * Va por tramo de fechas y no por mes suelto porque un mes suelto se queda
 * sin el año: en enero, "noviembre" ya no alcanzaría noviembre del año
 * pasado, que es justo lo que alguien querría revisar.
 */
export async function listaDelGrupo(clave: string, desde: string, hasta: string) {
  const usuario = await requierePermiso('ASISTENCIA')

  const inicio = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null

  const [cursoHash, horarioHash] = clave.split('|')
  const supervisa = supervisaListas(usuario)

  // El profesor se revisa contra sus grupos y no contra el catálogo: no debe
  // poder ver la lista de un grupo que no imparte cambiando la clave. Quien
  // supervisa sí mira cualquiera — para eso supervisa.
  const grupo = supervisa
    ? await delCatalogo(cursoHash, horarioHash)
    : await prisma.profesorDeGrupo.findFirst({
        where: {
          usuarioId: usuario.id,
          tipoCurso: { hash: cursoHash },
          horario: { hash: horarioHash },
        },
        include: { tipoCurso: true, horario: true },
      })
  if (!grupo) return null

  const sesiones = await prisma.sesion.findMany({
    where: { tipoCursoId: grupo.tipoCursoId, horarioId: grupo.horarioId, activo: true },
    select: { id: true, diaSemana: true },
  })

  // Los inhábiles de cada año que toca el tramo: un rango de diciembre a
  // enero cruza dos calendarios.
  const anios = aniosEntre(inicio, fin)
  const inhabiles = await prisma.diaInhabil.findMany()
  const cerrados = anios.flatMap((anio) =>
    festivosQueCuentan(
      inhabiles.map((d) => ({ tipo: d.tipo, desde: d.desde, hasta: d.hasta, cadaAnio: d.cadaAnio })),
      anio,
    ),
  )

  const clases = clasesEnRango(desde, hasta, [...new Set(sesiones.map((s) => s.diaSemana))], cerrados)

  const inscritos = await prisma.inscripcionSesion.findMany({
    where: {
      sesionId: { in: sesiones.map((s) => s.id) },
      inscripcion: { estado: 'ACTIVA', ciclo: { anio: { in: anios } } },
    },
    include: {
      inscripcion: {
        include: {
          alumno: { select: { nombreCompleto: true } },
          asistencias: { where: { fecha: { gte: inicio, lte: fin } } },
          cargos: {
            select: {
              estado: true,
              periodo: { select: { mes: true, ciclo: { select: { anio: true } } } },
            },
          },
          verificaciones: { where: { anio: fin.getFullYear(), mes: fin.getMonth() + 1 } },
        },
      },
    },
  })

  // Quien va lunes y miércoles aparece dos veces en el cruce: es un alumno.
  const porAlumno = new Map<string, (typeof inscritos)[number]['inscripcion']>()
  for (const i of inscritos) porAlumno.set(i.inscripcion.id, i.inscripcion)

  // Día por día y no de golpe: un tramo puede empezar en un mes cerrado y
  // terminar en el que corre, y el profesor sí puede tocar esa segunda mitad.
  const hoy = hoyEnCancun()
  const fechas = clases.map((f) => {
    const dia = f.toISOString().slice(0, 10)
    // Una clase que no se ha dado no se palomea, la dé quien la dé: ni Root
    // puede saber quién va a venir mañana.
    const futura = !claseYaOcurrio(dia, hoy)
    return {
      dia,
      futura,
      editable: !futura && sePuedeEditar(usuario, f.getFullYear(), f.getMonth() + 1),
    }
  })

  /**
   * La credencial es mensual, y el tramo puede cruzar meses: cuenta contra
   * el mes en que termina. Es el que se está revisando.
   */
  const credencial = { anio: fin.getFullYear(), mes: fin.getMonth() + 1 }
  const mesDeLaCredencial = `${credencial.anio}-${dos(credencial.mes)}`

  /** Los meses que toca el tramo, como "2026-09". */
  const mesesDelTramo = [...new Set(fechas.map((f) => f.dia.slice(0, 7)))]

  return {
    curso: grupo.tipoCurso.nombre,
    horario: `${grupo.horario.horaInicio}–${grupo.horario.horaFin}`,
    fechas,
    credencial: {
      ...credencial,
      sePuedePedir: sePuedeEditar(usuario, credencial.anio, credencial.mes),
    },
    /**
     * Está viendo una lista que no lleva.
     *
     * No es lo mismo que un tramo cerrado, y la pantalla no debe decir que
     * septiembre cerró estando en septiembre: al Administrador la lista se
     * le cierra por quién es, no por cuándo.
     */
    soloMira: supervisa && fechas.every((f) => !f.editable),
    alumnos: [...porAlumno.values()]
      .map((i) => {
        const cargos = i.cargos.map((c) => ({
          mes: `${c.periodo.ciclo.anio}-${dos(c.periodo.mes)}`,
          estado: c.estado as string,
        }))
        return {
          folio: i.folio,
          nombre: i.alumno.nombreCompleto,
          /** Los días que ya trae marcados, en el mismo formato que `fechas`. */
          asistio: i.asistencias.map((a) => a.fecha.toISOString().slice(0, 10)),
          /** Si ya le pidieron la credencial ese mes, y cómo. */
          verificado: i.verificaciones[0]?.como ?? null,
          /**
           * Los meses del tramo que trae pagados.
           *
           * Sin el mes cubierto no hay clase: ni credencial ni asistencia.
           * La casilla de un día suyo se apaga aunque el día sí se pueda
           * tocar.
           */
          mesesCubiertos: mesesDelTramo.filter((m) => mesCubierto(cargos, m)),
          /** Si el mes contra el que corre la credencial está pagado. */
          credencialSePuede: mesCubierto(cargos, mesDeLaCredencial),
        }
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  }
}

/** Los años que toca el tramo: uno, o dos cuando cruza el 31 de diciembre. */
function aniosEntre(inicio: Date, fin: Date): number[] {
  const anios: number[] = []
  for (let a = inicio.getFullYear(); a <= fin.getFullYear(); a++) anios.push(a)
  return anios
}

/** El grupo tal como está en el catálogo, sin pasar por quién lo imparte. */
async function delCatalogo(cursoHash: string, horarioHash: string) {
  const [tipoCurso, horario] = await Promise.all([
    prisma.tipoCurso.findUnique({ where: { hash: cursoHash } }),
    prisma.horario.findUnique({ where: { hash: horarioHash } }),
  ])
  if (!tipoCurso || !horario) return null
  return { tipoCursoId: tipoCurso.id, horarioId: horario.id, tipoCurso, horario }
}

/**
 * ¿Ese alumno tiene cubierto ese mes?
 *
 * La pantalla ya apaga las casillas de quien debe, pero la acción lo vuelve
 * a preguntar: la pantalla es una cortesía y esto es la regla.
 */
async function tieneCubierto(inscripcionId: string, mes: string): Promise<boolean> {
  const cargos = await prisma.cargo.findMany({
    where: { inscripcionId },
    select: { estado: true, periodo: { select: { mes: true, ciclo: { select: { anio: true } } } } },
  })
  return mesCubierto(
    cargos.map((c) => ({
      mes: `${c.periodo.ciclo.anio}-${dos(c.periodo.mes)}`,
      estado: c.estado as string,
    })),
    mes,
  )
}

/** Busca al alumno por su folio, dentro de los grupos de este profesor. */
async function suAlumno(usuario: UsuarioSesion, folio: string) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { folio },
    include: { sesiones: { select: { sesion: { select: { tipoCursoId: true, horarioId: true } } } } },
  })
  if (!inscripcion) return { mal: `No hay ninguna inscripción con el folio ${folio}.` }

  // Quien supervisa corrige cualquier lista: no tiene grupos contra los
  // cuales comparar.
  if (supervisaListas(usuario)) return { inscripcion }

  const suyos = await prisma.profesorDeGrupo.findMany({
    where: { usuarioId: usuario.id },
    select: { tipoCursoId: true, horarioId: true },
  })
  const esSuyo = inscripcion.sesiones.some((s) =>
    suyos.some(
      (g) => g.tipoCursoId === s.sesion.tipoCursoId && g.horarioId === s.sesion.horarioId,
    ),
  )
  // Un profesor no pasa lista de alumnos que no son suyos, aunque teclee un
  // folio válido.
  if (!esSuyo) return { mal: 'Ese alumno no está en ninguno de tus grupos.' }

  return { inscripcion }
}

/**
 * Marca o desmarca una asistencia.
 *
 * La asistencia es la existencia del renglón: no hay un "ausente" guardado.
 * Quien no vino sencillamente no tiene fila ese día, que es como se lleva
 * una lista en papel.
 */
export async function marcarAsistencia(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requierePermiso('ASISTENCIA')

    const dia = texto(datos, 'fecha')
    const fecha = new Date(`${dia}T12:00:00`)
    if (Number.isNaN(fecha.getTime())) return no('Esa fecha no existe.')

    if (!claseYaOcurrio(dia, hoyEnCancun())) {
      return no('Esa clase todavía no se da. No hay a quién pasarle lista.')
    }

    if (!sePuedeEditar(usuario, fecha.getFullYear(), fecha.getMonth() + 1)) {
      return no(
        supervisaListas(usuario)
          ? 'La lista la lleva el profesor. Aquí solo se puede ver.'
          : 'Ese mes ya cerró. Se puede ver, pero no cambiar.',
      )
    }

    const { inscripcion, mal } = await suAlumno(usuario, texto(datos, 'folio'))
    if (mal || !inscripcion) return no(mal ?? 'No se pudo marcar.')

    if (!(await tieneCubierto(inscripcion.id, dia.slice(0, 7)))) {
      return no('No tiene pagado ese mes. Mándalo a la ventanilla antes de pasarle lista.')
    }

    const puesta = datos.get('asistio') === 'si'
    if (puesta) {
      await prisma.asistencia.upsert({
        where: { inscripcionId_fecha: { inscripcionId: inscripcion.id, fecha } },
        update: { registradaPorId: usuario.id },
        create: { inscripcionId: inscripcion.id, fecha, registradaPorId: usuario.id },
      })
    } else {
      await prisma.asistencia.deleteMany({ where: { inscripcionId: inscripcion.id, fecha } })
    }

    revalidatePath('/panel/alumnos')
    return { ok: true, mensaje: puesta ? 'Asistencia marcada.' : 'Asistencia quitada.' }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo marcar.')
  }
}

/**
 * Deja constancia de que el profesor vio la credencial del alumno este mes.
 *
 * Se guarda cómo: escaneando el QR o tecleando el folio. No es lo mismo —el
 * escaneo prueba que el papel estaba ahí; el folio se puede dictar por
 * teléfono— y el día que algo no cuadre, esa diferencia es lo único que
 * queda.
 *
 * No bloquea nada: quien no la traiga sale señalado y la lista sigue.
 */
export async function verificarCredencial(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requierePermiso('ASISTENCIA')

    const anio = Number(texto(datos, 'anio'))
    const mes = Number(texto(datos, 'mes'))
    if (!sePuedeEditar(usuario, anio, mes)) {
      return no(
        supervisaListas(usuario)
          ? 'La credencial la pide el profesor. Aquí solo se puede ver.'
          : 'Ese mes ya cerró.',
      )
    }

    const como = texto(datos, 'como') === 'ESCANEO' ? 'ESCANEO' : 'FOLIO'

    // El escáner devuelve el token del QR; a mano se teclea el folio. Son
    // dos llaves distintas a propósito: el folio se imprime y se dicta.
    const bruto = texto(datos, 'credencial').toUpperCase()
    const porToken = await prisma.inscripcion.findUnique({
      where: { tokenQR: texto(datos, 'credencial') },
      select: { folio: true },
    })
    const folio = porToken?.folio ?? bruto

    const { inscripcion, mal } = await suAlumno(usuario, folio)
    if (mal || !inscripcion) return no(mal ?? 'No se pudo verificar.')

    // La credencial vale porque hay un mes pagado detrás. Sin eso no se
    // valida: sería sellar un papel que no da derecho a nada.
    if (!(await tieneCubierto(inscripcion.id, `${anio}-${dos(mes)}`))) {
      return no(`No tiene pagado ${anio}-${dos(mes)}. La credencial no vale hasta que pague.`)
    }

    await prisma.verificacionCredencial.upsert({
      where: { inscripcionId_anio_mes: { inscripcionId: inscripcion.id, anio, mes } },
      update: { verificadaPorId: usuario.id, como },
      create: { inscripcionId: inscripcion.id, anio, mes, verificadaPorId: usuario.id, como },
    })

    revalidatePath('/panel/alumnos')
    return { ok: true, mensaje: `Credencial de ${folio} verificada este mes.` }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo verificar.')
  }
}
