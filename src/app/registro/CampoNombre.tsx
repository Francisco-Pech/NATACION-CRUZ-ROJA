'use client'

/**
 * El nombre del alumno, en mayúsculas mientras se escribe.
 *
 * Se ve en mayúsculas y se guarda en mayúsculas. No es solo el estilo: el
 * servidor lo convierte igual, y así lo que la persona ve al teclear es
 * exactamente lo que va a quedar escrito en su credencial.
 */
export default function CampoNombre() {
  return (
    <>
      <label htmlFor="nombreCompleto">Nombre completo del alumno</label>
      <input
        id="nombreCompleto"
        name="nombreCompleto"
        required
        maxLength={120}
        autoComplete="name"
        autoCapitalize="characters"
        placeholder="NOMBRE Y APELLIDOS"
        style={{ textTransform: 'uppercase' }}
      />
      <p className="silencio" style={{ fontSize: '.82rem', marginTop: '.3rem' }}>
        Como viene en su acta o identificación.
      </p>
    </>
  )
}
