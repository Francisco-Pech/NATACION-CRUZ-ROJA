import { prisma } from '@/lib/db'
import { periodoActual } from '@/lib/periodo-actual'
import { pesos, nombreMes } from '@/lib/formato'
import { moverLocker } from '../acciones'

export default async function Lockers() {
  const actual = await periodoActual()
  if (!actual) {
    return <><h1>Lockers</h1><div className="aviso">No hay periodo para este mes.</div></>
  }
  const { periodo } = actual

  const lockers = await prisma.locker.findMany({
    where: { activo: true },
    orderBy: { numero: 'asc' },
    include: {
      asignaciones: {
        where: { periodoId: periodo.id },
        include: { inscripcion: { include: { alumno: true } } },
      },
    },
  })

  const inscripciones = await prisma.inscripcion.findMany({
    where: { cicloAnualId: periodo.cicloAnualId, estado: 'ACTIVA' },
    include: { alumno: true },
    orderBy: { folio: 'asc' },
  })

  const ocupados = lockers.filter((l) => l.asignaciones.length > 0)
  const ingreso = ocupados.length * periodo.precioLocker

  return (
    <>
      <h1>Lockers · {nombreMes(periodo.mes)}</h1>

      <div className="rejilla">
        <div className="tarjeta dato">
          <div className="etiqueta">Ocupados</div>
          <div className="valor">{ocupados.length}</div>
        </div>
        <div className="tarjeta dato">
          <div className="etiqueta">Libres</div>
          <div className="valor">{lockers.length - ocupados.length}</div>
        </div>
        <div className="tarjeta dato">
          <div className="etiqueta">Ingreso del mes</div>
          <div className="valor monto">{pesos(ingreso)}</div>
        </div>
      </div>

      <div className="tarjeta">
        <table>
          <thead>
            <tr><th style={{ width: 90 }}>Locker</th><th>Asignado a</th><th style={{ width: 320 }}>Acción</th></tr>
          </thead>
          <tbody>
            {lockers.map((locker) => {
              const asignacion = locker.asignaciones[0]
              return (
                <tr key={locker.id}>
                  <td><strong>#{locker.numero}</strong></td>
                  <td>
                    {asignacion ? (
                      asignacion.inscripcion.alumno.nombreCompleto
                    ) : (
                      <span className="silencio">Libre</span>
                    )}
                  </td>
                  <td>
                    <form action={moverLocker} className="fila" style={{ gap: '.4rem' }}>
                      <input type="hidden" name="lockerId" value={locker.id} />
                      <input type="hidden" name="periodoId" value={periodo.id} />
                      {asignacion ? (
                        <>
                          <input type="hidden" name="accion" value="liberar" />
                          <input type="hidden" name="asignacionId" value={asignacion.id} />
                          <button className="boton tenue" type="submit" style={{ padding: '.35rem .75rem' }}>
                            Liberar
                          </button>
                        </>
                      ) : (
                        <>
                          <input type="hidden" name="accion" value="asignar" />
                          <select name="inscripcionId" defaultValue="" style={{ flex: 1 }} aria-label="Alumno">
                            <option value="" disabled>Elegir alumno…</option>
                            {inscripciones.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.folio} · {i.alumno.nombreCompleto}
                              </option>
                            ))}
                          </select>
                          <button className="boton" type="submit" style={{ padding: '.35rem .75rem' }}>
                            Asignar
                          </button>
                        </>
                      )}
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
