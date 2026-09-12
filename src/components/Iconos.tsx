/**
 * Íconos en SVG, dibujados a mano y sin dependencias.
 *
 * El proyecto trae `@mui/icons-material`, pero estas pantallas son de CSS
 * plano: arrastrar la librería por unos cuantos botones costaría más de lo
 * que resuelve. Heredan el color del botón con `currentColor`, así que
 * sirven igual en el botón neutro y en el de peligro.
 */
type Props = { tamano?: number }

const base = (tamano: number) => ({
  width: tamano,
  height: tamano,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
})

/** Palomita: confirma lo que se escribió. */
export function IconoGuardar({ tamano = 16 }: Props) {
  return (
    <svg {...base(tamano)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** Símbolo de encendido: apagar algo que sigue existiendo. */
export function IconoDesactivar({ tamano = 16 }: Props) {
  return (
    <svg {...base(tamano)}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  )
}

/** Bote de basura: esto sí desaparece. */
export function IconoEliminar({ tamano = 16 }: Props) {
  return (
    <svg {...base(tamano)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

/** Chevron a la izquierda: la página anterior. */
export function IconoAnterior({ tamano = 14 }: Props) {
  return (
    <svg {...base(tamano)}>
      <polyline points="15 5 8 12 15 19" />
    </svg>
  )
}

/** Chevron a la derecha: la página siguiente. */
export function IconoSiguiente({ tamano = 14 }: Props) {
  return (
    <svg {...base(tamano)}>
      <polyline points="9 5 16 12 9 19" />
    </svg>
  )
}

/** Cuadrícula: el tablero. */
export function IconoTablero({ tamano = 18 }: Props) {
  return (
    <svg {...base(tamano)}>
      <rect x="3" y="3" width="7" height="8" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
    </svg>
  )
}

/** Dos personas: los alumnos. */
export function IconoAlumnos({ tamano = 18 }: Props) {
  return (
    <svg {...base(tamano)}>
      <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M20 20v-1.4a3.5 3.5 0 0 0-2.6-3.3" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
    </svg>
  )
}

/** Billete: la cobranza. */
export function IconoCobranza({ tamano = 18 }: Props) {
  return (
    <svg {...base(tamano)}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <line x1="6" y1="12" x2="6.01" y2="12" />
      <line x1="18" y1="12" x2="18.01" y2="12" />
    </svg>
  )
}

/** Casillero con su cerradura. */
export function IconoLockers({ tamano = 18 }: Props) {
  return (
    <svg {...base(tamano)}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="9" y1="7" x2="9" y2="8.5" />
      <line x1="9" y1="16" x2="9" y2="17.5" />
    </svg>
  )
}

/** Deslizadores: la configuración. */
export function IconoAjustes({ tamano = 18 }: Props) {
  return (
    <svg {...base(tamano)}>
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="15" cy="16" r="2.2" />
    </svg>
  )
}

/** Tres rayas: abrir el menú. */
export function IconoMenu({ tamano = 18 }: Props) {
  return (
    <svg {...base(tamano)}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}
