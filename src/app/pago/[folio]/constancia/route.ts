import { prisma } from '@/lib/db'
import { normalizarFolio } from '@/lib/folio'

/**
 * La constancia de situación fiscal que trae cargada el alumno.
 *
 * Se sirve por el folio, igual que el resto de esta pantalla: quien puede
 * ver sus adeudos puede ver el PDF que él mismo subió, y necesita poder
 * comprobar que cargó el archivo correcto antes de que le expidan un CFDI
 * con esos datos.
 *
 * Nunca como descarga forzada ni con nombre del sistema: va en línea, con
 * el nombre con que se subió. Y `noindex` por si algún día la dirección
 * acaba en un buscador.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ folio: string }> },
) {
  const { folio } = await params

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { folio: normalizarFolio(folio) },
    select: {
      alumno: {
        select: { constanciaPdf: true, constanciaNombre: true, factura: true },
      },
    },
  })

  const pdf = inscripcion?.alumno.constanciaPdf
  if (!pdf) return new Response('No hay constancia cargada.', { status: 404 })

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${
        inscripcion.alumno.constanciaNombre?.replace(/[^\w.\- ]/g, '') || 'constancia.pdf'
      }"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
