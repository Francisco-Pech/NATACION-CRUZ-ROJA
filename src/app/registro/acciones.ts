'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { nombreDeAlumno } from '@/lib/formato'

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()

const volver = (recado: string) => redirect(`/registro?mal=${encodeURIComponent(recado)}`)

/** Nombre y apellido: un solo nombre suelto no identifica a nadie en una lista. */
const LARGO_NOMBRE = { min: 5, max: 120 }

/**
 * Guarda la solicitud de quien quiere inscribirse.
 *
 * No crea alumno, ni folio, ni cargos: crea una solicitud que alguien de la
 * delegación tiene que dar de alta. Este formulario no pide contraseña, así
 * que lo llena cualquiera, y un alumno inventado con folio podría pagar,
 * pasar lista y sacar credencial.
 *
 * Nada de lo que llega se cree: el curso, el horario y el locker se buscan
 * en la base por su clave pública, y lo que no exista o no esté abierto se
 * rechaza. Un formulario alterado no puede apuntar a un curso apagado.
 */
export async function pedirRegistro(datos: FormData) {
  const nombreCompleto = nombreDeAlumno(texto(datos, 'nombreCompleto'))
  if (nombreCompleto.length < LARGO_NOMBRE.min) {
    volver('Escribe el nombre completo del alumno, con apellidos.')
  }
  if (nombreCompleto.length > LARGO_NOMBRE.max) {
    volver('Ese nombre es demasiado largo.')
  }

  // El grupo viaja como "cursoHash|horarioHash", que es como se arma en la
  // pantalla. Los dos se comprueban aparte contra la base.
  const [cursoHash = '', horarioHash = ''] = texto(datos, 'grupo').split('|')

  const curso = cursoHash
    ? await prisma.tipoCurso.findFirst({ where: { hash: cursoHash, activo: true } })
    : null
  const horario = horarioHash
    ? await prisma.horario.findFirst({ where: { hash: horarioHash, activo: true } })
    : null
  if (!curso || !horario) volver('Escoge el curso y el horario.')

  // Y que ese curso de verdad corra a esa hora: dos claves válidas sueltas
  // no hacen un grupo que exista.
  const existeElGrupo = await prisma.sesion.findFirst({
    where: { activo: true, tipoCursoId: curso!.id, horarioId: horario!.id },
    select: { id: true },
  })
  if (!existeElGrupo) volver('Ese curso no se da a esa hora. Escoge otro horario.')

  // El locker es opcional: no todos lo usan y se cobra aparte cada mes.
  const numeroLocker = Number(texto(datos, 'locker'))
  const locker = Number.isInteger(numeroLocker) && numeroLocker > 0
    ? await prisma.locker.findFirst({ where: { numero: numeroLocker, activo: true } })
    : null

  const telefono = texto(datos, 'telefono').slice(0, 20) || null

  await prisma.solicitudDeRegistro.create({
    data: {
      hash: nuevoHash(),
      nombreCompleto,
      tipoCursoId: curso!.id,
      horarioId: horario!.id,
      lockerId: locker?.id ?? null,
      telefono,
    },
  })

  redirect('/registro?listo=1')
}
