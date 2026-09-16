import { esRoot } from './roles'

/**
 * Qué puede hacer cada quien.
 *
 * Los roles se crean y se editan desde el panel; los permisos no. Cada uno
 * de esta lista corresponde a algo que el código de verdad protege, así que
 * inventar uno desde la pantalla no abriría nada — solo daría la impresión
 * de que sí.
 */

export const PERMISOS = [
  'VER_PANEL',
  'ALUMNOS',
  'COBRAR',
  'LOCKERS',
  'ASISTENCIA',
  'CONFIGURAR',
  'PRECIOS',
  'USUARIOS',
  'CONTRASENAS',
] as const

export type Permiso = (typeof PERMISOS)[number]

/** Cómo se lee cada permiso en la pantalla, y qué abre de verdad. */
export const DESCRIPCION_PERMISO: Record<Permiso, { titulo: string; detalle: string }> = {
  VER_PANEL: { titulo: 'Entrar al panel', detalle: 'Ver la cobranza del mes.' },
  ALUMNOS: { titulo: 'Alumnos', detalle: 'Dar de alta, editar y dar de baja alumnos.' },
  COBRAR: { titulo: 'Cobrar', detalle: 'Registrar pagos y validar comprobantes.' },
  LOCKERS: { titulo: 'Lockers', detalle: 'Asignar y liberar lockers.' },
  ASISTENCIA: { titulo: 'Asistencia', detalle: 'Escanear el QR y pasar lista.' },
  CONFIGURAR: { titulo: 'Configurar la escuela', detalle: 'Cursos, horarios, días y calendario.' },
  PRECIOS: { titulo: 'Mover precios', detalle: 'Costos, descuentos y comisiones.' },
  USUARIOS: { titulo: 'Usuarios y roles', detalle: 'Dar de alta personal y definir roles.' },
  CONTRASENAS: { titulo: 'Cambiar contraseñas', detalle: 'Cambiarle la contraseña a otra persona.' },
}

const CONOCIDOS = new Set<string>(PERMISOS)

export const esPermiso = (valor: string): valor is Permiso => CONOCIDOS.has(valor)

/**
 * Limpia lo que venga de la base.
 *
 * Falla cerrado: un permiso escrito mal —o uno que se quitó del código— se
 * descarta en vez de abrir algo que ya nadie protege.
 */
export function permisosDe(guardados: string[] | null | undefined): Permiso[] {
  return [...new Set(guardados ?? [])].filter(esPermiso)
}

type ConRol = {
  email: string
  rol: { permisos: string[]; activo: boolean } | null
}

/**
 * ¿Puede esta persona hacer esto?
 *
 * Root puede todo, siempre, aunque su rol no tenga nada marcado. Es la red
 * de seguridad: alguien puede editar un rol y quitarse sin querer el permiso
 * de usuarios, y entonces nadie podría entrar a deshacerlo. Eso no se
 * recupera desde la aplicación.
 */
export function tienePermiso(
  usuario: ConRol | null | undefined,
  permiso: Permiso,
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  if (!usuario) return false
  if (esRoot(usuario, rootEmail)) return true
  // Un rol apagado no es un rol con menos permisos: es ninguno.
  if (!usuario.rol || !usuario.rol.activo) return false
  return permisosDe(usuario.rol.permisos).includes(permiso)
}

/**
 * ¿Puede darle estos permisos a un rol?
 *
 * Nadie regala una llave que no tiene. Sin esta regla, un encargado de
 * usuarios se crearía un rol con todo y se lo pondría a sí mismo — que es
 * multiplicarse hacia arriba sin que nadie lo autorice.
 */
export function puedeOtorgar(
  actor: ConRol | null | undefined,
  permisos: string[],
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  if (!actor) return false
  if (esRoot(actor, rootEmail)) return true
  return permisosDe(permisos).every((p) => tienePermiso(actor, p, rootEmail))
}

/**
 * Quién entra al Panel de control.
 *
 * Es el permiso de configurar, no un rol con cierto nombre: un rol nuevo
 * que lo tenga entra igual, que es justo para lo que se crean.
 */
export function esAdministrativo(
  usuario: ConRol | null | undefined,
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  return tienePermiso(usuario, 'CONFIGURAR', rootEmail)
}

/**
 * ¿Ve las listas de todos los grupos, o solo las suyas?
 *
 * El profesor pasa lista de lo que imparte. Quien además da de alta alumnos
 * —Administrador y Root— está del otro lado del mostrador: mira cualquier
 * grupo para saber si la lista se está llevando.
 */
export function supervisaListas(
  usuario: ConRol | null | undefined,
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  return (
    tienePermiso(usuario, 'ALUMNOS', rootEmail) && tienePermiso(usuario, 'ASISTENCIA', rootEmail)
  )
}

/**
 * ¿Puede marcar o desmarcar una asistencia de ese mes?
 *
 * Tres respuestas distintas para la misma lista:
 *
 * - El profesor la lleva: tiene todo el mes que corre para corregirla. Ya
 *   cerrado, queda como quedó; una asistencia que se mueve en marzo no
 *   prueba nada de enero.
 * - Root corrige cualquier mes. Es el único, y a propósito: un error viejo
 *   tiene que poder repararse por alguien, pero por uno solo.
 * - El Administrador ve y no toca. Si pudiera, "quién marcó esto" dejaría de
 *   tener respuesta, que es justo lo que la lista sirve para contestar.
 */
export function puedeMoverAsistencia(
  usuario: ConRol | null | undefined,
  anio: number,
  mes: number,
  hoy: { anio: number; mes: number },
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  if (!tienePermiso(usuario, 'ASISTENCIA', rootEmail)) return false
  if (esRoot(usuario, rootEmail)) return true
  if (supervisaListas(usuario, rootEmail)) return false
  return anio === hoy.anio && mes === hoy.mes
}

/**
 * ¿Esa clase ya ocurrió?
 *
 * Una clase que todavía no se da no se puede palomear: nadie pudo haber
 * asistido. Antes no hacía falta preguntarlo —la lista iba por mes y el
 * profesor solo alcanzaba el que corre—, pero con un tramo de fechas se
 * puede pedir diciembre y palomear un mes entero de clases que no se han
 * dado.
 *
 * Las dos fechas van como "2026-09-15": en ese orden, comparar cadenas es
 * comparar calendario.
 */
export function claseYaOcurrio(dia: string, hoy: string): boolean {
  if (!dia) return false
  return dia <= hoy
}
