import { describe, it, expect } from 'vitest'
import { validarComprobante, MAXIMO_COMPROBANTE, TIPOS_COMPROBANTE } from '@/lib/comprobante'

const archivo = (tipo: string, tamano = 1024) => ({ tipo, tamano })

describe('validarComprobante — la foto del ticket', () => {
  it('sin archivo está bien: subirlo es opcional', () => {
    // Un efectivo recibido en la mano no tiene comprobante que subir.
    expect(validarComprobante(null)).toBeNull()
  })

  it('acepta la foto que trae la gente en el teléfono', () => {
    expect(validarComprobante(archivo('image/jpeg'))).toBeNull()
    expect(validarComprobante(archivo('image/png'))).toBeNull()
    expect(validarComprobante(archivo('image/webp'))).toBeNull()
  })

  it('acepta también el PDF del banco', () => {
    expect(validarComprobante(archivo('application/pdf'))).toBeNull()
  })

  it('rechaza cualquier otra cosa', () => {
    // El archivo se sirve de vuelta al navegador: aceptar lo que sea
    // permitiría guardar un HTML con script y abrirlo desde el panel.
    expect(validarComprobante(archivo('text/html'))).toMatch(/foto|PDF/i)
    expect(validarComprobante(archivo('application/zip'))).toMatch(/foto|PDF/i)
  })

  it('rechaza el archivo vacío', () => {
    expect(validarComprobante(archivo('image/png', 0))).toMatch(/vac/i)
  })

  it('rechaza lo que pesa de más', () => {
    expect(validarComprobante(archivo('image/png', MAXIMO_COMPROBANTE + 1))).toMatch(/pesa/i)
    expect(validarComprobante(archivo('image/png', MAXIMO_COMPROBANTE))).toBeNull()
  })

  it('la lista de tipos no deja entrar nada ejecutable', () => {
    for (const tipo of TIPOS_COMPROBANTE) {
      expect(tipo).toMatch(/^(image\/|application\/pdf)/)
    }
  })
})
