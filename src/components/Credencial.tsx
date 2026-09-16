/**
 * La credencial del alumno: su folio y su código QR, listos para imprimir.
 *
 * Es el mismo papel en las dos pantallas que la enseñan —la del panel y la
 * pública que se le comparte al alumno—: si fueran dos, una acabaría
 * diciendo algo distinto de la otra.
 */
export default function Credencial({
  nombre,
  folio,
  qr,
  cursos,
  dias,
  anio,
}: {
  nombre: string
  folio: string
  /** El QR ya dibujado, como `data:image/png;base64,…`. */
  qr: string
  cursos: string[]
  dias: string
  anio: number
}) {
  return (
    <div className="tarjeta credencial">
      <div className="credencial-titulo">CRUZ ROJA MEXICANA</div>
      <div className="silencio" style={{ fontSize: '.8rem' }}>
        Delegación Cancún · Escuela de Natación
      </div>

      <hr className="credencial-raya" />

      <div className="credencial-nombre">{nombre}</div>
      <div className="credencial-folio">{folio}</div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt={`Código QR de ${folio}`} className="credencial-qr" />

      {cursos.length > 0 && (
        <div className="credencial-curso">
          <strong>{cursos.join(', ')}</strong>
          {dias && <><br /><span className="silencio">{dias}</span></>}
        </div>
      )}

      <div className="silencio credencial-pie">
        Escanea este código para ver tu estado de cuenta.
        <br />
        Ciclo {anio}
      </div>
    </div>
  )
}
