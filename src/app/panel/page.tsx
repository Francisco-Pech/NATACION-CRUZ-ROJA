import Link from 'next/link'
import { prisma } from '@/lib/db'
import { pesos, nombreMes, fechaLarga } from '@/lib/formato'
import { generarCargosDelPeriodo, aplicarRecargosVencidos } from '@/lib/servicios/periodos'
import { revalidatePath } from 'next/cache'

async function generar(datos: FormData) {
  'use server'
  const periodoId = String(datos.get('periodoId'))
  await generarCargosDelPeriodo(periodoId)
  await aplicarRecargosVencidos(periodoId)
  revalidatePath('/panel')
}

export default async function Tablero() {
  const hoy = new Date()
  const clave = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  const periodo = await prisma.periodo.findUnique({
    where: { clave },
    include: { cargos: { include: { pagos: true } } },
  })

  if (!periodo) {
    return (
      <>
        <h1>Tablero</h1>
        <div className="aviso">
          No hay un periodo dado de alta para {nombreMes(hoy.getMonth() + 1)} de {hoy.getFullYear()}.
        </div>
      </>
    )
  }

  const cargos = periodo.cargos
  const esperado = cargos.reduce((s, c) => s + c.montoNeto, 0)
  const cobrado = cargos.reduce(
    (s, c) => s + c.pagos.filter((p) => p.estado === 'CONFIRMADO').reduce((t, p) => t + p.montoNeto, 0),
    0,
  )
  const comisiones = cargos.reduce(
    (s, c) => s + c.pagos.filter((p) => p.estado === 'CONFIRMADO').reduce((t, p) => t + p.montoComision, 0),
    0,
  )
  const pagados = cargos.filter((c) => c.estado === 'PAGADO').length
  const vencidos = cargos.filter((c) => c.estado === 'VENCIDO').length

  return (
    <>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <h1>{nombreMes(periodo.mes)} {hoy.getFullYear()}</h1>
        <span className="silencio">Fecha límite: {fechaLarga(periodo.fechaLimite)}</span>
      </div>

      {cargos.length === 0 ? (
        <div className="tarjeta">
          <h2>Todavía no se generan los cargos de este mes</h2>
          <p className="silencio">
            Al generarlos, cada alumno inscrito recibe su estado de cuenta con la mensualidad
            de su categoría y los lockers que tenga asignados.
          </p>
          <form action={generar}>
            <input type="hidden" name="periodoId" value={periodo.id} />
            <button className="boton" type="submit">Generar cargos de {nombreMes(periodo.mes)}</button>
          </form>
        </div>
      ) : (
        <>
          <div className="rejilla">
            <div className="tarjeta dato">
              <div className="etiqueta">Esperado</div>
              <div className="valor monto">{pesos(esperado)}</div>
            </div>
            <div className="tarjeta dato">
              <div className="etiqueta">Cobrado</div>
              <div className="valor monto" style={{ color: 'var(--verde)' }}>{pesos(cobrado)}</div>
            </div>
            <div className="tarjeta dato">
              <div className="etiqueta">Falta por cobrar</div>
              <div className="valor monto">{pesos(esperado - cobrado)}</div>
            </div>
            <div className="tarjeta dato">
              <div className="etiqueta">Pagado en comisiones</div>
              <div className="valor monto">{pesos(comisiones)}</div>
            </div>
          </div>

          <div className="tarjeta">
            <div className="fila" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{pagados}</strong> al corriente ·{' '}
                <strong>{cargos.length - pagados}</strong> pendientes ·{' '}
                <strong style={{ color: '#b91c1c' }}>{vencidos}</strong> vencidos
              </div>
              <Link className="boton tenue" href="/panel/pagos">Ver cobranza</Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
