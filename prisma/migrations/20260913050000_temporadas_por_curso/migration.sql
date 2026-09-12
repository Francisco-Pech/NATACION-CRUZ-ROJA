-- Cuándo corre cada curso, con fechas y no con un sí/no.
--
-- `todoElAnio` decía si el curso corría los doce meses, pero no decía
-- cuándo sí. Lo reemplaza el modo —recurrente, único o mixto— más la tabla
-- de temporadas, que son los rangos de fechas reales.

CREATE TYPE "ModoFechaCurso" AS ENUM ('RECURRENTE', 'UNICO', 'MIXTO');

ALTER TABLE "TipoCurso" ADD COLUMN "modoFecha" "ModoFechaCurso" NOT NULL DEFAULT 'RECURRENTE';

CREATE TABLE "TemporadaCurso" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "tipoCursoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporadaCurso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemporadaCurso_hash_key" ON "TemporadaCurso"("hash");
CREATE INDEX "TemporadaCurso_tipoCursoId_idx" ON "TemporadaCurso"("tipoCursoId");

ALTER TABLE "TemporadaCurso" ADD CONSTRAINT "TemporadaCurso_tipoCursoId_fkey"
  FOREIGN KEY ("tipoCursoId") REFERENCES "TipoCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo que ya estaba: los cursos de todo el año estrenan su temporada de doce
-- meses. Los de temporada quedan sin fechas, para que las capturen.
INSERT INTO "TemporadaCurso" ("id", "hash", "tipoCursoId", "nombre", "desde", "hasta")
SELECT gen_random_uuid()::text,
       substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24),
       "id",
       'Todo el año',
       make_timestamp(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1, 12, 0, 0),
       make_timestamp(EXTRACT(YEAR FROM CURRENT_DATE)::int, 12, 31, 12, 0, 0)
  FROM "TipoCurso"
 WHERE "todoElAnio" = true;

ALTER TABLE "TipoCurso" DROP COLUMN "todoElAnio";
