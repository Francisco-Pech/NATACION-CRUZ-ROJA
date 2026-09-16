import 'dotenv/config'
import { PrismaClient, EstadoCargo, EstadoInscripcion, MetodoPago } from '@prisma/client'
import { registrarPago } from '../src/lib/servicios/pagos.ts'
import { hoyEnCancun } from '../src/lib/zona.ts'

const prisma = new PrismaClient()

/**
 * Da por pagado el mes en curso de todos los alumnos activos.
 *
 * Es para arrancar en octubre con la casa al día: quien ya estaba
 * inscrito pagó su septiembre en la ventanilla, y de ahí en adelante el
 * sistema sigue solo. Sin esto, el primer mes aparecería debiéndose y
 * nadie podría entrar a clase ni sacar credencial.
 *
 * Se anota como efectivo en recepción, que es como se cobró de verdad, y
 * queda registrado a nombre de la cuenta de Root: los pagos llevan quién
 * los registró, y un pago sin dueño no se podría auditar después.
 *
 * Solo toca el mes en curso, y solo lo que esté pendiente: un mes ya
 * pagado no se cobra dos veces, y lo cancelado se respeta. Se puede
 * correr las veces que haga falta.
 *
 * Para dar por pagado otro mes en vez del actual:
 *   MES=2026-10 npx tsx prisma/seed-pagado.ts
 */
async function main() {
  const clave = process.env.MES?.trim() || hoyEnCancun().slice(0, 7)

  const periodo = await prisma.periodo.findUnique({
    where: { clave },
    include: { ciclo: { select: { anio: true } } },
  })
  if (!periodo) {
    console.log(`  ⚠  No existe el periodo ${clave}. Corre primero el seeder principal.`)
    return
  }

  // Los pagos guardan quién los registró. Se usa la cuenta de Root, que es
  // la única que existe en un sistema recién sembrado.
  const quienRegistra = await prisma.usuario.findFirst({
    where: { activo: true, ...(process.env.ROOT_EMAIL ? { email: process.env.ROOT_EMAIL } : {}) },
    select: { id: true, nombre: true, email: true },
  })
  if (!quienRegistra) {
    console.log('  ⚠  No hay ningún usuario activo a quien atribuirle los pagos.')
    return
  }

  const cargos = await prisma.cargo.findMany({
    where: {
      periodoId: periodo.id,
      estado: { in: [EstadoCargo.PENDIENTE, EstadoCargo.VENCIDO] },
      inscripcion: { estado: EstadoInscripcion.ACTIVA },
    },
    include: {
      inscripcion: { include: { alumno: { select: { nombreCompleto: true } } } },
      pagos: { select: { montoNeto: true, estado: true } },
    },
  })

  console.log(`Dando por pagado ${clave} · lo registra ${quienRegistra.nombre}`)

  if (cargos.length === 0) {
    console.log('  No hay ningún mes pendiente de ese periodo.')
    return
  }

  for (const cargo of cargos) {
    // Lo que ya haya entrado no se cobra otra vez: se paga lo que falta.
    const yaPagado = cargo.pagos
      .filter((p) => p.estado === 'CONFIRMADO')
      .reduce((suma, p) => suma + p.montoNeto, 0)
    const falta = cargo.montoNeto - yaPagado
    if (falta <= 0) continue

    await registrarPago({
      cargoId: cargo.id,
      metodo: MetodoPago.EFECTIVO,
      montoCobrado: falta,
      registradoPorId: quienRegistra.id,
    })

    console.log(
      `  ${cargo.inscripcion.alumno.nombreCompleto} (${cargo.inscripcion.folio}): ` +
        `$${(falta / 100).toFixed(2)}`,
    )
  }

  const pendientes = await prisma.cargo.count({
    where: { periodoId: periodo.id, estado: { not: EstadoCargo.PAGADO } },
  })
  console.log(`Listo. Quedan ${pendientes} sin pagar de ${clave}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
