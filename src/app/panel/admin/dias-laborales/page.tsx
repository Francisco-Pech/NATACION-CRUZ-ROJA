import Link from 'next/link'
import { prisma } from '@/lib/db'
import { resumenDias } from '@/lib/dias-semana'
import { alternarFranjaLaboral } from '../catalogos'
import Parrilla from './Parrilla'

/** Lunes primero, como los lee la gente: domingo es 0 en el calendario. */
const deLunesADomingo = (numero: number) => (numero + 6) % 7

export default async function DiasLaborales() {
  const [dias, franjas, laborales] = await Promise.all([
    prisma.diaSemana.findMany({ where: { activo: true } }),
    prisma.horario.findMany({ where: { activo: true }, orderBy: { horaInicio: 'asc' } }),
    prisma.franjaLaboral.findMany({
      where: { activo: true },
      include: { diaSemana: true, horario: true },
    }),
  ])

  const ordenados = [...dias].sort(
    (a, b) => deLunesADomingo(a.numero) - deLunesADomingo(b.numero),
  )

  const abiertas = new Set(laborales.map((l) => `${l.diaSemana.hash}|${l.horario.hash}`))
  const diasQueAbren = [...new Set(laborales.map((l) => l.diaSemana.numero))]

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Días laborales</h1>
      <p className="silencio">
        Qué días abre la alberca y en qué horario. Se arma cruzando{' '}
        <Link href="/panel/admin/dias">Días</Link> con{' '}
        <Link href="/panel/admin/horarios">Horarios</Link>: aquí solo aparecen los que
        estén activos en esas dos pantallas.
      </p>

      {laborales.length > 0 && (
        <p className="silencio">
          Abre <strong>{resumenDias(diasQueAbren)}</strong> ·{' '}
          <strong>{laborales.length}</strong> franjas abiertas en la semana.
        </p>
      )}

      <Parrilla
        dias={ordenados.map((d) => ({
          hash: d.hash,
          nombre: d.nombre,
          corto: d.nombre.slice(0, 3),
        }))}
        franjas={franjas.map((f) => ({
          hash: f.hash,
          horaInicio: f.horaInicio,
          horaFin: f.horaFin,
        }))}
        abiertas={abiertas}
        alternar={alternarFranjaLaboral}
      />

      {franjas.length === 0 && (
        <div className="tarjeta">
          <p className="silencio" style={{ margin: 0 }}>
            No hay franjas activas. Prende las que ocupes en{' '}
            <Link href="/panel/admin/horarios">Horarios</Link>.
          </p>
        </div>
      )}

      <p className="silencio" style={{ fontSize: '.82rem' }}>
        Esto es el <strong>marco</strong>: lo que la alberca puede ofrecer. Los cursos se
        agendan dentro de él en{' '}
        <Link href="/panel/admin/rejilla">Días y horarios por curso</Link>. Una celda
        apagada nunca se borra, solo deja de estar abierta.
      </p>
    </>
  )
}
