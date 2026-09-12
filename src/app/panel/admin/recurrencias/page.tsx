import Link from 'next/link'
import { prisma } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import { esRoot } from '@/lib/roles'
import Catalogo from '../catalogo/Catalogo'
import type { Campo } from '../catalogo/tipos'
import { guardarRecurrencia, eliminarRecurrencia } from '../catalogos'

const CAMPOS: Campo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', ancho: 200, placeholder: 'Bimestral' },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', opcional: true, placeholder: 'Nota para ustedes' },
  { nombre: 'meses', etiqueta: 'Meses', tipo: 'numero', ancho: 100, min: 1, max: 120 },
  { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla', ancho: 80 },
]

export default async function Recurrencias() {
  const soyRoot = esRoot(await leerSesion())
  const recurrencias = await prisma.frecuenciaPago.findMany({ orderBy: [{ meses: 'asc' }] })

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Recurrencia de Pago</h1>
      <p className="silencio">Cada cuánto se repite un cobro.</p>

      <Catalogo
        campos={CAMPOS}
        guardar={guardarRecurrencia}
        eliminar={eliminarRecurrencia}
        tituloAlta="Agregar una recurrencia"
        botonAlta="Agregar"
        vacio="Ninguna todavía."
        renglones={recurrencias.map((f) => ({
          hash: f.hash,
          soloDesactivar: !soyRoot,
          valores: {
            nombre: f.nombre,
            descripcion: f.descripcion ?? '',
            meses: f.meses,
            activo: f.activo,
          },
        }))}
      />

      <p className="silencio" style={{ fontSize: '.82rem' }}>
        <strong>Meses</strong> es cuántos meses cubre cada cobro: 1 mensual, 3 trimestral,
        6 semestral, 12 anual. Es el dato que usa el sistema para saber cuándo vuelve a
        tocar, y también es lo que ordena esta lista.
      </p>
    </>
  )
}
