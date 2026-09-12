-- El calendario pasa de dos tablas a una.
--
-- Antes había `DiaInhabil` (un día suelto que corría la fecha límite) y
-- `PeriodoSinClases` (un rango informativo). Son lo mismo con distinto
-- significado, así que ahora es una tabla con `tipo` y siempre un rango.
-- Lo que decide si corre la fecha límite es el tipo, no la tabla.

CREATE TYPE "TipoDiaInhabil" AS ENUM ('DIA_INHABIL', 'PERIODO_VACACIONAL', 'EXCEPCION');

ALTER TABLE "DiaInhabil" ADD COLUMN "hash" TEXT;
ALTER TABLE "DiaInhabil" ADD COLUMN "tipo" "TipoDiaInhabil" NOT NULL DEFAULT 'DIA_INHABIL';
ALTER TABLE "DiaInhabil" ADD COLUMN "nombre" TEXT;
ALTER TABLE "DiaInhabil" ADD COLUMN "desde" TIMESTAMP(3);
ALTER TABLE "DiaInhabil" ADD COLUMN "hasta" TIMESTAMP(3);

-- Lo que ya estaba: la descripción era el nombre, y la fecha suelta se
-- vuelve un rango de un solo día.
UPDATE "DiaInhabil"
   SET "hash"  = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24),
       "nombre" = "descripcion",
       "desde"  = "fecha",
       "hasta"  = "fecha";

ALTER TABLE "DiaInhabil" ALTER COLUMN "descripcion" DROP NOT NULL;
UPDATE "DiaInhabil" SET "descripcion" = NULL;

-- Las temporadas sin clases se mudan aquí como periodo vacacional: cierran
-- la alberca pero no mueven la cobranza, igual que antes.
INSERT INTO "DiaInhabil" ("id", "hash", "tipo", "nombre", "descripcion", "desde", "hasta", "fecha")
SELECT "id",
       substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24),
       'PERIODO_VACACIONAL',
       "nombre",
       "motivo",
       "desde",
       "hasta",
       "desde"
  FROM "PeriodoSinClases";

ALTER TABLE "DiaInhabil" ALTER COLUMN "hash" SET NOT NULL;
ALTER TABLE "DiaInhabil" ALTER COLUMN "nombre" SET NOT NULL;
ALTER TABLE "DiaInhabil" ALTER COLUMN "desde" SET NOT NULL;
ALTER TABLE "DiaInhabil" ALTER COLUMN "hasta" SET NOT NULL;

-- `fecha` era única, y con rangos dos renglones pueden empezar el mismo día.
DROP INDEX IF EXISTS "DiaInhabil_fecha_key";
ALTER TABLE "DiaInhabil" DROP COLUMN "fecha";

CREATE UNIQUE INDEX "DiaInhabil_hash_key" ON "DiaInhabil"("hash");
CREATE INDEX "DiaInhabil_desde_idx" ON "DiaInhabil"("desde");

DROP TABLE "PeriodoSinClases";

-- Qué días abre la alberca y en qué franjas: el marco al que la rejilla de
-- cursos se tiene que apegar.
CREATE TABLE "FranjaLaboral" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "diaSemanaId" TEXT NOT NULL,
    "horarioId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FranjaLaboral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FranjaLaboral_hash_key" ON "FranjaLaboral"("hash");
CREATE UNIQUE INDEX "FranjaLaboral_diaSemanaId_horarioId_key" ON "FranjaLaboral"("diaSemanaId", "horarioId");

ALTER TABLE "FranjaLaboral" ADD CONSTRAINT "FranjaLaboral_diaSemanaId_fkey"
  FOREIGN KEY ("diaSemanaId") REFERENCES "DiaSemana"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FranjaLaboral" ADD CONSTRAINT "FranjaLaboral_horarioId_fkey"
  FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
