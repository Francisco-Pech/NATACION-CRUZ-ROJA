'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requiereRol } from '@/lib/sesion'
import { inscribirAlumno } from '@/lib/servicios/inscripciones'
import { generarCargosDelPeriodo, aplicarRecargosVencidos } from '@/lib/servicios/periodos'
import { asignarLocker, liberarLocker } from '@/lib/servicios/lockers'
import { registrarPago, validarPago } from '@/lib/servicios/pagos'
import { periodoActual } from '@/lib/periodo-actual'
import { Categoria, MetodoPago, EstadoPago } from '@prisma/client'

export async function altaRapida(_previo: string | null, datos: FormData) {
  await requiereRol('ADMINISTRADOR', 'CAPTURISTA')

  const nombreCompleto = String(datos.get('nombreCompleto') ?? '').trim()
  if (nombreCompleto.length < 3) return 'Escribe el nombre completo'

  const categoria = datos.get('categoria') === 'NINOS' ? Categoria.NINOS : Categoria.GENERAL
  const actual = await periodoActual()
  if (!actual) return 'No hay un ciclo abierto'

  const inscripcion = await inscribirAlumno(nombreCompleto, actual.ciclo.id, categoria)
  await generarCargosDelPeriodo(actual.periodo.id)

  revalidatePath('/panel/alumnos')
  return `Alta lista: ${inscripcion.folio}`
}

export async function generarCargosDelMes() {
  await requiereRol('ADMINISTRADOR', 'CAPTURISTA')
  const actual = await periodoActual()
  if (!actual) return

  await generarCargosDelPeriodo(actual.periodo.id)
  await aplicarRecargosVencidos(actual.periodo.id)
  revalidatePath('/panel')
  revalidatePath('/panel/alumnos')
}

export async function cobrar(_previo: string | null, datos: FormData) {
  const usuario = await requiereRol('ADMINISTRADOR', 'CAPTURISTA')

  const cargoId = String(datos.get('cargoId') ?? '')
  const metodo = String(datos.get('metodo') ?? 'EFECTIVO') as MetodoPago
  const monto = Math.round(Number(datos.get('monto') ?? 0) * 100)
  if (!cargoId || monto <= 0) return 'Revisa el monto'

  await registrarPago({
    cargoId,
    metodo,
    montoCobrado: monto,
    referencia: String(datos.get('referencia') ?? '') || undefined,
    registradoPorId: usuario.id,
    estado: EstadoPago.CONFIRMADO,
  })

  revalidatePath('/panel')
  revalidatePath('/panel/pagos')
  revalidatePath('/panel/alumnos')
  return 'Pago registrado'
}

export async function resolverComprobante(datos: FormData) {
  const usuario = await requiereRol('ADMINISTRADOR', 'CAPTURISTA')
  const pagoId = String(datos.get('pagoId') ?? '')
  const aprobado = datos.get('accion') === 'aprobar'

  await validarPago(pagoId, usuario.id, aprobado)
  revalidatePath('/panel/pagos')
}

export async function moverLocker(datos: FormData) {
  await requiereRol('ADMINISTRADOR', 'CAPTURISTA')
  const periodoId = String(datos.get('periodoId') ?? '')
  const asignacionId = String(datos.get('asignacionId') ?? '')

  if (asignacionId) {
    await liberarLocker(asignacionId)
  } else {
    const lockerId = String(datos.get('lockerId') ?? '')
    const inscripcionId = String(datos.get('inscripcionId') ?? '')
    if (lockerId && inscripcionId) await asignarLocker(lockerId, inscripcionId, periodoId)
  }

  revalidatePath('/panel/lockers')
  revalidatePath('/panel/alumnos')
}

export async function guardarDatosAlumno(token: string, datos: FormData) {
  const texto = (campo: string) => {
    const valor = String(datos.get(campo) ?? '').trim()
    return valor.length ? valor : null
  }

  const inscripcion = await prisma.inscripcion.findUnique({ where: { tokenQR: token } })
  if (!inscripcion) throw new Error('Inscripción no encontrada')

  const nacimiento = texto('fechaNacimiento')

  await prisma.alumno.update({
    where: { id: inscripcion.alumnoId },
    data: {
      telefono: texto('telefono'),
      email: texto('email'),
      direccion: texto('direccion'),
      fechaNacimiento: nacimiento ? new Date(`${nacimiento}T12:00:00`) : null,
      contactoEmergenciaNombre: texto('contactoEmergenciaNombre'),
      contactoEmergenciaTelefono: texto('contactoEmergenciaTelefono'),
      condicionesMedicas: texto('condicionesMedicas'),
      rfc: texto('rfc'),
      razonSocial: texto('razonSocial'),
      codigoPostal: texto('codigoPostal'),
      datosCompletos: true,
    },
  })

  revalidatePath(`/q/${token}`)
}
