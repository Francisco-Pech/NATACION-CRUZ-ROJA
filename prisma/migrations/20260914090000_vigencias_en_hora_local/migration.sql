-- Las vigencias que creó la migración anterior quedaron en hora UTC, y la
-- aplicación las escribe en hora de Cancún. Son las mismas fechas separadas
-- por cinco horas, y por eso el seeder no reconocía el renglón que ya
-- existía y sembraba uno duplicado.
--
-- Se normalizan a la hora local, que es la que usa la aplicación.

UPDATE "Costo"
SET "vigenciaDesde" = ("vigenciaDesde" AT TIME ZONE 'America/Cancun') AT TIME ZONE 'UTC',
    "vigenciaHasta" = ("vigenciaHasta" AT TIME ZONE 'America/Cancun') AT TIME ZONE 'UTC'
WHERE date_part('hour', "vigenciaDesde") = 0;

UPDATE "Tarifa"
SET "vigenciaDesde" = ("vigenciaDesde" AT TIME ZONE 'America/Cancun') AT TIME ZONE 'UTC',
    "vigenciaHasta" = ("vigenciaHasta" AT TIME ZONE 'America/Cancun') AT TIME ZONE 'UTC'
WHERE date_part('hour', "vigenciaDesde") = 0;

-- Y se van los duplicados que alcanzó a crear el seeder: se conserva el más
-- viejo de cada concepto y tramo.
DELETE FROM "Costo" c
WHERE EXISTS (
  SELECT 1 FROM "Costo" o
  WHERE o."concepto" = c."concepto"
    AND o."vigenciaDesde" = c."vigenciaDesde"
    AND o."vigenciaHasta" = c."vigenciaHasta"
    AND o."id" < c."id"
);
