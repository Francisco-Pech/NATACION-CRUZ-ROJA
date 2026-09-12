import { describe, it, expect } from 'vitest'
import { comisionesDelEntorno, POR_OMISION } from '@/lib/comisiones'

describe('comisionesDelEntorno — lo que cobra Stripe', () => {
  it('sin nada configurado usa los valores de lista', () => {
    const c = comisionesDelEntorno({})
    expect(c.TARJETA.porcentaje).toBeCloseTo(0.036)
    expect(c.TARJETA.montoFijo).toBe(300)
    expect(c.OXXO.montoFijo).toBe(1200)
  })

  // Efectivo y transferencia no pasan por Stripe: no hay comisión que
  // cobrar, y no debe poder configurárseles una por error.
  it('efectivo y transferencia van siempre en cero', () => {
    const c = comisionesDelEntorno({
      COMISION_EFECTIVO_PORCENTAJE: '5',
      COMISION_TRANSFERENCIA_FIJA: '50',
    })
    expect(c.EFECTIVO.porcentaje).toBe(0)
    expect(c.EFECTIVO.montoFijo).toBe(0)
    expect(c.TRANSFERENCIA.porcentaje).toBe(0)
    expect(c.TRANSFERENCIA.montoFijo).toBe(0)
  })

  it('toma el porcentaje del entorno y lo guarda como fracción', () => {
    const c = comisionesDelEntorno({ COMISION_TARJETA_PORCENTAJE: '2.9' })
    expect(c.TARJETA.porcentaje).toBeCloseTo(0.029)
  })

  // Los pesos se capturan como se leen y se guardan en centavos, como todo
  // el dinero del sistema.
  it('toma el monto fijo en pesos y lo guarda en centavos', () => {
    const c = comisionesDelEntorno({ COMISION_OXXO_FIJA: '15.50' })
    expect(c.OXXO.montoFijo).toBe(1550)
  })

  it('toma el IVA del entorno', () => {
    expect(comisionesDelEntorno({ COMISION_IVA: '0' }).TARJETA.iva).toBe(0)
    expect(comisionesDelEntorno({}).TARJETA.iva).toBeCloseTo(0.16)
  })

  it('toma los días de corte de OXXO', () => {
    expect(comisionesDelEntorno({ COMISION_OXXO_DIAS_CORTE: '5' }).OXXO.diasCorteAntesDeVencimiento).toBe(5)
  })

  // Un valor mal escrito no debe volverse NaN y arrastrarse hasta un cobro:
  // se ignora y queda el de lista, que sí es un número.
  it('ignora un valor que no es número', () => {
    const c = comisionesDelEntorno({ COMISION_TARJETA_PORCENTAJE: 'tres punto seis' })
    expect(c.TARJETA.porcentaje).toBeCloseTo(POR_OMISION.TARJETA.porcentaje)
  })

  it('ignora un porcentaje negativo o imposible', () => {
    expect(comisionesDelEntorno({ COMISION_TARJETA_PORCENTAJE: '-5' }).TARJETA.porcentaje)
      .toBeCloseTo(POR_OMISION.TARJETA.porcentaje)
    expect(comisionesDelEntorno({ COMISION_TARJETA_PORCENTAJE: '150' }).TARJETA.porcentaje)
      .toBeCloseTo(POR_OMISION.TARJETA.porcentaje)
  })

  // Se conserva poder apagar un método, que antes se hacía con una casilla
  // en el panel. Sin esto, quitar la tabla habría quitado la capacidad.
  it('los cinco vienen activos', () => {
    const c = comisionesDelEntorno({})
    expect(Object.values(c).every((x) => x.activo)).toBe(true)
  })

  it('se puede apagar un método desde el entorno', () => {
    const c = comisionesDelEntorno({ COMISION_OXXO_ACTIVO: 'false' })
    expect(c.OXXO.activo).toBe(false)
    expect(c.TARJETA.activo).toBe(true)
  })

  it('trae los cinco métodos', () => {
    const c = comisionesDelEntorno({})
    expect(Object.keys(c).sort()).toEqual(
      ['EFECTIVO', 'OXXO', 'SPEI', 'TARJETA', 'TRANSFERENCIA'],
    )
  })
})
