export type Descuento = { tipo: 'PORCENTAJE' | 'MONTO_FIJO'; valor: number }

export type EntradaCargo = {
  tarifa: number
  lockers: number
  precioLocker: number
  descuento?: Descuento | null
  recargo?: number
}

export type ResultadoCargo = {
  montoMensualidad: number
  montoLockers: number
  montoDescuento: number
  montoRecargo: number
  montoNeto: number
}

/** Todos los montos van en centavos: el dinero nunca se calcula con flotantes. */
export function calcularCargo(entrada: EntradaCargo): ResultadoCargo {
  const montoMensualidad = entrada.tarifa
  const montoLockers = entrada.lockers * entrada.precioLocker
  const montoRecargo = entrada.recargo ?? 0

  let montoDescuento = 0
  if (entrada.descuento) {
    montoDescuento =
      entrada.descuento.tipo === 'PORCENTAJE'
        ? Math.round((montoMensualidad * entrada.descuento.valor) / 100)
        : entrada.descuento.valor
    // El descuento aplica solo a la mensualidad y nunca la vuelve negativa.
    montoDescuento = Math.min(montoDescuento, montoMensualidad)
  }

  return {
    montoMensualidad,
    montoLockers,
    montoDescuento,
    montoRecargo,
    montoNeto: montoMensualidad - montoDescuento + montoLockers + montoRecargo,
  }
}

/**
 * ¿A este alumno le toca recargo por el mes que se está revisando?
 *
 * Al que ya venía de antes, sí: tuvo el mes entero para pagar. Al que se dio
 * de alta dentro de ese mismo mes, no. Si lo capturan el 28 de septiembre, el
 * 5.º día hábil quedó atrás semanas antes de que existiera su cargo, y
 * sumarle recargo sería multarlo por haberse inscrito tarde.
 *
 * Se compara contra el primer día del mes, no contra la fecha límite: lo que
 * decide no es si alcanzó a pagar, sino si ya era alumno cuando el mes
 * empezó a correr.
 */
export function leTocaRecargo(entrada: {
  altaDeLaInscripcion: Date
  anio: number
  mes: number
}): boolean {
  const primerDia = new Date(entrada.anio, entrada.mes - 1, 1, 0, 0, 0)
  return entrada.altaDeLaInscripcion < primerDia
}

/**
 * ¿Hay un mes anterior sin saldar? Devuelve cuál, o nada si se puede cobrar.
 *
 * Los meses se pagan en orden. No se puede dejar cubierto diciembre debiendo
 * octubre: un alumno con huecos a la mitad del año se vuelve imposible de
 * explicar en el mostrador —¿está al corriente o no?— y el recargo de los
 * meses salteados se queda colgando sin que nadie lo note hasta el corte.
 *
 * Se devuelve el mes que falta, no un simple sí o no, para que el aviso
 * pueda nombrarlo: "salda octubre primero" le dice a quien atiende qué
 * hacer; "no se puede" lo deja adivinando.
 *
 * Un mes sin cargos no detiene a nadie. Pasa cuando el curso está fuera de
 * temporada o cuando todavía no corre la cobranza: ahí no se debe nada, y
 * trabar el resto por un mes que quizá nunca genere cargo dejaría al alumno
 * sin poder pagar lo que sí debe.
 */
export function faltaUnMesAntes(
  meses: Array<{ mes: number; cargos: Array<{ cubierto: boolean }> }>,
  mes: number,
): number | null {
  const pendientes = meses
    .filter((m) => m.mes < mes && m.cargos.some((c) => !c.cubierto))
    .map((m) => m.mes)

  // El más viejo: si se saltaron dos, hay que empezar por el de arriba.
  return pendientes.length === 0 ? null : Math.min(...pendientes)
}

/**
 * ¿Ese mes le da derecho a clase?
 *
 * Solo si está pagado. La credencial vale porque hay un cobro cubierto
 * detrás: sin esta regla, alguien podría llevar medio año viniendo con una
 * credencial que nadie cobró, y la lista diría que estuvo mientras la caja
 * dice que no debe nada.
 *
 * Falla cerrado. Un mes sin cargo generado no está cubierto: no hay nada que
 * se haya pagado. Y quien lleva dos cursos debe dos cargos el mismo mes —
 * pagar uno no le abre la clase del otro.
 *
 * Los cancelados no son deuda: son cobros que se deshicieron, y no estorban
 * al mes que sí se pagó.
 */
export function mesCubierto(
  cargos: Array<{ mes: string; estado: string }>,
  mes: string,
): boolean {
  const delMes = cargos.filter((c) => c.mes === mes && c.estado !== 'CANCELADO')
  if (delMes.length === 0) return false
  return delMes.every((c) => c.estado === 'PAGADO')
}

/**
 * Lo mismo que `faltaUnMesAntes`, pero con el año a cuestas.
 *
 * La pantalla de pago en línea enseña todos los meses de todos los años, y
 * ahí el número de mes solo ya no ordena: enero de 2027 va después de
 * diciembre de 2026. Las claves vienen como "2026-12", que en texto se
 * comparan en orden de calendario.
 *
 * Devuelve el periodo más viejo que sigue debiendo, o `null` si ese ya se
 * puede pagar.
 */
export function faltaUnPeriodoAntes(
  periodos: Array<{ clave: string; cubierto: boolean }>,
  clave: string,
): string | null {
  const pendientes = periodos
    .filter((p) => p.clave < clave && !p.cubierto)
    .map((p) => p.clave)
    .sort()
  return pendientes[0] ?? null
}
