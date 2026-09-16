import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { pesos, nombreMes } from '@/lib/formato'
import { EtiquetaEstado } from '@/components/EtiquetaEstado'
import { DIAS_SEMANA, resumenDias } from '@/lib/dias-semana'

export default async function FichaAlumno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id },
    include: {
      alumno: true,
      ciclo: true,
      descuento: true,
      sesiones: { include: { sesion: { include: { tipoCurso: true, horario: true } } } },
      cargos: {
        include: { periodo: true, pagos: true, tipoCurso: true },
        orderBy: { periodo: { mes: "asc" } },
      },
      lockers: { include: { locker: true, periodo: true } },
    },
  })
  if (!inscripcion) notFound()

  const { alumno } = inscripcion
  const cursos = [...new Map(
    inscripcion.sesiones.map((s) => [s.sesion.tipoCursoId, s.sesion.tipoCurso.nombre]),
  ).values()]

  return (
    <>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ marginBottom: '.2rem' }}>{alumno.nombreCompleto}</h1>
          <span className="silencio" style={{ fontFamily: 'ui-monospace, monospace' }}>
            {inscripcion.folio}
          </span>
        </div>
        <Link className="boton" href={`/panel/alumnos/${id}/credencial`}>Ver credencial</Link>
      </div>

      <div className="rejilla">
        <div className="tarjeta">
          <div className="etiqueta">Curso</div>
          <div>{cursos.length === 0 ? "Sin asignar" : cursos.join(", ")}</div>
        </div>
        <div className="tarjeta">
          <div className="etiqueta">Descuento</div>
          <div>{inscripcion.descuento?.nombre ?? 'Ninguno'}</div>
        </div>
        <div className="tarjeta">
          <div className="etiqueta">Lockers</div>
          <div>{inscripcion.lockers.length || 'Ninguno'}</div>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Horario</h2>
        {inscripcion.sesiones.length === 0 ? (
          <p className="silencio" style={{ marginBottom: 0 }}>
            No está apuntado a ninguna sesión, así que <strong>no se le genera cargo</strong>.
          </p>
        ) : (
          <>
            <p className="silencio" style={{ marginTop: 0 }}>
              {resumenDias(inscripcion.sesiones.map((s) => s.sesion.diaSemana))}
            </p>
            <table>
              <tbody>
                {inscripcion.sesiones
                  .sort(
                    (a, b) =>
                      a.sesion.diaSemana - b.sesion.diaSemana ||
                      a.sesion.horario.horaInicio.localeCompare(b.sesion.horario.horaInicio),
                  )
                  .map((s) => {
                    const dia = DIAS_SEMANA.find((d) => d.n === s.sesion.diaSemana)
                    return (
                      <tr key={s.id} style={{ opacity: s.sesion.activo ? 1 : 0.55 }}>
                        <td style={{ width: 130 }}>{dia?.largo ?? '—'}</td>
                        <td style={{ fontFamily: 'ui-monospace, monospace' }}>
                          {s.sesion.horario.horaInicio}—{s.sesion.horario.horaFin}
                        </td>
                        <td className="silencio">{s.sesion.tipoCurso.nombre}</td>
                        <td className="derecha">
                          {!s.sesion.activo && <span className="insignia GRIS">sesión cerrada</span>}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="tarjeta">
        <h2>Datos de contacto</h2>
        {alumno.datosCompletos ? (
          <table>
            <tbody>
              <tr><td className="silencio">Teléfono</td><td>{alumno.telefono ?? '—'}</td></tr>
              <tr><td className="silencio">Correo</td><td>{alumno.email ?? '—'}</td></tr>
              <tr><td className="silencio">Domicilio</td><td>{alumno.direccion ?? '—'}</td></tr>
              <tr>
                <td className="silencio">Contacto de emergencia</td>
                <td>
                  {alumno.contactoEmergenciaNombre ?? '—'}
                  {alumno.contactoEmergenciaTelefono ? ` · ${alumno.contactoEmergenciaTelefono}` : ''}
                </td>
              </tr>
              <tr><td className="silencio">Condiciones médicas</td><td>{alumno.condicionesMedicas ?? 'Ninguna registrada'}</td></tr>
            </tbody>
          </table>
        ) : (
          <p className="silencio" style={{ margin: 0 }}>
            El alumno todavía no completa su información desde su código QR.
          </p>
        )}
      </div>

      <div className="tarjeta">
        <h2>Estado de cuenta {inscripcion.ciclo.anio}</h2>
        <table>
          <thead>
            <tr><th>Mes</th><th>Estado</th><th className="derecha">Total</th><th className="derecha">Pagado</th></tr>
          </thead>
          <tbody>
            {inscripcion.cargos.map((c) => {
              const pagado = c.pagos
                .filter((p) => p.estado === 'CONFIRMADO')
                .reduce((s, p) => s + p.montoNeto, 0)
              return (
                <tr key={c.id}>
                  <td>{nombreMes(c.periodo.mes)}</td>
                  <td><EtiquetaEstado estado={c.estado} /></td>
                  <td className="derecha monto">{pesos(c.montoNeto)}</td>
                  <td className="derecha monto">{pesos(pagado)}</td>
                </tr>
              )
            })}
            {inscripcion.cargos.length === 0 && (
              <tr><td colSpan={4} className="silencio">Sin cargos generados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
