import {
  Stack, Typography, Card, CardContent, Table, TableHead, TableRow, TableCell,
  TableBody, Button, Alert, Chip,
} from '@mui/material'
import { prisma } from '@/lib/db'
import { periodoActual } from '@/lib/periodo-actual'
import { pesos, MESES } from '@/lib/formato'
import { resolverComprobante } from '../acciones'
import { EstadoPago } from '@prisma/client'

export default async function Pagos() {
  const actual = await periodoActual()
  if (!actual) return <Alert severity="warning">No hay un ciclo abierto.</Alert>

  const porValidar = await prisma.pago.findMany({
    where: { estado: EstadoPago.EN_REVISION },
    include: { cargo: { include: { inscripcion: { include: { alumno: true } }, periodo: true } } },
    orderBy: { fechaPago: 'desc' },
  })

  const recientes = await prisma.pago.findMany({
    where: { cargo: { periodoId: actual.periodo.id }, estado: EstadoPago.CONFIRMADO },
    include: {
      cargo: { include: { inscripcion: { include: { alumno: true } } } },
      registradoPor: { select: { nombre: true } },
    },
    orderBy: { fechaPago: 'desc' },
    take: 50,
  })

  return (
    <Stack spacing={3}>
      <h1>Pagos · {MESES[actual.periodo.mes - 1]} {actual.ciclo.anio}</h1>

      <Card>
        <CardContent>
          <h2>
            Comprobantes por validar
            {porValidar.length > 0 && <Chip size="small" color="info" label={porValidar.length} sx={{ ml: 1 }} />}
          </h2>
          {porValidar.length === 0 ? (
            <Typography color="text.secondary">No hay comprobantes esperando revisión.</Typography>
          ) : (
            <div className="tabla-ancha">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Alumno</TableCell>
                    <TableCell>Mes</TableCell>
                    <TableCell>Método</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell>Referencia</TableCell>
                    <TableCell align="right">Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {porValidar.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.cargo.inscripcion.alumno.nombreCompleto}</TableCell>
                      <TableCell>{MESES[p.cargo.periodo.mes - 1]}</TableCell>
                      <TableCell>{p.metodo}</TableCell>
                      <TableCell align="right">{pesos(p.montoCobrado)}</TableCell>
                      <TableCell>{p.referencia ?? '—'}</TableCell>
                      <TableCell align="right">
                        <form action={resolverComprobante} style={{ display: 'inline-flex', gap: 8 }}>
                          <input type="hidden" name="pagoId" value={p.id} />
                          <Button type="submit" name="accion" value="aprobar" size="small" variant="contained" color="success">
                            Aprobar
                          </Button>
                          <Button type="submit" name="accion" value="rechazar" size="small" variant="outlined" color="error">
                            Rechazar
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2>Pagos del mes</h2>
        </CardContent>
        <div className="tabla-ancha">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Alumno</TableCell>
                <TableCell>Método</TableCell>
                <TableCell align="right">Cobrado</TableCell>
                <TableCell align="right">Comisión</TableCell>
                <TableCell align="right">Neto</TableCell>
                <TableCell>Registró</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recientes.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{p.fechaPago.toLocaleDateString('es-MX')}</TableCell>
                  <TableCell>{p.cargo.inscripcion.alumno.nombreCompleto}</TableCell>
                  <TableCell>{p.metodo}</TableCell>
                  <TableCell align="right">{pesos(p.montoCobrado)}</TableCell>
                  <TableCell align="right">{p.montoComision ? pesos(p.montoComision) : '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{pesos(p.montoNeto)}</TableCell>
                  <TableCell>{p.registradoPor?.nombre ?? '—'}</TableCell>
                </TableRow>
              ))}
              {recientes.length === 0 && (
                <TableRow><TableCell colSpan={7}>
                  <Typography color="text.secondary">Aún no hay pagos este mes.</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </Stack>
  )
}
