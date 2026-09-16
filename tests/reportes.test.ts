import { describe, it, expect } from 'vitest'
import { validarReporte, telefonoCompleto } from '@/lib/reportes'

/**
 * Lo que alguien escribe cuando el pago le falló.
 *
 * Existe para que la delegación pueda devolverle la llamada, así que lo que
 * importa es que el teléfono y el correo sirvan: un reporte sin forma de
 * contestar es un reporte perdido.
 */
const bueno = {
  nombre: 'María Pérez',
  correo: 'maria@ejemplo.test',
  lada: '52',
  telefono: '9981234567',
  mensaje: 'Pagué con tarjeta y me marcó error, pero el banco ya me cobró.',
}

describe('validarReporte', () => {
  it('uno completo pasa', () => {
    expect(validarReporte(bueno)).toBeNull()
  })

  it('sin nombre no: hay que saber a quién se le habla', () => {
    expect(validarReporte({ ...bueno, nombre: '  ' })).toMatch(/nombre/i)
  })

  it('el correo tiene que parecer un correo', () => {
    expect(validarReporte({ ...bueno, correo: 'maria arroba ejemplo' })).toMatch(/correo/i)
    expect(validarReporte({ ...bueno, correo: '' })).toMatch(/correo/i)
  })

  it('el celular son diez dígitos en México', () => {
    expect(validarReporte({ ...bueno, telefono: '998123' })).toMatch(/diez|10/i)
    expect(validarReporte({ ...bueno, telefono: '' })).toMatch(/celular|teléfono/i)
  })

  it('el celular se acepta como la gente lo escribe', () => {
    expect(validarReporte({ ...bueno, telefono: '998 123 45 67' })).toBeNull()
    expect(validarReporte({ ...bueno, telefono: '(998) 123-4567' })).toBeNull()
  })

  it('la lada son de uno a tres dígitos', () => {
    expect(validarReporte({ ...bueno, lada: '+52' })).toBeNull()
    expect(validarReporte({ ...bueno, lada: '12345' })).toMatch(/lada/i)
  })

  it('sin contar qué pasó no sirve de nada', () => {
    expect(validarReporte({ ...bueno, mensaje: '   ' })).toMatch(/qué pasó|mensaje/i)
  })
})

describe('telefonoCompleto — como se marca', () => {
  it('junta la lada y el número, ya limpios', () => {
    expect(telefonoCompleto('52', '998 123 45 67')).toBe('+52 9981234567')
  })

  it('no repite el más', () => {
    expect(telefonoCompleto('+52', '(998) 123-4567')).toBe('+52 9981234567')
  })
})
