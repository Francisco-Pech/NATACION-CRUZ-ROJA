import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

async function guardar(datos: FormData) {
  'use server'
  const token = String(datos.get('token'))
  const texto = (campo: string) => {
    const v = String(datos.get(campo) ?? '').trim()
    return v === '' ? null : v
  }

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    select: { alumnoId: true },
  })
  if (!inscripcion) notFound()

  const nacimiento = texto('fechaNacimiento')

  await prisma.alumno.update({
    where: { id: inscripcion.alumnoId },
    data: {
      fechaNacimiento: nacimiento ? new Date(`${nacimiento}T12:00:00`) : null,
      telefono: texto('telefono'),
      email: texto('email'),
      direccion: texto('direccion'),
      contactoEmergenciaNombre: texto('contactoEmergenciaNombre'),
      contactoEmergenciaTelefono: texto('contactoEmergenciaTelefono'),
      condicionesMedicas: texto('condicionesMedicas'),
      rfc: texto('rfc'),
      razonSocial: texto('razonSocial'),
      codigoPostal: texto('codigoPostal'),
      datosCompletos: true,
    },
  })

  redirect(`/q/${token}`)
}

export default async function CapturaDatos({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    include: { alumno: true },
  })
  if (!inscripcion) notFound()

  const a = inscripcion.alumno
  const fecha = a.fechaNacimiento?.toISOString().slice(0, 10) ?? ''

  return (
    <div className="contenedor angosto">
      <h1>Tus datos</h1>
      <p className="silencio">{a.nombreCompleto} · {inscripcion.folio}</p>

      <form action={guardar}>
        <input type="hidden" name="token" value={token} />

        <div className="tarjeta">
          <h2>Contacto</h2>
          <label htmlFor="fechaNacimiento">Fecha de nacimiento</label>
          <input id="fechaNacimiento" name="fechaNacimiento" type="date" defaultValue={fecha} />

          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" name="telefono" type="tel" defaultValue={a.telefono ?? ''} />

          <label htmlFor="email">Correo electrónico</label>
          <input id="email" name="email" type="email" defaultValue={a.email ?? ''} />

          <label htmlFor="direccion">Domicilio</label>
          <input id="direccion" name="direccion" defaultValue={a.direccion ?? ''} />
        </div>

        <div className="tarjeta">
          <h2>En caso de emergencia</h2>
          <label htmlFor="contactoEmergenciaNombre">¿A quién avisamos?</label>
          <input id="contactoEmergenciaNombre" name="contactoEmergenciaNombre" defaultValue={a.contactoEmergenciaNombre ?? ''} />

          <label htmlFor="contactoEmergenciaTelefono">Su teléfono</label>
          <input id="contactoEmergenciaTelefono" name="contactoEmergenciaTelefono" type="tel" defaultValue={a.contactoEmergenciaTelefono ?? ''} />

          <label htmlFor="condicionesMedicas">Condiciones médicas o alergias</label>
          <textarea id="condicionesMedicas" name="condicionesMedicas" rows={3} defaultValue={a.condicionesMedicas ?? ''} />
        </div>

        <div className="tarjeta">
          <h2>Datos de facturación <span className="silencio" style={{ fontWeight: 400 }}>(opcional)</span></h2>
          <label htmlFor="rfc">RFC</label>
          <input id="rfc" name="rfc" defaultValue={a.rfc ?? ''} style={{ textTransform: 'uppercase' }} />

          <label htmlFor="razonSocial">Razón social</label>
          <input id="razonSocial" name="razonSocial" defaultValue={a.razonSocial ?? ''} />

          <label htmlFor="codigoPostal">Código postal</label>
          <input id="codigoPostal" name="codigoPostal" inputMode="numeric" defaultValue={a.codigoPostal ?? ''} />
        </div>

        <div className="tarjeta">
          <h2>Aviso de privacidad</h2>
          <p className="silencio" style={{ fontSize: '.85rem' }}>
            La Cruz Roja Mexicana, Delegación Cancún, usa estos datos únicamente para administrar
            tu inscripción a la escuela de natación, cobrar la mensualidad y poder avisar a tu
            contacto en caso de emergencia. No se comparten con terceros. Si el alumno es menor
            de edad, quien captura estos datos debe ser su madre, padre o tutor.
          </p>
          <label className="fila" style={{ fontWeight: 400 }}>
            <input type="checkbox" required style={{ width: 'auto' }} />
            <span>He leído y acepto el aviso de privacidad.</span>
          </label>
        </div>

        <button className="boton" type="submit" style={{ width: '100%' }}>Guardar mis datos</button>
      </form>
    </div>
  )
}
