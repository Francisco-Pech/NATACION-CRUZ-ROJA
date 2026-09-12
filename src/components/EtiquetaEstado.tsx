import { colorDeEstado, ETIQUETA_ESTADO } from '@/lib/servicios/estado-cuenta'
import type { EstadoCargo } from '@prisma/client'

export function EtiquetaEstado({ estado }: { estado: EstadoCargo }) {
  return <span className={`insignia ${colorDeEstado(estado)}`}>{ETIQUETA_ESTADO[estado]}</span>
}
