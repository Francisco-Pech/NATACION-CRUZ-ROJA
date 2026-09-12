-- El orden de los tipos de pago no lo mantenía nadie a mano con criterio:
-- servía solo para desempatar cuando un curso tiene dos formas de cobro, y
-- para eso basta la clave, que es única y no se edita nunca.
ALTER TABLE "TipoPago" DROP COLUMN "orden";
