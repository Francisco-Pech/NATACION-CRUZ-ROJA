import Link from 'next/link'
import { prisma } from '@/lib/db'
import Catalogo from '../catalogo/Catalogo'
import type { Campo, Filtro } from '../catalogo/tipos'
import { guardarRol, desactivarRol } from './acciones'

/**
 * Los roles: qué puede hacer cada grupo de personas.
 *
 * Se crean los que hagan falta —un supervisor que vea cobranza pero no
 * toque precios— sin tocar el código. Los permisos, en cambio, son fijos:
 * cada uno corresponde a algo que de verdad se protege, e inventar uno aquí
 * no abriría nada, solo daría la impresión de que sí.
 */

const CAMPOS: Campo[] = [
  { nombre: 'nombre', etiqueta: 'Rol', tipo: 'texto', ancho: 220, placeholder: 'Supervisor' },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', opcional: true, placeholder: 'Qué hace esta persona' },
  { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla', ancho: 80 },
]

const FILTROS: Filtro[] = [
  {
    nombre: 'activo', etiqueta: 'Estado',
    opciones: [
      { valor: 'true', etiqueta: 'Activos' },
      { valor: 'false', etiqueta: 'Desactivados' },
    ],
  },
]

export default async function Roles() {
  const roles = await prisma.rol.findMany({
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })

  const renglones = roles.map((r) => ({
    hash: r.hash,
    // Nunca se borra: los usuarios que lo llevan lo siguen nombrando, y un
    // usuario sin rol no puede existir.
    soloDesactivar: true,
    valores: {
      nombre: r.nombre,
      descripcion: r.descripcion ?? '',
      activo: r.activo,
    },
  }))

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Roles</h1>
      <p className="silencio">
        Los grupos en los que se divide el personal.
      </p>

      <Catalogo
        campos={CAMPOS}
        renglones={renglones}
        filtros={FILTROS}
        guardar={guardarRol}
        eliminar={desactivarRol}
        tituloAlta="Crear un rol"
        botonAlta="Crear"
        vacio="Todavía no hay ningún rol."
      />

      <p className="silencio" style={{ fontSize: '.85rem' }}>
        Un rol <strong>no se borra, solo se desactiva</strong>, y no mientras alguien
        lo lleve puesto: nadie puede quedarse sin rol.
      </p>

    </>
  )
}
