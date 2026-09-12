import Link from 'next/link'
import { prisma } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import { esRoot } from '@/lib/roles'
import Catalogo from '../catalogo/Catalogo'
import type { Campo } from '../catalogo/tipos'
import { guardarDiaSemana, eliminarDiaSemana } from '../catalogos'

const CAMPOS: Campo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', ancho: 200, placeholder: 'Lunes' },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', opcional: true, placeholder: 'Nota para ustedes' },
  { nombre: 'numero', etiqueta: 'Día del calendario', tipo: 'numero', ancho: 150, min: 0, max: 6 },
  { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla', ancho: 80 },
]

/** De lunes a domingo, que es como los lee la gente. Sale del número del
 *  calendario —donde domingo es 0— sin guardar un campo de orden aparte. */
const deLunesADomingo = (numero: number) => (numero + 6) % 7

export default async function Dias() {
  const soyRoot = esRoot(await leerSesion())
  const dias = (await prisma.diaSemana.findMany()).sort(
    (a, b) => deLunesADomingo(a.numero) - deLunesADomingo(b.numero),
  )

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Días</h1>
      <p className="silencio">Los días en que abre la alberca.</p>

      <Catalogo
        campos={CAMPOS}
        guardar={guardarDiaSemana}
        eliminar={eliminarDiaSemana}
        tituloAlta="Agregar un día"
        botonAlta="Agregar"
        vacio="Ningún día todavía."
        renglones={dias.map((d) => ({
          hash: d.hash,
          soloDesactivar: !soyRoot,
          valores: {
            nombre: d.nombre,
            descripcion: d.descripcion ?? '',
            numero: d.numero,
            activo: d.activo,
          },
        }))}
      />

      <p className="silencio" style={{ fontSize: '.82rem' }}>
        <strong>Día del calendario</strong> es el número con el que el sistema conoce
        al día: <strong>domingo 0</strong>, lunes 1, martes 2, miércoles 3, jueves 4,
        viernes 5, <strong>sábado 6</strong>. Es lo que amarra este renglón con las
        clases que se marcan para ese día, y de ahí sale el orden de la lista.
      </p>
    </>
  )
}
