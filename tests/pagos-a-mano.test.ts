import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MetodoPago } from '@prisma/client'
import {
  METODOS_PARA_ANOTAR, pideReferencia, loEscribioLaPasarela, sePuedeCorregir,
} from '@/lib/pagos-a-mano'

const aMano = { stripePaymentIntentId: null }
const dePasarela = { stripePaymentIntentId: 'pi_3QaBcD' }

describe('METODOS_PARA_ANOTAR — qué se puede escoger al cobrar', () => {
  it('están todas, sin distinción de rol', () => {
    // Cualquiera que pueda cobrar ve las cinco. Lo que da cuentas no es
    // esconder opciones, sino que cada pago diga quién lo marcó.
    expect([...METODOS_PARA_ANOTAR].sort()).toEqual(
      ['EFECTIVO', 'OXXO', 'SPEI', 'TARJETA', 'TRANSFERENCIA'],
    )
  })

  it('ninguna forma de pago nueva se queda fuera por descuido', () => {
    // Si mañana se agrega una al esquema, esta prueba se cae y obliga a
    // decidirlo a mano en vez de heredar el olvido.
    expect([...METODOS_PARA_ANOTAR].sort()).toEqual(Object.keys(MetodoPago).sort())
  })
})

describe('pideReferencia — dónde tiene sentido un folio', () => {
  it('efectivo y OXXO traen folio de ticket', () => {
    expect(pideReferencia(MetodoPago.EFECTIVO)).toBe(true)
    expect(pideReferencia(MetodoPago.OXXO)).toBe(true)
  })

  it('en los demás no se pregunta', () => {
    // El dato que importa ya viene en el comprobante; un campo de texto
    // libre al lado solo invita a escribir cualquier cosa.
    expect(pideReferencia(MetodoPago.TRANSFERENCIA)).toBe(false)
    expect(pideReferencia(MetodoPago.TARJETA)).toBe(false)
    expect(pideReferencia(MetodoPago.SPEI)).toBe(false)
  })
})

describe('loEscribioLaPasarela — quién es el dueño del renglón', () => {
  it('un pago con folio de Stripe lo escribió Stripe', () => {
    expect(loEscribioLaPasarela(dePasarela)).toBe(true)
  })

  it('uno capturado en el mostrador, no', () => {
    expect(loEscribioLaPasarela(aMano)).toBe(false)
  })

  it('lo que la pasarela comprobó no se corrige', () => {
    // Cambiarlo a mano pondría al sistema diciendo que un alumno pagó
    // cuando el banco dice que no, y eso no se nota hasta el corte.
    expect(sePuedeCorregir(dePasarela)).toBe(false)
    expect(sePuedeCorregir(aMano)).toBe(true)
  })
})

describe('las acciones del panel respetan las reglas', () => {
  const fuente = readFileSync('src/app/panel/alumnos/pagos-acciones.ts', 'utf8')

  it('borrar un pago no existe', () => {
    // No está permitido. Y no basta con quitarle el botón: mientras la
    // acción exista, sigue siendo una puerta abierta desde el navegador.
    expect(fuente).not.toContain('borrarPago')
    expect(fuente).not.toContain('pago.delete')
  })

  it('corregir pregunta si el cargo ya quedó cubierto', () => {
    const desde = fuente.indexOf('export async function corregirPago')
    expect(desde).toBeGreaterThan(-1)
    const cuerpo = fuente.slice(desde, fuente.indexOf('\n}', desde))
    expect(cuerpo).toContain('sePuedeCorregir')
    expect(cuerpo).toMatch(/cubierto|pagado/)
  })

  it('marcar pagado no se traba por el comprobante', () => {
    // Subirlo es opcional: quien paga en la ventanilla entrega el dinero en
    // la mano y no tiene nada que subir.
    const desde = fuente.indexOf('export async function marcarPagado')
    expect(desde).toBeGreaterThan(-1)
    const cuerpo = fuente.slice(desde, fuente.indexOf('\n}', desde))
    expect(cuerpo).not.toContain('comprobante')
  })

  it('el monto no se lee del formulario: sale de lo que falta', () => {
    // Si viajara en el formulario, cualquiera podría mandar otro número
    // desde el navegador y dejar el cargo pagado con un peso.
    expect(fuente).not.toContain("texto(datos, 'monto')")
  })

  it('cada pago dice quién lo marcó, o que entró en línea', () => {
    // Es lo que queda en lugar de esconderle opciones a nadie: si algo se
    // cobró mal, el renglón dice a quién preguntarle.
    expect(fuente).toContain('registradoPor')
    expect(fuente).toContain('loEscribioLaPasarela')
  })

  it('ninguna acción trae su propia lista paralela de métodos', () => {
    expect(fuente).not.toContain('MetodoPago.TARJETA')
    expect(fuente).not.toContain('stripePaymentIntentId:')
  })
})
