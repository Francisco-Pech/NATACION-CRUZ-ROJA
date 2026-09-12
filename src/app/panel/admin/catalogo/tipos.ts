/** Lo que la pantalla necesita para avisar si salió bien o no. */
export type Resultado = { ok: boolean; mensaje: string } | null

/** Una acción de formulario con estado, como las espera `useActionState`. */
export type AccionCatalogo = (previo: Resultado, datos: FormData) => Promise<Resultado>

export type Campo = {
  nombre: string
  etiqueta: string
  tipo: 'texto' | 'numero' | 'hora' | 'casilla' | 'fecha' | 'lista' | 'oculto'
  /** Ancho de la columna en la tabla, en píxeles. */
  ancho?: number
  placeholder?: string
  min?: number
  max?: number
  /**
   * Se escribe al crear y ya no se toca. La clave de un catálogo es lo que
   * sostiene al seeder y a la lógica: si se pudiera editar, renombrarla
   * desde el panel dejaría huérfano a todo lo que la nombra.
   */
  fijo?: boolean
  /** No se exige: se puede dejar en blanco al crear y al editar. */
  opcional?: boolean
  /**
   * Con qué llega el campo al formulario de alta. Para lo que casi siempre
   * vale lo mismo: se deja escrito y solo se cambia cuando toca.
   */
  predeterminado?: string | number
  /** Para `tipo: 'lista'`: lo que se puede escoger. */
  opciones?: Array<{ valor: string; etiqueta: string }>
  /** Para `tipo: 'oculto'`: el valor que viaja sin que nadie lo vea ni lo toque. */
  valorFijo?: string
  /**
   * Se pregunta al dar de alta y no ocupa columna en la tabla. Para lo que
   * se decide al crear pero se administra en otro lado.
   */
  soloAlta?: boolean
}

/**
 * Un filtro de la barra de la tabla.
 *
 * Arranca sin nada escogido, y así deja pasar todo: un filtro que ya viene
 * puesto esconde renglones sin que nadie se lo haya pedido, y quien abre la
 * pantalla cree que esos renglones no existen.
 */
export type Filtro = {
  nombre: string
  etiqueta: string
  opciones: Array<{ valor: string; etiqueta: string }>
}

/**
 * Un renglón listo para pintarse. `hash` es el identificador público: el id
 * de la base no sale nunca de aquí.
 */
export type Renglon = {
  hash: string
  valores: Record<string, string | number | boolean>
  /** Sin permiso de borrar —o con el renglón en uso— el botón solo apaga. */
  soloDesactivar: boolean
  /**
   * Un dato calculado que acompaña al renglón sin ocupar columna: se
   * asoma en un `?` al pasar el mouse. Para lo que sirve saber pero no
   * vale ensanchar la tabla.
   */
  ayuda?: string
  /**
   * Contra qué se compara cada filtro. No se pinta: sirve para filtrar por
   * cosas que el renglón no muestra como columna —el día, la hora, el
   * curso— cuando lo que enseña es otra cosa.
   */
  filtros?: Record<string, string>
}
