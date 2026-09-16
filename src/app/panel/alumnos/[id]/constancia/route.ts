import { prisma } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import { tienePermiso } from '@/lib/permisos'

/**
 * La constancia de situación fiscal de un alumno.
 *
 * El archivo vive en la base y solo sale por aquí. Es la única puerta, y
 * pide sesión antes de abrirla: la constancia trae RFC, régimen y domicilio
 * fiscal de una persona, y en una carpeta servida por el servidor web
 * bastaría con adivinar el nombre del archivo.
 *
 * Nunca se guarda en caché de disco ni de proxy: `private, no-store`. Un
 * documento así no debe quedar tirado en el caché de una máquina
 * compartida de recepción.
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await leerSesion()
  if (!tienePermiso(usuario, 'ALUMNOS')) {
    return new Response('No autorizado', { status: 403 })
  }

  const { id } = await params
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id },
    select: {
      alumno: {
        select: { nombreCompleto: true, constanciaPdf: true, constanciaNombre: true },
      },
    },
  })

  const pdf = inscripcion?.alumno.constanciaPdf
  if (!pdf) return new Response('Sin constancia', { status: 404 })

  // Se manda el nombre con el que se subió, pero limpio: un nombre con
  // comillas o saltos de línea puede partir la cabecera en dos.
  const nombre = (inscripcion.alumno.constanciaNombre ?? 'constancia.pdf')
    .replace(/[^\w.\- ]+/g, '_')
    .slice(0, 80)

  // Abrirla o guardarla son dos necesidades distintas: quien la revisa de
  // paso la quiere en una pestaña, y quien va a facturar la quiere en su
  // carpeta. Es la misma puerta con sesión; solo cambia la cabecera.
  const guardar = new URL(peticion.url).searchParams.has('descargar')

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${guardar ? 'attachment' : 'inline'}; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
      // Sin esto el navegador puede decidir por su cuenta que el archivo es
      // otra cosa y ejecutarlo como tal.
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
