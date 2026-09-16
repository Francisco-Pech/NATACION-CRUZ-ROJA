import { describe, it, expect } from 'vitest'
import { metodosDisponibles, cuandoSeRefleja, sePuedePagarEnLinea } from '@/lib/metodos-pago'

const LIMITE = new Date('2026-03-06T23:59:59')

const CONFIGS = [
  { metodo: 'EFECTIVO' as const, porcentaje: 0, montoFijo: 0, iva: 0.16, activo: true, diasCorteAntesDeVencimiento: 0 },
  { metodo: 'TRANSFERENCIA' as const, porcentaje: 0, montoFijo: 0, iva: 0.16, activo: true, diasCorteAntesDeVencimiento: 0 },
  { metodo: 'TARJETA' as const, porcentaje: 0.036, montoFijo: 300, iva: 0.16, activo: true, diasCorteAntesDeVencimiento: 0 },
  { metodo: 'SPEI' as const, porcentaje: 0.036, montoFijo: 300, iva: 0.16, activo: true, diasCorteAntesDeVencimiento: 0 },
  { metodo: 'OXXO' as const, porcentaje: 0.036, montoFijo: 1200, iva: 0.16, activo: true, diasCorteAntesDeVencimiento: 3 },
]

const nombres = (fecha: Date) => metodosDisponibles(CONFIGS, LIMITE, fecha).map((m) => m.metodo)

describe('metodosDisponibles', () => {
  it('ofrece OXXO con holgura suficiente antes del vencimiento', () => {
    expect(nombres(new Date('2026-03-01T10:00:00'))).toContain('OXXO')
  })

  it('retira OXXO dentro de los 3 días previos al vencimiento', () => {
    // Pagar en OXXO el día 4 no alcanza a reflejarse para el límite del 6.
    expect(nombres(new Date('2026-03-04T10:00:00'))).not.toContain('OXXO')
    expect(nombres(new Date('2026-03-06T10:00:00'))).not.toContain('OXXO')
  })

  it('vuelve a ofrecer OXXO una vez vencido: ya no hay plazo que perder', () => {
    expect(nombres(new Date('2026-03-10T10:00:00'))).toContain('OXXO')
  })

  it('nunca retira tarjeta ni SPEI, que confirman al instante', () => {
    for (const dia of ['2026-03-01', '2026-03-04', '2026-03-06', '2026-03-10']) {
      const m = nombres(new Date(`${dia}T10:00:00`))
      expect(m).toContain('TARJETA')
      expect(m).toContain('SPEI')
    }
  })

  it('omite los métodos desactivados', () => {
    const sinTarjeta = CONFIGS.map((c) => (c.metodo === 'TARJETA' ? { ...c, activo: false } : c))
    const m = metodosDisponibles(sinTarjeta, LIMITE, new Date('2026-03-01T10:00:00')).map((x) => x.metodo)
    expect(m).not.toContain('TARJETA')
  })

  it('marca cuáles son en línea y cuáles se pagan en persona', () => {
    const todos = metodosDisponibles(CONFIGS, LIMITE, new Date('2026-03-01T10:00:00'))
    const enLinea = todos.filter((m) => m.enLinea).map((m) => m.metodo)
    expect(enLinea.sort()).toEqual(['OXXO', 'SPEI', 'TARJETA'])
  })
})

// ------------------------------------------------- cuándo se ve el dinero
//
// Quien paga se queda mirando la pantalla esperando que su mes cambie a
// pagado. Con tarjeta pasa enseguida; con transferencia y con OXXO no, y sin
// decírselo antes la conclusión es que el pago falló — y vuelve a pagar.

describe('cuandoSeRefleja', () => {
  it('la tarjeta es inmediata', () => {
    expect(cuandoSeRefleja('TARJETA')).toMatch(/al momento|inmediat/i)
  })

  it('la transferencia habla de horas y de un día hábil', () => {
    const texto = cuandoSeRefleja('SPEI')
    expect(texto).toMatch(/hora/i)
    expect(texto).toMatch(/día hábil/i)
  })

  it('OXXO, de uno a tres días hábiles', () => {
    expect(cuandoSeRefleja('OXXO')).toMatch(/1 a 3 días hábiles/i)
  })

  // En la ventanilla el recibo se da en el momento: no hay nada que esperar.
  it('lo que se cobra en persona no tiene espera', () => {
    expect(cuandoSeRefleja('EFECTIVO')).toBeNull()
  })
})

// ------------------------------------------- hasta cuándo se cobra en línea
//
// El mes se paga dentro de sus cinco días hábiles. Pasada esa fecha deja de
// cobrarse por la pantalla: quien se atrasó tiene que pasar a la delegación,
// donde se le calcula el recargo y se le cobra en la ventanilla.
//
// La fecha límite viene al final del día —23:59:59— así que el quinto día
// hábil cuenta completo: quien paga a las once de la noche llegó a tiempo.

describe('sePuedePagarEnLinea', () => {
  const LIMITE = new Date('2026-11-06T23:59:59.999')

  it('días antes, sí', () => {
    expect(sePuedePagarEnLinea(LIMITE, new Date('2026-11-02T10:00:00'))).toBe(true)
  })

  it('el mismo día límite, aunque sea de noche, sí', () => {
    expect(sePuedePagarEnLinea(LIMITE, new Date('2026-11-06T23:00:00'))).toBe(true)
  })

  it('un segundo después, ya no', () => {
    expect(sePuedePagarEnLinea(LIMITE, new Date('2026-11-07T00:00:01'))).toBe(false)
  })

  it('un mes vencido hace rato, tampoco', () => {
    expect(sePuedePagarEnLinea(LIMITE, new Date('2026-12-20T09:00:00'))).toBe(false)
  })

  // Adelantar sigue valiendo: el mes que entra tiene su límite por delante.
  it('un mes que ni ha empezado, sí', () => {
    expect(sePuedePagarEnLinea(new Date('2026-12-07T23:59:59.999'), new Date('2026-11-20T09:00:00')))
      .toBe(true)
  })
})
