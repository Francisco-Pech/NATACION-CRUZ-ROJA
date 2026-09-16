import { leerSesion } from '@/lib/sesion'
import { esRoot } from '@/lib/roles'
import { esAdministrativo, tienePermiso, type Permiso } from '@/lib/permisos'
import { aEntero } from '@/lib/validaciones'
import type { Resultado } from './catalogo/tipos'

export type { Resultado }

/**
 * Exige un permiso concreto. Es la puerta de todas las acciones.
 *
 * Root pasa siempre, aunque su rol no tenga nada marcado: sin esa red,
 * editar mal un rol dejaría el sistema sin nadie que pueda entrar a
 * deshacerlo, y eso no se arregla desde la aplicación.
 */
export async function exigirPermiso(permiso: Permiso) {
  const usuario = await leerSesion()
  if (!tienePermiso(usuario, permiso)) {
    throw new Error('No tienes permiso para hacer este cambio')
  }
  return usuario!
}

/** Toda acción de esta sección exige poder configurar la escuela. */
export async function exigirAdministrador() {
  const usuario = await leerSesion()
  if (!esAdministrativo(usuario)) {
    throw new Error('No tienes permiso para hacer este cambio')
  }
  return usuario!
}

/**
 * Lo que solo Root puede: borrar de verdad y mover precios.
 * El Administrador crea y edita; destruir histórico y tocar el dinero no.
 */
export async function exigirRoot() {
  const usuario = await leerSesion()
  if (!usuario || !esRoot(usuario)) {
    throw new Error('Solo Root puede hacer este cambio')
  }
  return usuario
}

/**
 * Convierte el error de una guarda en un mensaje visible.
 *
 * La guarda sigue lanzando —la operación no ocurre— pero al usuario se le
 * dice qué pasó en vez de tirarle una pantalla de error. Falla igual de
 * fuerte; solo que se entiende.
 */
export const falla = (e: unknown): Resultado => ({
  ok: false,
  mensaje: e instanceof Error ? e.message : 'No se pudo completar',
})

export const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()
export const numero = (datos: FormData, campo: string) => aEntero(datos.get(campo))
export const casilla = (datos: FormData, campo: string) => datos.get(campo) === 'on'
