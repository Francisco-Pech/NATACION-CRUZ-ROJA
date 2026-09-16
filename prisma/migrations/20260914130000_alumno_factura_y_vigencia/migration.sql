-- Lo que hace falta para dar de alta a un alumno desde recepción.
--
-- La inscripción gana sus fechas: entre cuándo y cuándo corre. Van vacías
-- en lo que ya existe —nadie las capturó— y la pantalla las exige de aquí
-- en adelante.
ALTER TABLE "Inscripcion" ADD COLUMN "inicia" TIMESTAMP(3);
ALTER TABLE "Inscripcion" ADD COLUMN "termina" TIMESTAMP(3);

-- El alumno gana el sí/no de la factura.
--
-- No se deduce de que traiga RFC: alguien puede haber dejado el RFC a
-- medias y eso no quiere decir que facture. Quien ya tenga RFC capturado
-- estrena el sí, que es lo que significaba hasta hoy.
ALTER TABLE "Alumno" ADD COLUMN "factura" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Alumno" SET "factura" = true WHERE "rfc" IS NOT NULL AND "rfc" <> '';

-- Y su constancia de situación fiscal.
--
-- El archivo se guarda aquí, en la base, y no en una carpeta del servidor:
-- es un documento privado —trae RFC, régimen y domicilio fiscal— y en la
-- base solo se llega a él por una ruta que exige sesión. Una carpeta se
-- respalda aparte, se puede quedar servida por el servidor web sin querer,
-- y se pierde al mover la máquina.
ALTER TABLE "Alumno" ADD COLUMN "constanciaPdf" BYTEA;
ALTER TABLE "Alumno" ADD COLUMN "constanciaNombre" TEXT;
ALTER TABLE "Alumno" ADD COLUMN "constanciaSubidaEn" TIMESTAMP(3);
