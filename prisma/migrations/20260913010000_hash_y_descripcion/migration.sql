-- Identificador público para los endpoints: 24 caracteres al azar que se
-- crean junto con el registro y no cambian nunca. Lo que viaja en los
-- formularios es esto, jamás el id de la base: con el id en orden, quien ve
-- el 6 sabe que existe el 5 y puede pedirlo.
--
-- Y `descripcion`, libre y opcional, para anotar qué es cada renglón sin
-- ensuciar el nombre que ve el alumno.

ALTER TABLE "TipoCurso" ADD COLUMN "hash" TEXT;
-- Los renglones que ya existen estrenan hash aquí mismo.
UPDATE "TipoCurso" SET "hash" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24) WHERE "hash" IS NULL;
ALTER TABLE "TipoCurso" ALTER COLUMN "hash" SET NOT NULL;
CREATE UNIQUE INDEX "TipoCurso_hash_key" ON "TipoCurso"("hash");
ALTER TABLE "TipoCurso" ADD COLUMN "descripcion" TEXT;

ALTER TABLE "DiaSemana" ADD COLUMN "hash" TEXT;
-- Los renglones que ya existen estrenan hash aquí mismo.
UPDATE "DiaSemana" SET "hash" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24) WHERE "hash" IS NULL;
ALTER TABLE "DiaSemana" ALTER COLUMN "hash" SET NOT NULL;
CREATE UNIQUE INDEX "DiaSemana_hash_key" ON "DiaSemana"("hash");
ALTER TABLE "DiaSemana" ADD COLUMN "descripcion" TEXT;

ALTER TABLE "Horario" ADD COLUMN "hash" TEXT;
-- Los renglones que ya existen estrenan hash aquí mismo.
UPDATE "Horario" SET "hash" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24) WHERE "hash" IS NULL;
ALTER TABLE "Horario" ALTER COLUMN "hash" SET NOT NULL;
CREATE UNIQUE INDEX "Horario_hash_key" ON "Horario"("hash");
ALTER TABLE "Horario" ADD COLUMN "descripcion" TEXT;

ALTER TABLE "TipoPago" ADD COLUMN "hash" TEXT;
-- Los renglones que ya existen estrenan hash aquí mismo.
UPDATE "TipoPago" SET "hash" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24) WHERE "hash" IS NULL;
ALTER TABLE "TipoPago" ALTER COLUMN "hash" SET NOT NULL;
CREATE UNIQUE INDEX "TipoPago_hash_key" ON "TipoPago"("hash");
ALTER TABLE "TipoPago" ADD COLUMN "descripcion" TEXT;

ALTER TABLE "FrecuenciaPago" ADD COLUMN "hash" TEXT;
-- Los renglones que ya existen estrenan hash aquí mismo.
UPDATE "FrecuenciaPago" SET "hash" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24) WHERE "hash" IS NULL;
ALTER TABLE "FrecuenciaPago" ALTER COLUMN "hash" SET NOT NULL;
CREATE UNIQUE INDEX "FrecuenciaPago_hash_key" ON "FrecuenciaPago"("hash");
ALTER TABLE "FrecuenciaPago" ADD COLUMN "descripcion" TEXT;
