-- El correo de quien pide su lugar.
--
-- Es la única forma de avisarle que lo aceptaron: no pasa por la
-- delegación a preguntar, se le manda su folio y su código.
--
-- Nullable en la base, obligatorio en el formulario: las solicitudes que ya
-- existían no lo traen y no hay de dónde inventárselo.
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "correo" TEXT;

-- Cuándo se le avisó que quedó. Vacío: nunca salió el correo.
ALTER TABLE "SolicitudDeRegistro" ADD COLUMN "avisadoEn" TIMESTAMP(3);
