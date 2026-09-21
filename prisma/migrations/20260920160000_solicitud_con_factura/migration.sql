-- La solicitud lleva lo mismo que el alta del mostrador, sin descuento.
-- El teléfono se va: no estaba en el formulario que se copió.
ALTER TABLE "SolicitudDeRegistro" DROP COLUMN "telefono";

ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "factura" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "rfc" TEXT;
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "razonSocial" TEXT;
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "codigoPostal" TEXT;
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "regimenFiscal" TEXT;
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "usoCfdi" TEXT;
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "correoFactura" TEXT;
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "constanciaPdf" BYTEA;
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "constanciaNombre" TEXT;
