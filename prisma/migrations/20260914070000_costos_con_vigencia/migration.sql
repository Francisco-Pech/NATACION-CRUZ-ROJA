-- Los precios dejan de colgar del año y del mes: ahora cada monto trae el
-- tramo de fechas en el que rige.
--
-- Antes el precio del curso colgaba del ciclo anual, y el locker y el
-- recargo colgaban de cada mes: doce renglones con el mismo 100 y el mismo
-- 50, y para cambiar el locker había que editar los doce.

-- ---- Las tarifas de los cursos estrenan vigencia ----------------------
ALTER TABLE "Tarifa" ADD COLUMN "vigenciaDesde" TIMESTAMP(3);
ALTER TABLE "Tarifa" ADD COLUMN "vigenciaHasta" TIMESTAMP(3);

-- La que tenían implícita: el año completo de su ciclo.
UPDATE "Tarifa" t
SET "vigenciaDesde" = make_timestamp(c."anio", 1, 1, 0, 0, 0),
    "vigenciaHasta" = make_timestamp(c."anio", 12, 31, 23, 59, 59)
FROM "CicloAnual" c
WHERE c."id" = t."cicloAnualId";

ALTER TABLE "Tarifa" ALTER COLUMN "vigenciaDesde" SET NOT NULL;
ALTER TABLE "Tarifa" ALTER COLUMN "vigenciaHasta" SET NOT NULL;

ALTER TABLE "Tarifa" ADD COLUMN "hash" TEXT;
UPDATE "Tarifa" SET "hash" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24) WHERE "hash" IS NULL;
ALTER TABLE "Tarifa" ALTER COLUMN "hash" SET NOT NULL;
CREATE UNIQUE INDEX "Tarifa_hash_key" ON "Tarifa"("hash");

-- Dos precios del mismo curso pueden convivir si sus tramos no se pisan
-- —uno de 2026 y otro de 2027—, así que el índice viejo por ciclo ya no
-- aplica. Que no se encimen se revisa al guardar.
DROP INDEX IF EXISTS "Tarifa_cicloAnualId_tipoCursoId_tipoPagoId_frecuenciaId_key";

-- ---- Locker y recargo salen del mes -----------------------------------
CREATE TYPE "ConceptoCosto" AS ENUM ('LOCKER', 'RECARGO');

CREATE TABLE "Costo" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "concepto" "ConceptoCosto" NOT NULL,
    "monto" INTEGER NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Costo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Costo_hash_key" ON "Costo"("hash");
CREATE INDEX "Costo_concepto_vigenciaDesde_idx" ON "Costo"("concepto", "vigenciaDesde");

-- Se traen los que ya existían, un renglón por año y por monto distinto:
-- doce meses con el mismo 100 se vuelven un solo renglón de todo el año.
INSERT INTO "Costo" ("id", "hash", "concepto", "monto", "vigenciaDesde", "vigenciaHasta")
SELECT
  md5(random()::text || clock_timestamp()::text || c."anio"::text || v."monto"::text),
  substr(md5(random()::text || clock_timestamp()::text || c."anio"::text || v."monto"::text || v."concepto"), 1, 24),
  v."concepto"::"ConceptoCosto",
  v."monto",
  make_timestamp(c."anio", 1, 1, 0, 0, 0),
  make_timestamp(c."anio", 12, 31, 23, 59, 59)
FROM "CicloAnual" c
JOIN LATERAL (
  SELECT DISTINCT 'LOCKER' AS "concepto", p."precioLocker" AS "monto"
  FROM "Periodo" p WHERE p."cicloAnualId" = c."id" AND p."precioLocker" > 0
  UNION
  SELECT DISTINCT 'RECARGO', p."recargo"
  FROM "Periodo" p WHERE p."cicloAnualId" = c."id" AND p."recargo" > 0
) v ON true;
