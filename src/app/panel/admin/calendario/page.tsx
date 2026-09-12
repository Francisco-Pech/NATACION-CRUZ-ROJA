import Link from 'next/link'
import { prisma } from '@/lib/db'
import {
  festivosQueCuentan,
  coberturaDelAnio,
  avisoDeCalendario,
} from '@/lib/dias-inhabiles'
import Catalogo from '../catalogo/Catalogo'
import type { Campo } from '../catalogo/tipos'
import { guardarDiaInhabil, eliminarDiaInhabil } from './acciones'

const TIPOS = [
  { valor: 'DIA_INHABIL', etiqueta: 'Día Inhábil' },
  { valor: 'PERIODO_VACACIONAL', etiqueta: 'Periodo Vacacional' },
  { valor: 'EXCEPCION', etiqueta: 'Excepción' },
]

const CAMPOS: Campo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', ancho: 200, placeholder: 'Semana Santa' },
  { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'lista', ancho: 170, opciones: TIPOS },
  { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha', ancho: 150 },
  { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha', ancho: 150, opcional: true },
  { nombre: 'cadaAnio', etiqueta: 'Cada año', tipo: 'casilla', ancho: 90 },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', opcional: true, placeholder: 'Nota para ustedes' },
]

/** El valor que espera un <input type="date">. */
const enFormulario = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default async function Calendario() {
  const anioActual = new Date().getFullYear()

  // Los años que ya pasaron no se muestran: no sirven para nada y ensucian
  // la lista. Lo mínimo es el año en curso.
  const registros = await prisma.diaInhabil.findMany({
    where: { hasta: { gte: new Date(anioActual, 0, 1) } },
    orderBy: { desde: 'asc' },
  })

  // Primero lo que viene: lo que ya pasó este año se queda abajo. Al abrir
  // la pantalla, lo de arriba es lo próximo, no el 1.º de enero.
  const hoy = new Date()
  const porVenir = registros.filter((r) => r.hasta >= hoy)
  const yaPasaron = registros.filter((r) => r.hasta < hoy).reverse()
  const enOrden = [...porVenir, ...yaPasaron]

  const corrrenLaFecha = festivosQueCuentan(registros, anioActual).length

  // Se mira este año y los dos que siguen: sirve para avisar en noviembre
  // que al año entrante le falta calendario, no en enero cuando ya salió mal.
  const todoElCalendario = await prisma.diaInhabil.findMany()
  const cobertura = [0, 1, 2].map((mas) => ({
    anio: anioActual + mas,
    ...coberturaDelAnio(todoElCalendario, anioActual + mas),
  }))
  const aviso = avisoDeCalendario(new Date(), cobertura[0], cobertura[1])
  // Qué capturar, en palabras: el aviso dice que falta, esto dice qué.
  const porCapturar = (c: (typeof cobertura)[number]) =>
    [
      c.movibles === 0 && 'los festivos que se mueven (Constitución, Juárez, Revolución)',
      c.periodos === 0 && 'Semana Santa y las vacaciones de fin de año',
    ].filter(Boolean) as string[]

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Días inhábiles</h1>
      <p className="silencio">
        Los días en que no se trabaja: festivos, temporadas de cierre y excepciones
        sueltas. Hoy hay <strong>{corrrenLaFecha}</strong> días que corren la fecha
        límite de pago.
      </p>
      <p className="silencio" style={{ fontSize: '.82rem', marginTop: '-.4rem' }}>
        Arriba va lo que viene; lo que ya pasó este año queda al final.
      </p>

      {aviso && (
        <div className={aviso.nivel === 'urgente' ? 'error' : 'aviso'} role="alert">
          <strong>{aviso.texto}</strong>
          {(() => {
            const c = aviso.texto.includes(String(anioActual)) ? cobertura[0] : cobertura[1]
            const falta = porCapturar(c)
            return falta.length === 0 ? null : (
              <p style={{ margin: '.4rem 0 0' }}>
                Hay que capturar para <strong>{c.anio}</strong>: {falta.join(', y ')}. Los de
                fecha fija ya están puestos y no se tocan.
              </p>
            )
          })()}
        </div>
      )}

      <div className="tarjeta">
        <h2>Qué falta capturar</h2>
        <p className="silencio" style={{ fontSize: '.88rem', marginTop: 0 }}>
          Los de <strong>fecha fija</strong> ya están y valen para siempre: no hay que
          volver a tocarlos. Los que <strong>se mueven</strong> —Constitución, Juárez,
          Revolución, Semana Santa— y los <strong>periodos vacacionales</strong> caen
          distinto cada año, así que hay que capturarlos a mano.
        </p>

        <div className="tabla-ancha">
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>Año</th>
                <th style={{ width: 110 }}>Fecha fija</th>
                <th style={{ width: 130 }}>Que se mueven</th>
                <th style={{ width: 110 }}>Periodos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cobertura.map((c) => (
                <tr key={c.anio}>
                  <td><strong>{c.anio}</strong></td>
                  <td className="silencio">{c.fijos}</td>
                  <td className={c.movibles === 0 ? 'falta' : undefined}>{c.movibles}</td>
                  <td className={c.periodos === 0 ? 'falta' : undefined}>{c.periodos}</td>
                  <td>
                    {c.completo ? (
                      <span className="insignia VERDE">Listo</span>
                    ) : (
                      <span className="insignia AMARILLO">
                        Falta capturar {porCapturar(c).join(', y ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Catalogo
        campos={CAMPOS}
        guardar={guardarDiaInhabil}
        eliminar={eliminarDiaInhabil}
        tituloAlta="Agregar al calendario"
        botonAlta="Agregar"
        vacio="Nada capturado de este año en adelante."
        renglones={enOrden.map((r) => ({
          hash: r.hash,
          soloDesactivar: false,
          valores: {
            nombre: r.nombre,
            tipo: r.tipo,
            desde: enFormulario(r.desde),
            hasta: enFormulario(r.hasta),
            cadaAnio: r.cadaAnio,
            descripcion: r.descripcion ?? '',
          },
        }))}
      />

      <div className="tarjeta">
        <h2>Qué significa cada tipo</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ width: 190 }}><strong>Día Inhábil</strong></td>
              <td>
                Festivo oficial. <strong>Sí corre la fecha límite de pago</strong>: ese día
                no hay quien cobre ni banco que reciba, así que el 5.º día hábil se recorre.
              </td>
            </tr>
            <tr>
              <td><strong>Periodo Vacacional</strong></td>
              <td>
                La alberca cierra —Semana Santa, fin de año, mantenimiento— pero
                <strong> la mensualidad se cobra completa</strong> y la fecha límite no se
                mueve, tal como opera la delegación.
              </td>
            </tr>
            <tr>
              <td><strong>Excepción</strong></td>
              <td>
                Un cierre suelto que no encaja en los otros dos. Tampoco toca el cobro.
              </td>
            </tr>
          </tbody>
        </table>
        <p className="silencio" style={{ fontSize: '.82rem', marginBottom: 0 }}>
          <strong>Cada año</strong> repite las mismas fechas siempre: sirve para los de
          fecha fija —Año Nuevo, Navidad—, que así se capturan una vez y valen para
          siempre. Los que se mueven, como Semana Santa o los lunes de puente, se
          capturan año por año porque cada año caen distinto.{' '}
          <strong>Hasta</strong> se puede dejar en blanco: son días sueltos. Para Semana
          Santa se pone el rango completo y es un solo renglón en vez de siete. Los años
          que ya pasaron no se muestran ni se pueden capturar. Borrar del calendario es de
          Root, porque mueve fechas límite hacia atrás.
        </p>
      </div>
    </>
  )
}
