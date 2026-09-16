import { describe, it, expect } from 'vitest'
import {
  normalizarRfc,
  validarRfc,
  validarDatosFactura,
  validarConstancia,
  REGIMENES_FISCALES,
  USO_CFDI,
  MAXIMO_CONSTANCIA,
  validarCorreoFactura,
} from '@/lib/facturacion'

const BIEN = {
  rfc: 'PECF870115H23',
  razonSocial: 'Francisco Pech',
  codigoPostal: '77500',
  regimenFiscal: '605',
  usoCfdi: 'D04',
}

describe('normalizarRfc', () => {
  it('sube a mayúsculas y quita espacios, guiones y puntos', () => {
    expect(normalizarRfc(' pecf-870115.h23 ')).toBe('PECF870115H23')
  })
  it('deja en blanco lo que llega en blanco', () => {
    expect(normalizarRfc('   ')).toBe('')
  })
})

describe('validarRfc', () => {
  it('acepta el de una persona física, de trece', () => {
    expect(validarRfc('PECF870115H23')).toBeNull()
  })
  it('acepta el de una empresa, de doce', () => {
    expect(validarRfc('CRM950101AB1')).toBeNull()
  })
  it('acepta la Ñ y el & que el SAT permite', () => {
    expect(validarRfc('ÑA&M870115H23')).toBeNull()
  })
  it('rechaza el que no llega al largo', () => {
    expect(validarRfc('PECF8701')).toMatch(/RFC/i)
  })
  it('rechaza el que trae la fecha imposible', () => {
    // Mes 13: es un dedazo, no un RFC.
    expect(validarRfc('PECF871315H23')).toMatch(/fecha/i)
    expect(validarRfc('PECF870132H23')).toMatch(/fecha/i)
  })
  it('rechaza el vacío diciendo que falta', () => {
    expect(validarRfc('')).toMatch(/falta/i)
  })
})

describe('validarDatosFactura', () => {
  it('acepta los datos completos', () => {
    expect(validarDatosFactura(BIEN)).toBeNull()
  })

  it('exige la razón social', () => {
    expect(validarDatosFactura({ ...BIEN, razonSocial: '  ' })).toMatch(/razón social/i)
  })

  it('exige un código postal de cinco dígitos', () => {
    expect(validarDatosFactura({ ...BIEN, codigoPostal: '775' })).toMatch(/postal/i)
    expect(validarDatosFactura({ ...BIEN, codigoPostal: 'abcde' })).toMatch(/postal/i)
    expect(validarDatosFactura({ ...BIEN, codigoPostal: '77500' })).toBeNull()
  })

  it('exige un régimen fiscal de la lista del SAT', () => {
    expect(validarDatosFactura({ ...BIEN, regimenFiscal: '999' })).toMatch(/régimen/i)
    expect(validarDatosFactura({ ...BIEN, regimenFiscal: '' })).toMatch(/régimen/i)
  })

  it('solo acepta Donativos como uso del CFDI', () => {
    // La delegación es donataria autorizada: todo lo que factura sale con
    // esa clave. Cualquier otra es un CFDI que el SAT va a rechazar.
    expect(USO_CFDI.clave).toBe('D04')
    expect(validarDatosFactura({ ...BIEN, usoCfdi: 'D04' })).toBeNull()
    expect(validarDatosFactura({ ...BIEN, usoCfdi: 'G03' })).toMatch(/Donativos/i)
    expect(validarDatosFactura({ ...BIEN, usoCfdi: '' })).toMatch(/Donativos/i)
  })

  it('el catálogo de regímenes trae los de persona física y moral', () => {
    // Llegan los dos: un papá que deduce y una empresa que paga la clase
    // de su personal.
    expect(REGIMENES_FISCALES.map((r) => r.clave)).toContain('605')
    expect(REGIMENES_FISCALES.map((r) => r.clave)).toContain('601')
  })
})

describe('validarConstancia', () => {
  it('deja pasar que no manden nada: es opcional', () => {
    expect(validarConstancia(null)).toBeNull()
  })

  it('acepta un PDF de tamaño normal', () => {
    expect(validarConstancia({ tipo: 'application/pdf', tamano: 300_000 })).toBeNull()
  })

  it('rechaza lo que no es PDF', () => {
    expect(validarConstancia({ tipo: 'image/jpeg', tamano: 300_000 })).toMatch(/PDF/i)
  })

  it('rechaza el que no cabe', () => {
    expect(validarConstancia({ tipo: 'application/pdf', tamano: MAXIMO_CONSTANCIA + 1 }))
      .toMatch(/pesa/i)
  })

  it('rechaza el archivo vacío', () => {
    expect(validarConstancia({ tipo: 'application/pdf', tamano: 0 })).toMatch(/vacío/i)
  })
})

describe('validarCorreoFactura — a dónde llega el CFDI', () => {
  it('vacío está bien: no bloquea el cobro', () => {
    // La delegación no manda la factura desde aquí. Exigirlo dejaría sin
    // inscribir a quien llega sin correo a la mano.
    expect(validarCorreoFactura('')).toBeNull()
    expect(validarCorreoFactura('   ')).toBeNull()
  })

  it('acepta un correo normal', () => {
    expect(validarCorreoFactura('ana@ejemplo.mx')).toBeNull()
    expect(validarCorreoFactura('ana.sofia+facturas@correo.com.mx')).toBeNull()
  })

  it('rechaza lo que no es un correo', () => {
    // Un correo mal escrito no se nota hasta que el CFDI rebota, y para
    // entonces ya se timbró.
    expect(validarCorreoFactura('ana')).toMatch(/correo/i)
    expect(validarCorreoFactura('ana@')).toMatch(/correo/i)
    expect(validarCorreoFactura('@ejemplo.mx')).toMatch(/correo/i)
    expect(validarCorreoFactura('ana ejemplo.mx')).toMatch(/correo/i)
    expect(validarCorreoFactura('ana@ejemplo')).toMatch(/correo/i)
  })

  it('rechaza uno con espacios en medio, aunque traiga arroba y punto', () => {
    expect(validarCorreoFactura('ana @ejemplo.mx')).toMatch(/correo/i)
  })
})
