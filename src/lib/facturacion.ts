/**
 * Los datos con los que se le factura a un alumno.
 *
 * Aquí no se emite ninguna factura: eso lo hace quien lleva la contabilidad
 * en el portal del SAT. Lo que hace falta es capturarlos bien, porque un
 * RFC mal tecleado se descubre hasta el día que la factura se rechaza, y
 * para entonces el alumno ya se fue.
 */

/**
 * Los regímenes fiscales del SAT (catálogo c_RegimenFiscal).
 *
 * Están los de persona física y los de persona moral: a la escuela llegan
 * los dos —un papá que deduce y una empresa que paga la clase de su
 * personal—. Las claves son del SAT y no se inventan.
 */
export const REGIMENES_FISCALES = [
  { clave: '601', nombre: 'General de Ley Personas Morales' },
  { clave: '603', nombre: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', nombre: 'Arrendamiento' },
  { clave: '607', nombre: 'Régimen de Enajenación o Adquisición de Bienes' },
  { clave: '608', nombre: 'Demás ingresos' },
  { clave: '610', nombre: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { clave: '611', nombre: 'Ingresos por Dividendos (socios y accionistas)' },
  { clave: '612', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '614', nombre: 'Ingresos por intereses' },
  { clave: '615', nombre: 'Régimen de los ingresos por obtención de premios' },
  { clave: '616', nombre: 'Sin obligaciones fiscales' },
  { clave: '620', nombre: 'Sociedades Cooperativas de Producción' },
  { clave: '621', nombre: 'Incorporación Fiscal' },
  { clave: '622', nombre: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { clave: '623', nombre: 'Opcional para Grupos de Sociedades' },
  { clave: '624', nombre: 'Coordinados' },
  { clave: '625', nombre: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { clave: '626', nombre: 'Régimen Simplificado de Confianza' },
] as const

/**
 * El uso de CFDI, que aquí no se escoge: siempre es Donativos.
 *
 * La delegación es donataria autorizada, así que todo lo que factura sale
 * con esa clave. Ofrecer la lista entera del SAT solo daba oportunidad de
 * escoger mal, y un CFDI con el uso equivocado se rechaza y hay que
 * reexpedirlo.
 */
export const USO_CFDI = { clave: 'D04', nombre: 'Donativos' } as const

/** Lo que pesa como mucho una constancia: 5 MB. */
export const MAXIMO_CONSTANCIA = 5 * 1024 * 1024

export type DatosFactura = {
  rfc: string
  razonSocial: string
  codigoPostal: string
  regimenFiscal: string
  usoCfdi: string
}

/**
 * El RFC como lo espera el SAT.
 *
 * La gente lo dicta con guiones y lo escribe en minúsculas; en el sistema
 * vive en una sola forma o el mismo RFC entraría dos veces escrito
 * distinto.
 */
export function normalizarRfc(bruto: string): string {
  return bruto.toUpperCase().replace(/[\s.-]/g, '').trim()
}

/**
 * Tres o cuatro letras, la fecha de constitución o nacimiento, y tres de
 * homoclave. Tres letras es empresa; cuatro, persona.
 *
 * La Ñ y el & se aceptan: el SAT los usa en razones sociales como
 * "Muñoz y Asociados".
 */
const FORMA_RFC = /^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})([A-Z0-9]{3})$/

export function validarRfc(bruto: string): string | null {
  const rfc = normalizarRfc(bruto)
  if (rfc === '') return 'Falta el RFC.'

  const partes = FORMA_RFC.exec(rfc)
  if (!partes) {
    return 'Ese RFC no tiene la forma correcta: 12 caracteres si es empresa, 13 si es persona.'
  }

  // La fecha va dentro del RFC. Un 13 en el mes o un 32 en el día es un
  // dedazo que el formato solo no alcanza a ver.
  const mes = Number(partes[3])
  const dia = Number(partes[4])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return 'Ese RFC trae una fecha que no existe. Revisa los seis dígitos de en medio.'
  }
  return null
}

const esClave = (lista: ReadonlyArray<{ clave: string }>, clave: string) =>
  lista.some((x) => x.clave === clave)

/** Todo lo que hace falta para poder facturarle a alguien. */
export function validarDatosFactura(datos: DatosFactura): string | null {
  const malRfc = validarRfc(datos.rfc)
  if (malRfc) return malRfc

  if (datos.razonSocial.trim() === '') {
    return 'Falta la razón social, tal como aparece en la constancia.'
  }

  // Cinco dígitos, ni más ni menos: el SAT rechaza la factura si el código
  // postal no coincide con el del domicilio fiscal.
  if (!/^\d{5}$/.test(datos.codigoPostal.trim())) {
    return 'El código postal son cinco dígitos.'
  }

  if (!esClave(REGIMENES_FISCALES, datos.regimenFiscal)) {
    return 'Escoge el régimen fiscal que aparece en la constancia.'
  }

  // No se escoge, pero se revisa: el campo viaja en el formulario y quien
  // lo cambie por otro no debe colarse.
  if (datos.usoCfdi !== USO_CFDI.clave) {
    return `El uso del CFDI es siempre ${USO_CFDI.nombre}.`
  }

  return null
}

/**
 * La constancia de situación fiscal.
 *
 * Es opcional: se puede capturar a alguien que todavía no la trae y
 * agregarla después. Lo que no se acepta es otra cosa disfrazada de
 * constancia.
 */
export function validarConstancia(
  archivo: { tipo: string; tamano: number } | null,
): string | null {
  if (!archivo) return null
  if (archivo.tamano === 0) return 'Ese archivo está vacío.'
  if (archivo.tipo !== 'application/pdf') {
    return 'La constancia tiene que ser el PDF que descarga el SAT.'
  }
  if (archivo.tamano > MAXIMO_CONSTANCIA) {
    const mb = Math.round(MAXIMO_CONSTANCIA / 1024 / 1024)
    return `Ese archivo pesa de más: el tope son ${mb} MB.`
  }
  return null
}

/**
 * El correo a donde va el CFDI.
 *
 * Se pregunta junto con los datos fiscales y no en la ficha de contacto: es
 * el momento en que alguien está decidiendo que quiere factura, y ahí sabe a
 * dónde la quiere. Pedírselo dos pantallas después es pedirlo cuando ya se
 * fue.
 *
 * Vacío se acepta: la delegación no manda la factura desde este sistema, así
 * que exigirlo dejaría sin inscribir a quien llega sin su correo a la mano.
 * Lo que no se acepta es uno mal escrito, porque eso no se nota hasta que el
 * CFDI rebota, y para entonces ya se timbró.
 *
 * La revisión es a propósito sencilla: algo, arroba, algo, punto, algo, sin
 * espacios. Las reglas completas de un correo son mucho más anchas de lo que
 * cualquiera escribe, y una expresión que las cubra todas rechaza menos
 * errores de dedo, no más.
 */
export function validarCorreoFactura(bruto: string): string | null {
  const correo = bruto.trim()
  if (correo === '') return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    return 'Ese correo no se ve bien escrito. Revísalo o déjalo en blanco.'
  }
  return null
}
