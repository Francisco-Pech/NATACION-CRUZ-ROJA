import { prisma } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import { tienePermiso } from '@/lib/permisos'

/**
 * El comprobante que subió el alumno para el mes: la foto del ticket de OXXO
 * o el PDF de su transferencia.
 *
 * Igual que la constancia fiscal, el archivo vive en la base y solo sale por
 * aquí, pidiendo sesión antes de abrirlo. Un comprobante de transferencia
 * trae nombre y banco de quien pagó; en una carpeta servida por el servidor
 * web bastaría con adivinar el nombre del archivo.
 *
 * Lo pide con permiso de COBRAR y no de ALUMNOS: quien tiene que ver de
 * dónde salió el dinero es quien lo cobra.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ cargoId: string }> },
) {
  const usuario = await leerSesion()
  if (!tienePermiso(usuario, 'COBRAR')) {
    return new Response('No autorizado', { status: 403 })
  }

  const { cargoId } = await params
  const cargo = await prisma.cargo.findUnique({
    where: { id: cargoId },
    select: { comprobanteImagen: true, comprobanteTipo: true, comprobanteNombre: true },
  })

  const archivo = cargo?.comprobanteImagen
  if (!archivo || !cargo.comprobanteTipo) return new Response('Sin comprobante', { status: 404 })

  // El nombre con el que se subió, pero limpio: uno con comillas o saltos de
  // línea puede partir la cabecera en dos.
  const nombre = (cargo.comprobanteNombre ?? 'comprobante')
    .replace(/[^\w.\- ]+/g, '_')
    .slice(0, 80)

  return new Response(new Uint8Array(archivo), {
    headers: {
      'Content-Type': cargo.comprobanteTipo,
      'Content-Disposition': `inline; filename="${nombre}"`,
      // Un documento así no debe quedar tirado en el caché de la máquina
      // compartida de recepción.
      'Cache-Control': 'private, no-store',
      // Sin esto el navegador puede decidir por su cuenta que el archivo es
      // otra cosa y ejecutarlo como tal.
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
