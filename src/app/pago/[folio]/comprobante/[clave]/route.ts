import { prisma } from '@/lib/db'
import { normalizarFolio } from '@/lib/folio'

/**
 * El comprobante que subió el alumno para un mes.
 *
 * Se sirve por el folio y la clave del periodo —"2026-09"— y no por el id
 * del cargo: ningún id de la base tiene por qué salir a una dirección que
 * la gente ve y comparte.
 *
 * Es su propio archivo: lo subió él para respaldar su pago, y poder
 * abrirlo es cómo comprueba que mandó el correcto y no la foto equivocada.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ folio: string; clave: string }> },
) {
  const { folio, clave } = await params

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { folio: normalizarFolio(folio) },
    select: { alumnoId: true },
  })
  if (!inscripcion) return new Response('No encontrado.', { status: 404 })

  // Contra el alumno y no contra la inscripción: quien estuvo inscrito dos
  // años tiene dos folios, y su comprobante de 2025 sigue siendo suyo.
  const cargo = await prisma.cargo.findFirst({
    where: {
      inscripcion: { alumnoId: inscripcion.alumnoId },
      periodo: { clave },
      comprobanteImagen: { not: null },
    },
    select: { comprobanteImagen: true, comprobanteTipo: true, comprobanteNombre: true },
  })

  const archivo = cargo?.comprobanteImagen
  if (!archivo) return new Response('No hay comprobante de ese mes.', { status: 404 })

  return new Response(new Uint8Array(archivo), {
    headers: {
      'Content-Type': cargo.comprobanteTipo || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${
        cargo.comprobanteNombre?.replace(/[^\w.\- ]/g, '') || 'comprobante'
      }"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
