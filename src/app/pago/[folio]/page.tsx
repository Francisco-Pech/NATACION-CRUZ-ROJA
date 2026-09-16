import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cuentaDelFolio, subirComprobante } from './acciones'
import ModalReporte from './ModalReporte'
import FormaDePago, { type Forma } from './FormaDePago'
import ModalPagados, { type MesHecho } from './ModalPagados'
import ModalFactura from './ModalFactura'
import { faltaUnPeriodoAntes } from '@/lib/cargos'
import { pasaElTope, alcanzoElTope } from '@/lib/cobros'
import {
  calcularTotalConComision, comisionesDelEntorno, type MetodoConComision,
} from '@/lib/comisiones'
import { ETIQUETA_METODO, cuandoSeRefleja, sePuedePagarEnLinea } from '@/lib/metodos-pago'
import { REGIMENES_FISCALES } from '@/lib/facturacion'
import { pesos, nombreMes, fechaLarga, conMayuscula } from '@/lib/formato'
import { usandoStripe } from '@/lib/pasarela'
import CampoArchivo from '@/components/CampoArchivo'
import { CodigoQR } from '@/components/CodigoQR'
import { baseDelSitio } from '@/lib/credencial'
import { EstadoCargo, EstadoPago } from '@prisma/client'

/** Los tres de Stripe. En persona se cobra en la ventanilla, no aquí. */
const EN_LINEA: MetodoConComision[] = ['TARJETA', 'SPEI', 'OXXO']

/** "Noviembre 2026". Encabeza tarjetas, así que va con mayúscula. */
const comoMes = (mes: number, anio: number) => `${conMayuscula(nombreMes(mes))} ${anio}`

/** "2026-11" → "noviembre de 2026", para meterlo en una frase. */
function enFrase(clave: string): string {
  const [anio, mes] = clave.split('-')
  return `${nombreMes(Number(mes))} de ${anio}`
}

export default async function CuentaDelAlumno({
  params,
  searchParams,
}: {
  params: Promise<{ folio: string }>
  searchParams: Promise<{ bien?: string; mal?: string; pago?: string }>
}) {
  const { folio } = await params
  const { bien, mal, pago } = await searchParams

  const cuenta = await cuentaDelFolio(folio)
  if (!cuenta) notFound()

  const { inscripcion, cargos } = cuenta
  const alumno = inscripcion.alumno

  // Curso y horario con los que la persona confirma que es su alumno.
  const grupos = [...new Map(
    inscripcion.sesiones.map((s) => [
      `${s.sesion.tipoCurso.nombre}|${s.sesion.horario.horaInicio}`,
      {
        curso: s.sesion.tipoCurso.nombre,
        horario: `${s.sesion.horario.horaInicio}–${s.sesion.horario.horaFin}`,
      },
    ]),
  ).values()]

  const saldado = (c: (typeof cargos)[number]) =>
    c.estado === EstadoCargo.PAGADO || c.estado === EstadoCargo.CANCELADO
  const cubiertos = cargos.map((c) => ({ clave: c.periodo.clave, cubierto: saldado(c) }))

  /**
   * El mes que toca pagar: el más viejo que se deba.
   *
   * Uno solo y en grande. Con cuatro tarjetas iguales la pregunta "¿cuál
   * pago?" se la tiene que contestar la persona, y se paga en orden de
   * todos modos: quien adelanta lo hace después, cuando ya no debe nada.
   */
  /**
   * ¿Ese mes sobra del máximo de meses que dura su curso?
   *
   * El tope se puede bajar cuando ya hay meses generados. Lo pagado se
   * respeta —el dinero entró y ahí sigue— pero lo que sobra y nunca se
   * pagó deja de ofrecerse: no se le cobra a nadie un mes que el curso ya
   * no contempla.
   */
  const fueraDelTope = (c: (typeof cargos)[number]) =>
    pasaElTope(
      cargos
        .filter((x) => x.tipoCursoId === c.tipoCursoId)
        .map((x) => ({ clave: x.periodo.clave, cancelado: x.estado === EstadoCargo.CANCELADO })),
      c.periodo.clave,
      c.tipoCurso.maxMeses,
    )

  const porPagar = cargos.filter((c) => !saldado(c))

  /**
   * Los cursos que ya cumplieron sus meses, para poder decirlo por su
   * nombre. Sin esto, a quien terminó su curso se le diría que "está
   * cubierto hasta diciembre", que es otra cosa y no es cierta.
   */
  const cumplidos = [...new Map(cargos.map((c) => [c.tipoCursoId, c.tipoCurso])).values()].filter(
    (curso) =>
      alcanzoElTope(
        cargos
          .filter((c) => c.tipoCursoId === curso.id)
          .map((c) => ({ cancelado: c.estado === EstadoCargo.CANCELADO })),
        curso.maxMeses,
      ),
  )
  const toca = porPagar.find((c) => !faltaUnPeriodoAntes(cubiertos, c.periodo.clave)) ?? null
  /** Cada mes se cobra en línea dentro de sus cinco días hábiles, y ya. */
  const aTiempo = toca ? sePuedePagarEnLinea(toca.periodo.fechaLimite) : false
  /**
   * Ese mes pasa del máximo de meses de su curso.
   *
   * Se sigue enseñando —el mes existe y su monto también— pero sin las
   * formas de pago: el curso ya no da para más meses, y cobrarlo sería
   * cobrar de más.
   */
  const sobraDelCurso = toca ? fueraDelTope(toca) : false
  /** A qué mes se le cuelga un comprobante cuando no se debe ninguno. */
  const ultimoCargo = cargos[cargos.length - 1] ?? null
  const despues = porPagar.filter((c) => c.id !== toca?.id)
  const yaPagados = cargos.filter(saldado).reverse()

  const porMetodo = comisionesDelEntorno()

  // El mismo código de su credencial, el único que tiene el alumno. Aquí
  // sirve para dos cosas: confirmar de un vistazo que es su cuenta y no la
  // de otro, y volver a ella sin teclear el folio.
  const enlaceDelQR = `${await baseDelSitio()}/q/${inscripcion.tokenQR}`

  return (
    <div className="contenedor angosto">
      <div style={{ textAlign: 'center', margin: '1.2rem 0 1.4rem' }}>
        <div className="silencio" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>
          CRUZ ROJA MEXICANA · CANCÚN
        </div>
        <h1 style={{ margin: '.35rem 0 .15rem' }}>{alumno.nombreCompleto}</h1>
        <div className="silencio" style={{ fontFamily: 'ui-monospace, monospace' }}>
          {inscripcion.folio}
        </div>

        {/* Su código, debajo de su folio: son las dos formas de nombrar a
            la misma persona, y juntas se reconocen de un vistazo. */}
        <figure className="codigo-del-alumno">
          <CodigoQR valor={enlaceDelQR} tamano={132} />
        </figure>
      </div>

      {bien && <div className="aviso">{bien}</div>}

      {/* Cómo volvió de la pasarela. El aviso de "no se completó" trae el
          botón para reportar: es el momento exacto en que alguien necesita
          decir "me cobraron y no aparece", y a los dos minutos ya cerró. */}
      {pago === 'listo' && (
        <div className="aviso">
          <strong>Recibimos tu pago.</strong> Si tu mes sigue apareciendo como pendiente, dale
          unos minutos y vuelve a entrar: hay formas de pago que tardan en confirmarse.
          {' '}¿Pasó algo raro? <ModalReporte folio={inscripcion.folio} />
        </div>
      )}

      {pago === 'cancelado' && (
        <div className="error">
          <strong>El pago no se completó.</strong> No se te cobró nada. Puedes intentarlo otra
          vez, o avisarnos si algo falló — sobre todo si tu banco sí te cobró.
          <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
            <ModalReporte folio={inscripcion.folio} destacado />
          </div>
        </div>
      )}

      {mal && (
        <>
          <div className="error">{mal}</div>
          <div className="fila" style={{ justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <ModalReporte folio={inscripcion.folio} destacado />
          </div>
        </>
      )}

      {/* Antes de cobrar nada: que confirme que es su alumno. Un folio mal
          tecleado que caiga en otra cuenta se descubre aquí, no después. */}
      <div className="tarjeta">
        <h2 style={{ marginBottom: '.5rem' }}>¿Es este el alumno?</h2>

        {/* En renglones y no en dos columnas: "Francisco Eduardo Pech Chim"
            no cabe en media tarjeta de teléfono, y al apretarse partía hasta
            el nombre del curso de al lado. */}
        <dl className="confirma-alumno">
          <div>
            <dt>Nombre</dt>
            <dd><strong>{alumno.nombreCompleto}</strong></dd>
          </div>
          {grupos.map((g) => (
            <div key={`${g.curso}${g.horario}`}>
              <dt>{g.curso}</dt>
              <dd>{g.horario}</dd>
            </div>
          ))}
          {grupos.length === 0 && (
            <div>
              <dt>Grupo</dt>
              <dd className="silencio">Sin asignar todavía.</dd>
            </div>
          )}
        </dl>
        <p className="silencio" style={{ fontSize: '.85rem', marginBottom: 0 }}>
          ¿No es quien buscas? <Link href="/pago">Escribe otro folio</Link>.
        </p>

      </div>

      {/* La factura, antes de pagar: el CFDI sale con los datos que había al
          momento del cobro, y corregirlos después obliga a cancelarlo. */}
      <ModalFactura
        folio={inscripcion.folio}
        datos={{
          factura: alumno.factura,
          rfc: alumno.rfc,
          razonSocial: alumno.razonSocial,
          codigoPostal: alumno.codigoPostal,
          regimenFiscal: alumno.regimenFiscal,
          email: alumno.email,
          constancia: alumno.constanciaSubidaEn
            ? {
                nombre: alumno.constanciaNombre,
                desde: fechaLarga(alumno.constanciaSubidaEn),
              }
            : null,
        }}
        regimenes={REGIMENES_FISCALES.map((r) => ({ clave: r.clave, nombre: r.nombre }))}
      />

      {!usandoStripe() && (
        <div className="aviso">
          <strong>Cobro en pruebas.</strong> Todavía no hay cuenta de Stripe conectada: los
          pagos de esta pantalla son simulados y no mueven dinero.
        </div>
      )}

      {/* ------------------------------------------------ el mes que toca */}
      {toca ? (
        <div className="tarjeta mes-a-pagar">
          <div className="etiqueta">{sobraDelCurso ? 'Fuera del curso' : 'Toca pagar'}</div>
          <h2>{comoMes(toca.periodo.mes, toca.periodo.ciclo.anio)}</h2>
          <div className="silencio" style={{ fontSize: '.85rem' }}>
            {toca.tipoCurso.nombre} · fecha límite {fechaLarga(toca.periodo.fechaLimite)}
          </div>

          <div className="mes-a-pagar-monto monto">{pesos(toca.montoNeto)}</div>

          {toca.montoDescuento > 0 && (
            <div className="silencio" style={{ fontSize: '.82rem' }}>
              Ya trae aplicado un descuento de {pesos(toca.montoDescuento)}.
            </div>
          )}
          {toca.montoRecargo > 0 && (
            <div style={{ fontSize: '.82rem', color: '#b91c1c' }}>
              Incluye {pesos(toca.montoRecargo)} de recargo por pago tardío.
            </div>
          )}

          {sobraDelCurso ? (
            /* El curso dura lo que dura. El mes se queda a la vista para
               que nadie crea que se le perdió, pero sin botón: cobrarlo
               sería cobrarle un mes que su curso ya no contempla. */
            <div className="aviso">
              <strong>Este mes ya no se cobra.</strong> {toca.tipoCurso.nombre} dura{' '}
              {toca.tipoCurso.maxMeses} {toca.tipoCurso.maxMeses === 1 ? 'mes' : 'meses'}, y con
              este ya se pasa. Si crees que es un error, avísanos antes de pagar nada.
            </div>
          ) : !aTiempo ? (
            /* Vencido: el cobro en línea se cierra y se le dice a dónde ir.
               Dejar los botones sería cobrarle el mes sin el recargo que sí
               le toca, y eso se descubre cuando ya pagó. */
            <div className="aviso">
              <strong>Se pasó la fecha límite.</strong> Este mes ya no se cobra en línea: pasa
              a la delegación para regularizarlo. Ahí te calculan el recargo y te cobran en la
              ventanilla.
            </div>
          ) : (
            <FormaDePago
              folio={inscripcion.folio}
              cargoId={toca.id}
              mes={comoMes(toca.periodo.mes, toca.periodo.ciclo.anio)}
              neto={pesos(toca.montoNeto)}
              formas={EN_LINEA.filter((m) => porMetodo[m]?.activo).map((metodo): Forma => {
                const config = porMetodo[metodo]
                const { total, comision } = calcularTotalConComision(toca.montoNeto, config)
                return {
                  metodo,
                  etiqueta: ETIQUETA_METODO[metodo],
                  total: pesos(total),
                  comision: pesos(comision),
                  porcentaje: config.porcentaje,
                  montoFijo: pesos(config.montoFijo),
                  iva: config.iva,
                  cuando: cuandoSeRefleja(metodo),
                }
              })}
            />
          )}

          {/* Siempre disponible, pase lo que pase: a tiempo, vencido o con
              la pasarela caída, quien ya pagó por fuera tiene que poder
              dejar su ticket. Es lo único que respalda un pago que el
              sistema todavía no ve. */}
          <details style={{ marginTop: '.7rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '.88rem' }}>
              Subir mi comprobante
            </summary>
            <form action={subirComprobante} style={{ marginTop: '.6rem' }}>
              <input type="hidden" name="folio" value={inscripcion.folio} />
              <input type="hidden" name="cargoId" value={toca.id} />
              <CampoArchivo
                nombre="comprobante"
                acepta="image/*,application/pdf"
                ayuda="Una foto del ticket o el PDF del banco."
              />
              <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
                <button className="boton tenue" type="submit">Enviar comprobante</button>
              </div>
            </form>
          </details>

          {toca.comprobanteSubidoEn && (
            <p className="silencio" style={{ fontSize: '.82rem', marginBottom: 0 }}>
              Comprobante recibido el {fechaLarga(toca.comprobanteSubidoEn)}.
            </p>
          )}
        </div>
      ) : (
        <div className="tarjeta mes-a-pagar al-dia">
          <div className="etiqueta">Al corriente</div>
          <h2>No debe ningún mes</h2>
          <p className="silencio" style={{ marginBottom: 0 }}>
            {cargos.length === 0
              ? 'Todavía no hay meses que cobrar en esta cuenta.'
              : cumplidos.length > 0
                ? `Ya cubrió ${cumplidos
                    .map((c) => `los ${c.maxMeses} meses de ${c.nombre}`)
                    .join(' y ')}. Ese curso no se cobra más.`
                : `Está cubierto hasta ${enFrase(cargos[cargos.length - 1].periodo.clave)}, que es`
                  + ' el último mes de este ciclo. Cuando abra el siguiente aparecerá aquí.'}
          </p>

          {/* También aquí: alguien puede haber pagado algo que la cuenta
              todavía no refleja, y su ticket es lo único que lo respalda. */}
          {ultimoCargo && (
            <details style={{ marginTop: '.7rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '.88rem' }}>
                Subir mi comprobante
              </summary>
              <form action={subirComprobante} style={{ marginTop: '.6rem' }}>
                <input type="hidden" name="folio" value={inscripcion.folio} />
                <input type="hidden" name="cargoId" value={ultimoCargo.id} />
                <CampoArchivo
                  nombre="comprobante"
                  acepta="image/*,application/pdf"
                  ayuda="Una foto del ticket o el PDF del banco."
                />
                <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
                  <button className="boton tenue" type="submit">Enviar comprobante</button>
                </div>
              </form>
            </details>
          )}
        </div>
      )}

      {/* Los meses de antes y los de después, a un toque: quien entra
          viene a pagar uno, no a leer doce. */}
      <ModalPagados
        pagados={yaPagados.map((cargo): MesHecho => {
          const pago = cargo.pagos
            .filter((p) => p.estado === EstadoPago.CONFIRMADO)
            .sort((a, b) => (b.fechaPago?.getTime() ?? 0) - (a.fechaPago?.getTime() ?? 0))[0]

          return {
            clave: cargo.periodo.clave,
            mes: comoMes(cargo.periodo.mes, cargo.periodo.ciclo.anio),
            monto: pesos(cargo.montoNeto),
            pagado: cargo.estado === EstadoCargo.PAGADO,
            comprobante: cargo.comprobanteSubidoEn
              ? `/pago/${inscripcion.folio}/comprobante/${cargo.periodo.clave}`
              : null,
            detalle:
              cargo.estado === EstadoCargo.CANCELADO
                ? 'Cancelado: no se cobró.'
                : pago
                  ? `${ETIQUETA_METODO[pago.metodo]}${
                      pago.fechaPago ? ` · ${fechaLarga(pago.fechaPago)}` : ''
                    }`
                  : 'Registrado en la ventanilla.',
          }
        })}
        pendientes={despues.map((cargo): MesHecho => ({
          clave: cargo.periodo.clave,
          mes: comoMes(cargo.periodo.mes, cargo.periodo.ciclo.anio),
          monto: pesos(cargo.montoNeto),
          pagado: false,
          comprobante: cargo.comprobanteSubidoEn
            ? `/pago/${inscripcion.folio}/comprobante/${cargo.periodo.clave}`
            : null,
          detalle: `Se abre al pagar ${enFrase(faltaUnPeriodoAntes(cubiertos, cargo.periodo.clave) ?? '')}`,
        }))}
      />

    </div>
  )
}
