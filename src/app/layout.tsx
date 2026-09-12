import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Natación — Cruz Roja Cancún',
  description: 'Control de mensualidades de la escuela de natación',
}

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  const anio = new Date().getFullYear()

  return (
    <html lang="es-MX">
      <body>
        <div className="envoltura">
          <div className="cuerpo">{children}</div>

          <footer className="pie no-imprimir">
            <p>
              Todos los derechos reservados para la <strong>Cruz Roja Mexicana</strong>,
              Delegación Cancún. Queda prohibida su venta.
            </p>
            <p className="pie-anio">© {anio}</p>
          </footer>
        </div>
      </body>
    </html>
  )
}
