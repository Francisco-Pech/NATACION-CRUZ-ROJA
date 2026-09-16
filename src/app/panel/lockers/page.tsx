import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { periodoActual } from '@/lib/periodo-actual'
import { pesos, nombreMes } from '@/lib/formato'
import TarjetasLockers, { type Casillero } from './TarjetasLockers'

export default async function Lockers() {
  await requierePermiso('LOCKERS')

  const actual = await periodoActual()
  if (!actual) {
    return <><h1>Lockers</h1><div className="aviso">No hay periodo para este mes.</div></>
  }
  const { periodo } = actual

  const [filas, profesores] = await Promise.all([
    prisma.locker.findMany({
      orderBy: { numero: 'asc' },
      include: {
        deProfesor: { include: { usuario: true } },
        asignaciones: {
          where: { periodoId: periodo.id },
          include: { inscripcion: { include: { alumno: true } } },
        },
      },
    }),
    prisma.usuario.findMany({
      where: { activo: true, rol: { clave: 'PROFESOR' } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ])

  const lockers: Casillero[] = filas.map((l) => {
    const delMes = l.asignaciones[0]
    return {
      id: l.id,
      numero: l.numero,
      activo: l.activo,
      // El del profesor manda: no cuelga de ningún mes, así que mientras
      // esté apartado el locker no es de nadie más.
      ocupa: l.deProfesor
        ? { quien: 'profesor', nombre: l.deProfesor.usuario.nombre }
        : delMes
          ? {
              quien: 'alumno',
              nombre: delMes.inscripcion.alumno.nombreCompleto,
              folio: delMes.inscripcion.folio,
            }
          : null,
    }
  })

  const deAlumnos = lockers.filter((l) => l.ocupa?.quien === 'alumno').length
  const deProfesores = lockers.filter((l) => l.ocupa?.quien === 'profesor').length
  const libres = lockers.filter((l) => l.activo && !l.ocupa).length

  return (
    <>
      <h1>Lockers · {nombreMes(periodo.mes)}</h1>

      <div className="rejilla">
        <div className="tarjeta dato">
          <div className="etiqueta">Libres</div>
          <div className="valor">{libres}</div>
        </div>
        <div className="tarjeta dato">
          <div className="etiqueta">De alumnos</div>
          <div className="valor">{deAlumnos}</div>
        </div>
        <div className="tarjeta dato">
          <div className="etiqueta">De profesores</div>
          <div className="valor">{deProfesores}</div>
        </div>
      </div>

      <div className="tarjeta">
        <TarjetasLockers
          lockers={lockers}
          profesores={profesores}
          periodoId={periodo.id}
          precio={pesos(periodo.precioLocker)}
        />
      </div>
    </>
  )
}
