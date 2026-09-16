import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { normalizarFolio } from '@/lib/folio'

/**
 * La puerta para pagar en línea: el folio y nada más.
 *
 * Con el folio, no con el código QR. El QR es el respaldo del alumno y no
 * cambia nunca; esto es para quien paga por él —la mamá, el hermano, quien
 * sea— con el folio que trae la credencial impresa, dictado por teléfono o
 * copiado de un mensaje.
 *
 * El folio son ocho caracteres al azar sobre un alfabeto de 32: teclearlos a
 * ciegas hasta dar con una cuenta ajena no es algo que nadie vaya a lograr.
 */
async function buscar(datos: FormData) {
  'use server'

  const folio = normalizarFolio(String(datos.get('folio') ?? ''))
  if (!folio) redirect('/pago?mal=Escribe tu folio.')

  const existe = await prisma.inscripcion.findUnique({
    where: { folio },
    select: { folio: true },
  })
  // El mismo recado exista o no: contestar distinto dejaría confirmar folios
  // a base de tanteo.
  if (!existe) {
    redirect(`/pago?mal=${encodeURIComponent('No encontramos ese folio. Revísalo y vuelve a intentar.')}`)
  }

  redirect(`/pago/${existe.folio}`)
}

export default async function Pago({
  searchParams,
}: {
  searchParams: Promise<{ mal?: string }>
}) {
  const { mal } = await searchParams

  return (
    <div className="contenedor angosto">
      <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
        <div className="silencio" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>
          CRUZ ROJA MEXICANA · CANCÚN
        </div>
        <h1 style={{ margin: '.35rem 0 .15rem' }}>Pagar la natación</h1>
        <p className="silencio" style={{ margin: 0 }}>
          Escribe el folio de la credencial del alumno.
        </p>
      </div>

      {mal && <div className="error">{mal}</div>}

      <div className="tarjeta">
        <form action={buscar}>
          <label htmlFor="folio">Folio</label>
          <input
            id="folio"
            name="folio"
            placeholder="CR2026XXXXXXXX"
            autoCapitalize="characters"
            autoComplete="off"
            required
            style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '.05em' }}
          />
          <p className="silencio" style={{ fontSize: '.82rem', marginTop: '.4rem' }}>
            Viene impreso en la credencial. No importa si lo escribes con espacios o
            minúsculas.
          </p>

          <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.8rem' }}>
            <button className="boton" type="submit">Continuar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
