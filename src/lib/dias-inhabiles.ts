/**
 * El calendario de días que no se trabaja.
 *
 * Todo se guarda como rango —un solo día es un rango de un día— para que
 * capturar Semana Santa no sean siete renglones. Y cada renglón dice de qué
 * tipo es, porque no todos significan lo mismo para el cobro.
 */

/** Un solo día que se repite mucho: el mediodía, para que el huso no corra la fecha. */
const MEDIODIA = 12

/**
 * Los tipos que corren la fecha límite de pago.
 *
 * Solo el día inhábil. Un festivo oficial mueve el 5.º día hábil porque ese
 * día no hay quien cobre ni banco que reciba. Las vacaciones y las
 * excepciones no: la alberca cierra, pero la mensualidad se sigue cobrando
 * completa, tal como opera la delegación.
 */
export const MUEVE_LA_FECHA_LIMITE = ['DIA_INHABIL'] as const

/** Tope de seguridad: diez años de rango es más de lo que nadie captura. */
const MAXIMO_DIAS = 3660

/** Abre un rango en los días que contiene, extremos incluidos. */
export function diasDelRango(desde: Date, hasta: Date): Date[] {
  const dias: Date[] = []
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), MEDIODIA)
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), MEDIODIA)

  while (cursor <= fin && dias.length < MAXIMO_DIAS) {
    dias.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}

type Registro = { tipo: string; desde: Date; hasta: Date; cadaAnio?: boolean }

/**
 * Corre un rango al año que se pida, conservando día y mes.
 *
 * Si el rango original cruzaba el fin de año, la copia también lo cruza: un
 * descanso del 30 de diciembre al 2 de enero repetido en 2030 termina en
 * 2031, no vuelve atrás.
 */
function enElAnio(r: Registro, anio: number): { desde: Date; hasta: Date } {
  const aniosQueAbarca = r.hasta.getFullYear() - r.desde.getFullYear()
  return {
    desde: new Date(anio, r.desde.getMonth(), r.desde.getDate(), MEDIODIA),
    hasta: new Date(anio + aniosQueAbarca, r.hasta.getMonth(), r.hasta.getDate(), MEDIODIA),
  }
}

/**
 * De todo el calendario, los días sueltos que el cálculo de la fecha límite
 * del año `anio` tiene que descontar.
 *
 * Los marcados `cadaAnio` se corren al año que se pide: Navidad se captura
 * una vez y vale siempre. Los demás solo cuentan en el año en que están.
 *
 * Siempre devuelve días de `anio` y de ningún otro.
 */
export function festivosQueCuentan(registros: Registro[], anio: number): Date[] {
  return registros
    .filter((r) => (MUEVE_LA_FECHA_LIMITE as readonly string[]).includes(r.tipo))
    .flatMap((r) => {
      // Los que se repiten se prueban también contra el año anterior: un
      // descanso que arranca el 30 de diciembre deja cola en enero, y esa
      // cola es del año siguiente.
      const tramos = r.cadaAnio ? [enElAnio(r, anio - 1), enElAnio(r, anio)] : [r]
      return tramos.flatMap((t) => diasDelRango(t.desde, t.hasta))
    })
    .filter((d) => d.getFullYear() === anio)
}

const ES_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Lee una fecha de un campo `type="date"`. Devuelve `null` si no existe.
 *
 * JavaScript no avisa cuando el día no cabe en el mes: `new Date('2026-02-30')`
 * devuelve el 2 de marzo, calladito. Guardar eso como día inhábil correría
 * la fecha límite de pago al día equivocado y nadie se enteraría, así que
 * aquí se comprueba que la fecha leída sea la misma que se escribió.
 */
export function fechaDeTexto(valor: string): Date | null {
  const partes = ES_FECHA.exec(valor.trim())
  if (!partes) return null

  const [, anio, mes, dia] = partes.map(Number) as unknown as [string, number, number, number]
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null

  const fecha = new Date(anio, mes - 1, dia, MEDIODIA)
  // Si el día se desbordó al mes siguiente, la fecha no existía.
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null
  }
  return fecha
}

const LUNES = 1
const VIERNES = 5

/** Retrocede hasta el lunes de esa semana. Si ya es lunes, se queda. */
function lunesDeLaSemana(fecha: Date): Date {
  const d = new Date(fecha)
  const retroceso = (d.getDay() + 6) % 7 // domingo 0 → 6 días atrás
  d.setDate(d.getDate() - retroceso)
  return d
}

/**
 * Las vacaciones de fin de año de la delegación.
 *
 * Arrancan el lunes de la semana anterior a la de Navidad y terminan el
 * primer viernes después del 6 de enero. Se calculan y no se capturan a
 * mano porque caen distinto cada año: en 2026 Navidad es viernes y en 2028
 * es lunes, y la semana se recorre con ellas.
 *
 * Empieza en lunes y termina en viernes a propósito: así el descanso cubre
 * semanas completas de clase y nadie vuelve a media semana.
 */
export function vacacionesDeFinDeAnio(anio: number): { desde: Date; hasta: Date } {
  // El lunes de la semana de Navidad, y de ahí una semana más atrás.
  const desde = lunesDeLaSemana(new Date(anio, 11, 25, MEDIODIA))
  desde.setDate(desde.getDate() - 7)

  // El primer viernes pasado el 6 de enero: el 6 todavía es descanso.
  const hasta = new Date(anio + 1, 0, 7, MEDIODIA)
  while (hasta.getDay() !== VIERNES) hasta.setDate(hasta.getDate() + 1)

  return { desde, hasta }
}

/** Se exporta para que las pruebas nombren los días sin repetir números. */
export const DIAS_DE_LA_SEMANA = { LUNES, VIERNES }

/**
 * Qué tan listo está un año del calendario.
 *
 * Los de fecha fija se capturan una vez y valen siempre, así que no hay que
 * tocarlos nunca. Los que se mueven y los periodos vacacionales sí: cada
 * año caen distinto y alguien tiene que capturarlos. Esto es para avisarlo
 * antes de que llegue el año y la fecha límite de pago salga mal.
 */
export function coberturaDelAnio(
  registros: Registro[],
  anio: number,
): { fijos: number; movibles: number; periodos: number; completo: boolean } {
  const tocaElAnio = (r: Registro) =>
    r.desde.getFullYear() <= anio && r.hasta.getFullYear() >= anio

  const fijos = registros.filter((r) => r.cadaAnio).length
  const movibles = registros.filter(
    (r) => !r.cadaAnio && r.tipo === 'DIA_INHABIL' && tocaElAnio(r),
  ).length
  const periodos = registros.filter(
    (r) => r.tipo === 'PERIODO_VACACIONAL' && (r.cadaAnio || tocaElAnio(r)),
  ).length

  return { fijos, movibles, periodos, completo: movibles > 0 && periodos > 0 }
}

/**
 * Cuándo hay que recordarle a alguien que capture el calendario.
 *
 * Dos meses antes de que se acabe el año se avisa; en diciembre ya aprieta.
 * Y si el año que está corriendo está incompleto, se avisa siempre y fuerte:
 * ese ya está calculando mal la fecha límite de pago hoy.
 */
export function avisoDeCalendario(
  hoy: Date,
  esteAnio: { completo: boolean },
  elQueViene: { completo: boolean },
): { nivel: 'aviso' | 'urgente'; texto: string } | null {
  const anio = hoy.getFullYear()

  if (!esteAnio.completo) {
    return {
      nivel: 'urgente',
      texto: `Al calendario de ${anio} le faltan días. La fecha límite de pago se está calculando sin ellos.`,
    }
  }

  if (elQueViene.completo) return null

  const mes = hoy.getMonth() + 1
  if (mes === 12) {
    return {
      nivel: 'urgente',
      texto: `El año entra en unas semanas y ${anio + 1} todavía no tiene calendario.`,
    }
  }
  if (mes === 11) {
    return {
      nivel: 'aviso',
      texto: `Falta poco para ${anio + 1} y su calendario está vacío. Buen momento para capturarlo.`,
    }
  }
  return null
}
