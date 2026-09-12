import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'

export default async function Credencial({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id },
    include: { alumno: true, ciclo: true },
  })
  if (!inscripcion) notFound()

  const cabeceras = await headers()
  const host = cabeceras.get('host') ?? 'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  const url = `${protocolo}://${host}/q/${inscripcion.tokenQR}`

  const qr = await QRCode.toDataURL(url, { width: 420, margin: 1 })

  return (
    <>
      <div className="no-imprimir fila" style={{ justifyContent: 'space-between' }}>
        <h1>Credencial</h1>
        <a className="boton" href={`/panel/alumnos/${id}/credencial?imprimir=1`} onClick={undefined}>
          Usa Cmd/Ctrl + P para imprimir
        </a>
      </div>

      <div
        className="tarjeta credencial"
        style={{ maxWidth: 380, margin: '0 auto', textAlign: 'center' }}
      >
        <div style={{ fontWeight: 700, color: 'var(--rojo)', letterSpacing: '.03em' }}>
          CRUZ ROJA MEXICANA
        </div>
        <div className="silencio" style={{ fontSize: '.8rem' }}>
          Delegación Cancún · Escuela de Natación
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--borde)', margin: '.85rem 0' }} />

        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{inscripcion.alumno.nombreCompleto}</div>
        <div style={{ fontFamily: 'ui-monospace, monospace', margin: '.3rem 0 .8rem' }}>
          {inscripcion.folio}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`Código QR de ${inscripcion.folio}`} style={{ width: 240, height: 240 }} />

        <div className="silencio" style={{ fontSize: '.78rem', marginTop: '.6rem' }}>
          Escanea este código para ver tu estado de cuenta.<br />
          Ciclo {inscripcion.ciclo.anio}
        </div>
      </div>

      <p className="no-imprimir silencio" style={{ textAlign: 'center', fontSize: '.85rem', wordBreak: 'break-all' }}>
        {url}
      </p>
    </>
  )
}
