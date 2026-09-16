-- La inscripción no lleva sus propias fechas.
--
-- `termina` se descartó: nadie captura hasta cuándo. Y la fecha inicial es
-- el día y la hora en que se creó el registro, que es exactamente lo que ya
-- guarda `creadoEn`. Dos columnas para el mismo dato se contradicen en
-- cuanto alguien toca una sola.
--
-- Se agregaron en la migración anterior de esta misma sesión y nunca
-- llegaron a producción: van vacías.
ALTER TABLE "Inscripcion" DROP COLUMN "inicia";
ALTER TABLE "Inscripcion" DROP COLUMN "termina";
