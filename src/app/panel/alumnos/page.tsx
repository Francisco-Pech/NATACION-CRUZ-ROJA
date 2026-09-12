import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { inscribirAlumno } from '@/lib/servicios/inscripciones'
import { colorDeEstado, ETIQUETA_ESTADO } from '@/lib/servicios/estado-cuenta'
import { pesos } from '@/lib/formato'
import { cabeUnoMas } from '@/lib/cupos'
import { DIAS_SEMANA, resumenDias } from '@/lib/dias-semana'
import { Categoria } from '@prisma/client'

async function darDeAlta(datos: FormData) {
  'use server'
  const nombre = String(datos.get('nombreCompleto') ?? '').trim()
  const categoria = String(datos.get('categoria')) === 'NINOS' ? Categoria.NINOS : Categoria.GENERAL
  if (!nombre) return

  const sesionIds = datos.getAll('sesionIds').map(String).filter(Boolean)

  const ciclo = await prisma.cicloAnual.findFirstOrThrow({
    where: { estado: 'ABIERTO' },
    orderBy: { anio: 'desc' },
  })
  await inscribirAlumno(nombre, ciclo.id, categoria, sesionIds)
  revalidatePath('/panel/alumnos')
}

export default async function Alumnos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const busqueda = (q ?? '').trim()
  const mes = new Date().getMonth() + 1

  const inscripciones = await prisma.inscripcion.findMany({
    where: busqueda
      ? {
          OR: [
            { folio: { contains: busqueda, mode: 'insensitive' } },
            { alumno: { nombreCompleto: { contains: busqueda, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    include: {
      alumno: true,
      sesiones: { include: { sesion: { include: { tipoCurso: true, horario: true } } } },
      cargos: { where: { periodo: { mes } }, include: { periodo: true, tipoCurso: true } },
    },
    orderBy: { folio: 'asc' },
    take: 200,
  })

  // Para el alta: solo las sesiones abiertas y con lugar. Ofrecer una llena
  // sería prometer algo que el servidor va a rechazar.
  const cursosConSesiones = (
    await prisma.tipoCurso.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        sesiones: {
          where: { activo: true },
          include: { horario: true, _count: { select: { inscritos: true } } },
          orderBy: [{ diaSemana: 'asc' }, { horario: { horaInicio: 'asc' } }],
        },
      },
    })
  ).map((c) => ({
    ...c,
    // Se ofrecen también las que van sobre el cupo mientras queden extras:
    // el servicio las acepta, así que esconderlas aquí sería decirle que no
    // a alguien que sí cabe.
    sesiones: c.sesiones.filter(
      (s) => cabeUnoMas(s._count.inscritos, s.cupoMaximo, s.extras) !== 'lleno',
    ),
  }))

  return (
    <>
      <h1>Alumnos</h1>

      <div className="tarjeta">
        <h2>Dar de alta</h2>
        <p className="silencio" style={{ marginTop: 0 }}>
          Basta el nombre completo. El alumno completa lo demás al abrir su QR.
        </p>
        <form action={darDeAlta} className="fila" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 260px' }}>
            <label htmlFor="nombreCompleto">Nombre completo</label>
            <input id="nombreCompleto" name="nombreCompleto" required placeholder="Ana Sofía Canul Pérez" />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label htmlFor="categoria">Categoría</label>
            <select id="categoria" name="categoria" defaultValue="GENERAL" required>
              <option value="GENERAL">General</option>
              <option value="NINOS">Niños</option>
            </select>
          </div>
          <button className="boton" type="submit">Dar de alta</button>

          <div style={{ flex: '1 1 100%' }}>
            <span className="etiqueta">Horario</span>
            <p className="silencio" style={{ marginTop: 0, fontSize: '.85rem' }}>
              Marca los días a los que va a venir. Se puede dejar en blanco y asignarlo
              después, pero <strong>sin curso no se le genera cargo</strong>. Las sesiones
              llenas no aparecen.
            </p>

            {cursosConSesiones.map((curso) => (
              <div key={curso.id} style={{ marginBottom: '.6rem' }}>
                <strong style={{ fontSize: '.9rem' }}>{curso.nombre}</strong>
                <div className="fila" style={{ flexWrap: 'wrap', gap: '.4rem', marginTop: '.2rem' }}>
                  {curso.sesiones.map((s) => {
                    const dia = DIAS_SEMANA.find((d) => d.n === s.diaSemana)
                    const quedan = s.cupoMaximo - s._count.inscritos
                    // Pasado el cupo se sigue pudiendo inscribir a cuenta de
                    // los extras, pero se dice: quien captura tiene que saber
                    // que está metiendo a alguien de más, no enterarse cuando
                    // la alberca esté llena.
                    const sobreCupo = quedan <= 0
                    return (
                      <label
                        key={s.id}
                        className="fila"
                        style={{ fontWeight: 400, margin: 0, gap: '.3rem', fontSize: '.82rem' }}
                      >
                        <input type="checkbox" name="sesionIds" value={s.id} style={{ width: 'auto' }} />
                        <span>
                          {dia?.corto} {s.horario.horaInicio}
                          {sobreCupo ? (
                            <span className="sobre-cupo"> sobre cupo</span>
                          ) : (
                            <span className="silencio"> ({quedan})</span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                  {curso.sesiones.length === 0 && (
                    <span className="silencio" style={{ fontSize: '.82rem' }}>sin cupo libre</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </form>
      </div>

      <div className="tarjeta">
        <form className="fila" style={{ marginBottom: '.75rem' }}>
          <input name="q" defaultValue={busqueda} placeholder="Buscar por nombre o folio…" style={{ flex: 1 }} />
          <button className="boton tenue" type="submit">Buscar</button>
        </form>

        <div className="tabla-ancha">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Curso y días</th>
                <th>Mes en curso</th>
                <th className="derecha">Adeudo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((i) => {
                // Quien lleva dos cursos debe dos cargos este mes: se suman,
                // y el semáforo toma el peor de los dos.
                const adeudo = i.cargos.reduce((suma, c) => suma + c.montoNeto, 0)
                const cargo = i.cargos.find((c) => c.estado === 'VENCIDO') ?? i.cargos[0]

                const cursos = [...new Map(
                  i.sesiones.map((s) => [s.sesion.tipoCursoId, s.sesion.tipoCurso.nombre]),
                ).values()]
                const dias = i.sesiones.map((s) => s.sesion.diaSemana)

                return (
                  <tr key={i.id}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.85rem' }}>{i.folio}</td>
                    <td><Link href={`/panel/alumnos/${i.id}`}>{i.alumno.nombreCompleto}</Link></td>
                    <td>{i.alumno.categoria === 'NINOS' ? 'Niños' : 'General'}</td>
                    <td className="silencio">
                      {cursos.length === 0 ? (
                        <span style={{ color: '#b45309' }}>sin curso</span>
                      ) : (
                        <>
                          {cursos.join(', ')}
                          <br />
                          <span style={{ fontSize: '.8rem' }}>{resumenDias(dias)}</span>
                        </>
                      )}
                    </td>
                    <td>
                      {cargo ? (
                        <span className={`insignia ${colorDeEstado(cargo.estado)}`}>
                          {ETIQUETA_ESTADO[cargo.estado]}
                          {i.cargos.length > 1 && ` (${i.cargos.length})`}
                        </span>
                      ) : (
                        <span className="silencio">sin cargo</span>
                      )}
                    </td>
                    <td className="derecha monto">{i.cargos.length > 0 ? pesos(adeudo) : '—'}</td>
                    <td className="derecha">
                      <Link href={`/panel/alumnos/${i.id}/credencial`}>Credencial</Link>
                    </td>
                  </tr>
                )
              })}
              {inscripciones.length === 0 && (
                <tr><td colSpan={7} className="silencio">Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
