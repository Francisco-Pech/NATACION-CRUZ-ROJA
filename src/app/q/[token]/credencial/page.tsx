import { notFound } from 'next/navigation'
import { armarCredencial } from '@/lib/credencial'
import Credencial from '@/components/Credencial'

/**
 * El título lleva el nombre: con varias credenciales abiertas, todas las
 * pestañas decían lo mismo y no se sabía cuál era de quién.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const credencial = await armarCredencial({ tokenQR: token })
  return {
    title: credencial
      ? `${credencial.nombre} · ${credencial.folio}`
      : 'Credencial · Escuela de Natación',
  }
}

/**
 * La credencial, abierta por el alumno desde el enlace que le compartieron.
 *
 * Sin contraseña, igual que su estado de cuenta y con el mismo token: quien
 * tiene el enlace ya podía ver lo que debe, así que enseñarle además su
 * propio código QR no abre nada nuevo. No se distingue un token inválido de
 * uno que no existe, para que nadie confirme folios a base de tanteo.
 */
export default async function CredencialPublica({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const credencial = await armarCredencial({ tokenQR: token })
  if (!credencial) notFound()

  return (
    <main className="principal">
      <div className="contenedor hoja-credencial">
        <h1 className="no-imprimir">Tu credencial</h1>
        <p className="silencio no-imprimir">
          Guárdala o imprímela. El código sirve todo el ciclo {credencial.anio}:
          al escanearlo se abre tu estado de cuenta.
        </p>

        <Credencial {...credencial} />

        <dl className="datos-credencial no-imprimir">
          <div>
            <dt>Alumno</dt>
            <dd>{credencial.nombre}</dd>
          </div>
          <div>
            <dt>Folio</dt>
            <dd style={{ fontFamily: 'ui-monospace, monospace' }}>{credencial.folio}</dd>
          </div>
          <div>
            <dt>Curso</dt>
            <dd>{credencial.cursos.length === 0 ? 'Sin asignar' : credencial.cursos.join(', ')}</dd>
          </div>
          <div>
            <dt>Días</dt>
            <dd>{credencial.dias || '—'}</dd>
          </div>
          <div>
            <dt>Ciclo</dt>
            <dd>{credencial.anio}</dd>
          </div>
          <div>
            <dt>Locker</dt>
            <dd>{credencial.locker ? `Número ${credencial.locker}` : 'Sin locker'}</dd>
          </div>
          <div>
            <dt>Factura</dt>
            {/* Solo el sí o el no: el RFC y la constancia no se enseñan
                aquí, que es una página que se abre con un enlace y sin
                contraseña. */}
            <dd>{credencial.factura ? 'Sí la pide' : 'No la pide'}</dd>
          </div>
        </dl>
      </div>
    </main>
  )
}
