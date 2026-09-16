/**
 * Mandar un correo, si es que hay por dónde.
 *
 * Detrás de un adaptador y no pegado a un proveedor, por lo mismo que la
 * pasarela: hoy no hay servicio contratado, y el sistema tiene que funcionar
 * igual mientras tanto. Con `RESEND_API_KEY` en el .env sale por Resend —su
 * plan gratuito alcanza de sobra para avisos sueltos—; sin ella, esto
 * contesta que no pudo, y quien llama decide qué hacer.
 *
 * Va por HTTP a propósito, sin librería: una dependencia más en el proyecto
 * por tres campos de un JSON no se paga sola.
 */

export function hayCorreo(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

/** A quién se le avisa de lo que pasa en la escuela. */
export function correoDelAdministrador(): string | null {
  return process.env.ADMIN_EMAIL?.trim() || null
}

/** Quién firma. El de Resend para pruebas; el del dominio, en producción. */
const REMITENTE = () =>
  process.env.CORREO_REMITENTE?.trim() || 'Natación Cruz Roja <onboarding@resend.dev>'

export async function enviarCorreo(mensaje: {
  para: string
  asunto: string
  texto: string
}): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY?.trim()
  if (!clave) return false

  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: REMITENTE(),
        to: [mensaje.para],
        subject: mensaje.asunto,
        text: mensaje.texto,
      }),
    })
    return respuesta.ok
  } catch {
    // Que no salga el correo no puede tumbar lo que lo pidió: el recado ya
    // quedó guardado, que es lo que no se puede perder.
    return false
  }
}
