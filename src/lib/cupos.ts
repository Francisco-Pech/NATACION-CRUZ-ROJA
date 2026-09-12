/**
 * Cuántos alumnos caben, y qué pasa con el que llega de más.
 *
 * El cupo y los extras son de cada renglón de "Días y horarios por curso":
 * Adultos a las 6 de la mañana puede aceptar un número y a las 10 otro, sin
 * que nadie tenga que decidirlo de antemano para todo el curso.
 */

/** Qué puede pasar al intentar meter a uno más. */
export type Lugar = 'cabe' | 'con-extras' | 'lleno'

/**
 * ¿Cabe uno más?
 *
 * Los extras son tolerancia, no cupo. Pasado el cupo se sigue aceptando
 * hasta agotarlos, pero avisando: quien inscribe tiene que saber que está
 * metiendo a alguien de más, y no enterarse cuando la alberca esté llena.
 */
export function cabeUnoMas(inscritos: number, cupo: number, extras: number): Lugar {
  if (inscritos < cupo) return 'cabe'
  if (inscritos < cupo + extras) return 'con-extras'
  return 'lleno'
}
