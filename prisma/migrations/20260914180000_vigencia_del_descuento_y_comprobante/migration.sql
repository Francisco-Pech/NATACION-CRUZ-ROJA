-- Hasta cuándo le dura el descuento a este alumno.
--
-- Va en la inscripción y no en el catálogo porque son dos preguntas
-- distintas: el catálogo dice qué es "Cortesía" y cuánto rebaja; esto dice
-- desde y hasta cuándo se le reconoce a esta persona. Una cortesía de un
-- día y un INAPAM de por vida son el mismo descuento del catálogo con
-- vigencias distintas.
--
-- Las dos en nulo quieren decir "sin límite", que es lo que tienen todas las
-- inscripciones de hoy: así nadie pierde un descuento por esta migración.
ALTER TABLE "Inscripcion" ADD COLUMN "descuentoDesde" TIMESTAMP(3);
ALTER TABLE "Inscripcion" ADD COLUMN "descuentoHasta" TIMESTAMP(3);

-- El comprobante del mes, guardado aquí y no en una carpeta.
--
-- Cuelga del cargo y no del pago porque lo sube el alumno desde su página,
-- cuando todavía no existe ningún pago: la persona pagó en OXXO o hizo la
-- transferencia, sube su ticket, y el cobro tarda en reflejarse. Quien está
-- en el mostrador lo ve ahí y anota el pago sabiendo que hay con qué
-- respaldarlo.
--
-- El archivo va en la base, igual que la constancia fiscal, para que solo se
-- llegue a él por una ruta que exige sesión: un comprobante de transferencia
-- trae nombre y banco de quien pagó, y en una carpeta servida por el
-- servidor web bastaría con adivinar el nombre del archivo.
ALTER TABLE "Cargo" ADD COLUMN "comprobanteImagen" BYTEA;
ALTER TABLE "Cargo" ADD COLUMN "comprobanteTipo" TEXT;
ALTER TABLE "Cargo" ADD COLUMN "comprobanteNombre" TEXT;
ALTER TABLE "Cargo" ADD COLUMN "comprobanteSubidoEn" TIMESTAMP(3);
