import { randomBytes } from 'node:crypto'

export function formatearFolio(anio: number, consecutivo: number): string {
  return `CRM-${anio}-${String(consecutivo).padStart(4, '0')}`
}

/**
 * Token aleatorio, nunca derivado del folio: el folio es adivinable y
 * cualquiera podría cambiar un dígito para abrir el estado de cuenta ajeno.
 */
export function generarTokenQR(): string {
  return randomBytes(32).toString('base64url')
}
