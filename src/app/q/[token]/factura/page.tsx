import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import {
  REGIMENES_FISCALES, USO_CFDI, validarDatosFactura, normalizarRfc, validarCorreoFactura,
} from '@/lib/facturacion'

/**
 * Guarda lo que el alumno contestó sobre su factura.
 *
 * Dice que no: se apaga y ya. Los datos que tenía se quedan escritos a
 * propósito —si el mes que entra vuelve a pedirla no tiene que teclear todo
 * otra vez— pero con `factura` apagado nadie le expide nada.
 *
 * Dice que sí: se validan igual que en el mostrador. Un RFC mal escrito no
 * se nota hasta que el SAT rechaza el CFDI y hay que reexpedirlo.
 */
async function guardar(datos: FormData) {
  'use server'

  const token = String(datos.get('token'))
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    select: { alumnoId: true },
  })
  if (!inscripcion) notFound()

  const texto = (campo: string) => String(datos.get(campo) ?? '').trim()
  const quiere = datos.get('factura') === 'si'

  if (!quiere) {
    await prisma.alumno.update({
      where: { id: inscripcion.alumnoId },
      data: { factura: false },
    })
    redirect(`/q/${token}/factura?listo=no`)
  }

  const capturados = {
    rfc: normalizarRfc(texto('rfc')),
    razonSocial: texto('razonSocial'),
    codigoPostal: texto('codigoPostal'),
    regimenFiscal: texto('regimenFiscal'),
    usoCfdi: USO_CFDI.clave,
  }

  const mal = validarDatosFactura(capturados)
  if (mal) redirect(`/q/${token}/factura?mal=${encodeURIComponent(mal)}`)

  const correo = texto('correoFactura')
  const malCorreo = validarCorreoFactura(correo)
  if (malCorreo) redirect(`/q/${token}/factura?mal=${encodeURIComponent(malCorreo)}`)

  await prisma.alumno.update({
    where: { id: inscripcion.alumnoId },
    data: { ...capturados, email: correo || null, factura: true },
  })
  redirect(`/q/${token}/factura?listo=si`)
}

/**
 * "¿Quieres factura, y estos datos siguen bien?"
 *
 * Se llega por el código QR, sin contraseña, igual que el estado de cuenta.
 * Existe porque los datos fiscales cambian —alguien se muda y le cambia el
 * código postal, una empresa cambia de régimen— y enterarse de eso cuando el
 * SAT rechaza el CFDI es enterarse tarde.
 *
 * No se pregunta el uso del CFDI: la delegación es donataria autorizada y
 * todo sale como Donativo.
 */
export default async function FacturaDelAlumno({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ listo?: string; mal?: string }>
}) {
  const { token } = await params
  const { listo, mal } = await searchParams

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    include: { alumno: true },
  })
  // No se distingue entre token inválido e inexistente: revelarlo permitiría
  // confirmar folios a base de tanteo.
  if (!inscripcion) notFound()

  const a = inscripcion.alumno

  return (
    <div className="contenedor angosto">
      <div style={{ textAlign: 'center', margin: '1rem 0 1.5rem' }}>
        <div className="silencio" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>
          CRUZ ROJA MEXICANA · CANCÚN
        </div>
        <h1 style={{ margin: '.35rem 0 .15rem' }}>Tu factura</h1>
        <div style={{ fontFamily: 'ui-monospace, monospace' }} className="silencio">
          {a.nombreCompleto} · {inscripcion.folio}
        </div>
      </div>

      {listo === 'si' && (
        <div className="aviso">
          <strong>Listo.</strong> Se te factura con estos datos. Si algo cambia, vuelve aquí.
        </div>
      )}
      {listo === 'no' && (
        <div className="aviso">
          <strong>Listo.</strong> Ya no se te expide factura. Tus datos se quedan guardados por
          si más adelante vuelves a pedirla.
        </div>
      )}
      {mal && <div className="error">{mal}</div>}

      <form action={guardar}>
        <input type="hidden" name="token" value={token} />

        <div className="tarjeta">
          <h2>¿Requieres factura?</h2>
          <p className="silencio" style={{ marginTop: 0, fontSize: '.9rem' }}>
            La Cruz Roja Mexicana es donataria autorizada, así que tu mensualidad se factura
            como <strong>{USO_CFDI.nombre}</strong>. Si la necesitas, revisa que estos datos
            sean los de tu constancia de situación fiscal.
          </p>

          <label className="fila" style={{ fontWeight: 400 }}>
            <input
              type="radio" name="factura" value="si" defaultChecked={a.factura}
              style={{ width: 'auto' }}
            />
            <span>Sí, quiero factura</span>
          </label>
          <label className="fila" style={{ fontWeight: 400 }}>
            <input
              type="radio" name="factura" value="no" defaultChecked={!a.factura}
              style={{ width: 'auto' }}
            />
            <span>No, no la necesito</span>
          </label>
        </div>

        <div className="tarjeta">
          <h2>Tus datos de facturación</h2>

          <label htmlFor="rfc">RFC</label>
          <input
            id="rfc" name="rfc" defaultValue={a.rfc ?? ''}
            style={{ textTransform: 'uppercase' }} placeholder="XAXX010101000"
          />

          <label htmlFor="razonSocial">Nombre o razón social</label>
          <input
            id="razonSocial" name="razonSocial" defaultValue={a.razonSocial ?? ''}
            placeholder="Tal como aparece en tu constancia"
          />

          <label htmlFor="codigoPostal">Código postal de tu domicilio fiscal</label>
          <input
            id="codigoPostal" name="codigoPostal" inputMode="numeric" maxLength={5}
            defaultValue={a.codigoPostal ?? ''} placeholder="77500"
          />

          <label htmlFor="regimenFiscal">Régimen fiscal</label>
          <select id="regimenFiscal" name="regimenFiscal" defaultValue={a.regimenFiscal ?? ''}>
            <option value="">Escoge el de tu constancia…</option>
            {REGIMENES_FISCALES.map((r) => (
              <option key={r.clave} value={r.clave}>{r.clave} · {r.nombre}</option>
            ))}
          </select>

          <label htmlFor="correoFactura">Correo electrónico</label>
          {/* Aquí y no en la ficha de contacto: es donde está decidiendo que
              quiere factura, y es cuando sabe a dónde la quiere. */}
          <input
            id="correoFactura" name="correoFactura" type="email"
            defaultValue={a.email ?? ''} placeholder="A donde quieres que llegue"
          />

          <label htmlFor="usoCfdi">Uso del CFDI</label>
          {/* No se escoge: la delegación es donataria y todo sale como
              Donativo. Se enseña para que nadie tenga que preguntarlo. */}
          <input id="usoCfdi" value={`${USO_CFDI.clave} · ${USO_CFDI.nombre}`} disabled readOnly />

          <p className="silencio" style={{ fontSize: '.85rem', marginBottom: 0 }}>
            Si contestaste que no la necesitas, estos campos se ignoran.
          </p>
        </div>

        <button className="boton" type="submit" style={{ width: '100%' }}>Guardar</button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <a href={`/q/${token}`}>Volver a mi estado de cuenta</a>
      </p>

      <p className="silencio" style={{ fontSize: '.78rem', textAlign: 'center' }}>
        Esta página es personal. No compartas el enlace ni tu código QR.
      </p>
    </div>
  )
}
