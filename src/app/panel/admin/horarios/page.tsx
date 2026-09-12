import Link from 'next/link'
import { prisma } from '@/lib/db'
import Catalogo from '../catalogo/Catalogo'
import type { Campo } from '../catalogo/tipos'
import { guardarHorario, eliminarHorario } from '../catalogos'

const CAMPOS: Campo[] = [
  { nombre: 'horaInicio', etiqueta: 'Inicia', tipo: 'hora', ancho: 110, fijo: true },
  { nombre: 'horaFin', etiqueta: 'Termina', tipo: 'hora', ancho: 110, fijo: true },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', opcional: true, placeholder: 'Nota para ustedes' },
  { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla', ancho: 80 },
]

export default async function Horarios() {
  const horarios = await prisma.horario.findMany({ orderBy: [{ horaInicio: 'asc' }] })

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Horarios</h1>
      <p className="silencio">Las franjas horarias que existen en la alberca.</p>

      <Catalogo
        campos={CAMPOS}
        guardar={guardarHorario}
        eliminar={eliminarHorario}
        tituloAlta="Agregar una franja"
        botonAlta="Agregar"
        vacio="Ninguna franja todavía."
        renglones={horarios.map((h) => ({
          hash: h.hash,
          // Una franja nunca se borra: el botón solo apaga.
          soloDesactivar: true,
          valores: {
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
            descripcion: h.descripcion ?? '',
            activo: h.activo,
          },
        }))}
      />

      <p className="silencio" style={{ fontSize: '.82rem' }}>
        Están las 24 horas del día. Las de la madrugada vienen apagadas: existen por si
        algún día hacen falta, pero no aparecen para agendar. Una franja
        <strong> nunca se borra</strong>, solo se prende o se apaga, porque las clases ya
        marcadas la nombran. Se ordenan solas por su hora de inicio, y las horas no se
        editan: son lo que identifica a la franja.
      </p>
    </>
  )
}
