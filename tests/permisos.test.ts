import { describe, it, expect } from 'vitest'
import {
  PERMISOS, esPermiso, tienePermiso, puedeOtorgar, permisosDe,
  supervisaListas, puedeMoverAsistencia, claseYaOcurrio,
} from '@/lib/permisos'

const ROOT = 'root@ejemplo.test'
const rol = (permisos: string[]) => ({ permisos, activo: true })

const admin = { email: 'a@x.test', rol: rol(['CONFIGURAR', 'USUARIOS', 'VER_PANEL']) }
const capturista = { email: 'c@x.test', rol: rol(['VER_PANEL', 'COBRAR']) }
const profesor = { email: 'p@x.test', rol: rol(['ASISTENCIA']) }
const root = { email: ROOT, rol: rol([]) }

describe('tienePermiso', () => {
  it('deja pasar al que lo tiene', () => {
    expect(tienePermiso(capturista, 'COBRAR', ROOT)).toBe(true)
  })

  it('no deja pasar al que no lo tiene', () => {
    expect(tienePermiso(capturista, 'CONFIGURAR', ROOT)).toBe(false)
    expect(tienePermiso(profesor, 'VER_PANEL', ROOT)).toBe(false)
  })

  // Root es la red de seguridad. Si alguien edita un rol y se queda sin
  // USUARIOS, tiene que existir quien entre a arreglarlo: sin esto, el
  // sistema se puede dejar cerrado para siempre desde su propia pantalla.
  it('Root puede todo, aunque su rol no tenga nada', () => {
    for (const p of PERMISOS) expect(tienePermiso(root, p, ROOT)).toBe(true)
  })

  it('sin sesión no puede nada', () => {
    for (const p of PERMISOS) expect(tienePermiso(null, p, ROOT)).toBe(false)
  })

  // Un rol apagado no es un rol con menos permisos: es ninguno.
  it('un rol desactivado no da permisos', () => {
    const suspendido = { email: 'c@x.test', rol: { permisos: ['COBRAR'], activo: false } }
    expect(tienePermiso(suspendido, 'COBRAR', ROOT)).toBe(false)
  })

  // Falla cerrado: un permiso escrito mal en la base no debe abrir nada.
  it('un permiso desconocido no abre nada', () => {
    const raro = { email: 'c@x.test', rol: rol(['BORRAR_TODO']) }
    expect(tienePermiso(raro, 'COBRAR', ROOT)).toBe(false)
    expect(esPermiso('BORRAR_TODO')).toBe(false)
  })

  it('un usuario sin rol no puede nada', () => {
    expect(tienePermiso({ email: 'x@x.test', rol: null }, 'COBRAR', ROOT)).toBe(false)
  })
})

describe('puedeOtorgar — quién puede crear a quién', () => {
  // La regla que evita que alguien se multiplique hacia arriba: nadie puede
  // regalar una llave que no tiene.
  it('nadie otorga un permiso que no tiene', () => {
    expect(puedeOtorgar(capturista, ['CONFIGURAR'], ROOT)).toBe(false)
    expect(puedeOtorgar(admin, ['PRECIOS'], ROOT)).toBe(false)
  })

  it('sí otorga los que sí tiene', () => {
    expect(puedeOtorgar(admin, ['VER_PANEL', 'USUARIOS'], ROOT)).toBe(true)
    expect(puedeOtorgar(capturista, ['COBRAR'], ROOT)).toBe(true)
  })

  it('Root otorga cualquiera', () => {
    expect(puedeOtorgar(root, [...PERMISOS], ROOT)).toBe(true)
  })

  it('un rol sin permisos lo puede crear cualquiera', () => {
    expect(puedeOtorgar(capturista, [], ROOT)).toBe(true)
  })
})

describe('permisosDe — limpia lo que venga de la base', () => {
  it('descarta los que no existen y no repite', () => {
    expect(permisosDe(['COBRAR', 'INVENTADO', 'COBRAR'])).toEqual(['COBRAR'])
  })

  it('con nada devuelve nada', () => {
    expect(permisosDe(null)).toEqual([])
  })
})

// --------------------------------------------------- las listas de asistencia
//
// Tres personas miran la misma lista y no pueden lo mismo. El profesor la
// lleva: pasa lista todo el mes que corre. Root la revisa y corrige, incluso
// meses cerrados, porque es el único que puede reparar un error viejo. El
// Administrador la ve para saber si está bien, y no la toca: si pudiera,
// "quién marcó esta asistencia" dejaría de tener respuesta.

describe('supervisaListas — quién ve los grupos de todos', () => {
  const supervisor = { email: 's@x.test', rol: rol(['ALUMNOS', 'ASISTENCIA']) }

  it('el que da de alta y pasa lista ve todos los grupos', () => {
    expect(supervisaListas(supervisor, ROOT)).toBe(true)
    expect(supervisaListas(root, ROOT)).toBe(true)
  })

  it('el profesor solo ve los suyos', () => {
    expect(supervisaListas(profesor, ROOT)).toBe(false)
  })

  it('quien no pasa lista no supervisa nada', () => {
    expect(supervisaListas(capturista, ROOT)).toBe(false)
    expect(supervisaListas(null, ROOT)).toBe(false)
  })
})

describe('puedeMoverAsistencia — quién marca y desmarca', () => {
  const HOY = { anio: 2026, mes: 9 }
  const supervisor = { email: 's@x.test', rol: rol(['ALUMNOS', 'ASISTENCIA']) }

  it('el profesor tiene todo el mes que corre', () => {
    expect(puedeMoverAsistencia(profesor, 2026, 9, HOY, ROOT)).toBe(true)
  })

  it('al profesor un mes cerrado ya no se le abre', () => {
    expect(puedeMoverAsistencia(profesor, 2026, 8, HOY, ROOT)).toBe(false)
    expect(puedeMoverAsistencia(profesor, 2025, 9, HOY, ROOT)).toBe(false)
  })

  it('Root corrige cualquier mes, abierto o cerrado', () => {
    expect(puedeMoverAsistencia(root, 2026, 9, HOY, ROOT)).toBe(true)
    expect(puedeMoverAsistencia(root, 2026, 8, HOY, ROOT)).toBe(true)
    expect(puedeMoverAsistencia(root, 2024, 2, HOY, ROOT)).toBe(true)
  })

  it('el Administrador mira y no toca, ni siquiera el mes que corre', () => {
    expect(puedeMoverAsistencia(supervisor, 2026, 9, HOY, ROOT)).toBe(false)
    expect(puedeMoverAsistencia(supervisor, 2026, 8, HOY, ROOT)).toBe(false)
  })

  it('quien no pasa lista no mueve ninguna', () => {
    expect(puedeMoverAsistencia(capturista, 2026, 9, HOY, ROOT)).toBe(false)
    expect(puedeMoverAsistencia(null, 2026, 9, HOY, ROOT)).toBe(false)
  })
})

// Una clase que todavía no ocurre no se marca: nadie pudo haber asistido.
// Sin esto, el rango de fechas deja abrir diciembre y palomear un mes
// entero de clases que no se han dado.

describe('claseYaOcurrio — no se pasa lista del futuro', () => {
  const HOY = '2026-09-15'

  it('la de hoy sí se puede marcar: la clase ya se dio', () => {
    expect(claseYaOcurrio('2026-09-15', HOY)).toBe(true)
  })

  it('las de antes también', () => {
    expect(claseYaOcurrio('2026-09-14', HOY)).toBe(true)
    expect(claseYaOcurrio('2025-12-31', HOY)).toBe(true)
  })

  it('la de mañana no', () => {
    expect(claseYaOcurrio('2026-09-16', HOY)).toBe(false)
    expect(claseYaOcurrio('2027-01-04', HOY)).toBe(false)
  })

  it('una fecha vacía no cuenta como ocurrida', () => {
    expect(claseYaOcurrio('', HOY)).toBe(false)
  })
})
