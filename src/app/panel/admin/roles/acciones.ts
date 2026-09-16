'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { validarCatalogo, normalizarClave } from '@/lib/validaciones'
import { exigirPermiso, falla, texto, casilla } from '../guardas'
import type { Resultado } from '../guardas'

/**
 * Los roles: los grupos en los que se divide el personal.
 *
 * Por ahora solo su nombre, su descripción y si está activo. Lo que puede
 * hacer cada uno todavía no se define aquí.
 */

const RUTA = '/panel/admin/roles'

const esAlta = (datos: FormData) => texto(datos, 'alta') === '1'

export async function guardarRol(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirPermiso('USUARIOS')

    const nombre = texto(datos, 'nombre')
    const descripcion = texto(datos, 'descripcion')
    const problema = validarCatalogo({ nombre, descripcion })
    if (problema) return { ok: false, mensaje: problema }

    const repetido = await prisma.rol.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(esAlta(datos) ? {} : { NOT: { hash: texto(datos, 'hash') } }),
      },
    })
    if (repetido) return { ok: false, mensaje: `Ya hay un rol llamado "${repetido.nombre}".` }

    // Los permisos no se tocan desde aquí: todavía no se definen cuáles son
    // ni qué abre cada uno. Escribirlos con lo que traiga el formulario
    // —que hoy no trae ninguno— le borraría los suyos a un rol existente.
    const comun = {
      nombre,
      descripcion: descripcion || null,
      activo: casilla(datos, 'activo'),
    }

    if (esAlta(datos)) {
      const clave = await claveLibre(normalizarClave(nombre))
      // El formulario de alta no lleva casillas, así que `activo` llegaría
      // en falso y el rol nacería apagado sin que nadie lo pidiera.
      await prisma.rol.create({ data: { ...comun, activo: true, clave, hash: nuevoHash() } })
      revalidatePath(RUTA)
      return { ok: true, mensaje: `El rol ${nombre} quedó creado.` }
    }

    const actual = await prisma.rol.findUnique({
      where: { hash: texto(datos, 'hash') },
      include: { _count: { select: { usuarios: true } } },
    })
    if (!actual) return { ok: false, mensaje: 'Ese rol ya no existe.' }

    await prisma.rol.update({ where: { id: actual.id }, data: comun })
    revalidatePath(RUTA)
    revalidatePath('/panel')

    return { ok: true, mensaje: `El rol ${nombre} quedó guardado.` }
  } catch (e) {
    return falla(e)
  }
}

/**
 * Apaga un rol. Nunca lo borra, y no si alguien lo lleva puesto.
 *
 * Un usuario sin rol no puede existir: es lo que decide qué puede hacer.
 * Borrar el rol de alguien lo dejaría en un estado que el sistema no sabe
 * leer, así que primero hay que moverlo a otro rol.
 */
export async function desactivarRol(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirPermiso('USUARIOS')
    const rol = await prisma.rol.findUnique({
      where: { hash: texto(datos, 'hash') },
      include: { _count: { select: { usuarios: true } } },
    })
    if (!rol) return { ok: false, mensaje: 'Ese rol ya no existe.' }
    if (!rol.activo) return { ok: true, mensaje: `${rol.nombre} ya estaba desactivado.` }

    if (rol._count.usuarios > 0) {
      return {
        ok: false,
        mensaje:
          `${rol._count.usuarios} ${rol._count.usuarios === 1 ? 'persona lo lleva' : 'personas lo llevan'} puesto. ` +
          'Muévelas a otro rol primero: nadie puede quedarse sin rol.',
      }
    }

    await prisma.rol.update({ where: { id: rol.id }, data: { activo: false } })
    revalidatePath(RUTA)
    return { ok: true, mensaje: `${rol.nombre} se desactivó.` }
  } catch (e) {
    return falla(e)
  }
}

/** Si la clave ya existe, se le pega un número hasta que quede libre. */
async function claveLibre(base: string): Promise<string> {
  let clave = base || 'ROL'
  for (let i = 2; await prisma.rol.findUnique({ where: { clave } }); i++) {
    clave = `${base}_${i}`
  }
  return clave
}
