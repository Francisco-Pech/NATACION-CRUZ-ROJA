import Link from 'next/link'
import { prisma } from '@/lib/db'
import Catalogo from '../catalogo/Catalogo'
import type { Campo } from '../catalogo/tipos'
import { guardarTipoPago, eliminarTipoPago } from '../catalogos'

const CAMPOS: Campo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', ancho: 220, placeholder: 'Pago único' },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', opcional: true, placeholder: 'Nota para ustedes' },
  { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla', ancho: 80 },
]

export default async function TiposDePago() {
  const tipos = await prisma.tipoPago.findMany({ orderBy: [{ clave: 'asc' }] })

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Tipo de Pago</h1>
      <p className="silencio">Si el cobro se hace una sola vez o se repite.</p>

      <Catalogo
        campos={CAMPOS}
        guardar={guardarTipoPago}
        eliminar={eliminarTipoPago}
        tituloAlta="Agregar un tipo de pago"
        botonAlta="Agregar"
        vacio="Ninguno todavía."
        renglones={tipos.map((t) => ({
          hash: t.hash,
          // Un tipo de pago nunca se borra: el botón solo apaga.
          soloDesactivar: true,
          valores: { nombre: t.nombre, descripcion: t.descripcion ?? '', activo: t.activo },
        }))}
      />

      <p className="silencio" style={{ fontSize: '.82rem' }}>
        El <strong>Nombre</strong> se puede cambiar cuando quieras. La
        <strong> Descripción</strong> es una nota para ustedes. Uno
        <strong> nunca se borra</strong>, solo se prende o se apaga: los precios ya
        puestos lo nombran.
      </p>
    </>
  )
}
