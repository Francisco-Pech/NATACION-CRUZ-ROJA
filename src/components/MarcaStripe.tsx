/**
 * "Lo cobra Stripe", dicho donde se ve.
 *
 * Quien está por teclear su tarjeta quiere saber quién va a recibirla, y
 * "Stripe" es un nombre que la gente reconoce de otras tiendas. Va con su
 * color de marca para que se lea como lo que es: el procesador, no un
 * adorno nuestro.
 *
 * Es el nombre en texto y no su logotipo: el archivo oficial lo reparte
 * Stripe en su kit de marca, y poner una imitación dibujada a mano sería
 * peor que no ponerlo.
 */
export function MarcaStripe({ children }: { children?: React.ReactNode }) {
  return (
    <p className="marca-stripe">
      <span className="marca-stripe-sello" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v5.5c0 4.3-2.9 8.3-7 9.5-4.1-1.2-7-5.2-7-9.5V6l7-3z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      </span>
      <span>
        {children ?? <>El cobro lo procesa <strong>Stripe</strong>.</>}
      </span>
    </p>
  )
}
