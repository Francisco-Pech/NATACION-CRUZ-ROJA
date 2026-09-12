import { leerSesion } from '@/lib/sesion'
import { esAdministrativo, esRoot } from '@/lib/roles'
import { aEntero } from '@/lib/validaciones'
import type { Resultado } from './catalogo/tipos'

export type { Resultado }

/** Toda acción de esta sección exige Administrador, o Root. */
export async function exigirAdministrador() {
  const usuario = await leerSesion()
  if (!usuario || !esAdministrativo(usuario)) {
    throw new Error('Solo el Administrador puede hacer este cambio')
  }
  return usuario
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
