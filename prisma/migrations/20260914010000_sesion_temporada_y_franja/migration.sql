-- Un renglón de "Días y horarios por curso" es el cruce de dos cosas que ya
-- se capturan por separado: una fecha por curso y un día laboral. Más su
-- cupo, sus extras y si está activo.
--
-- Se guarda cuál se escogió, no solo el resultado: con dos temporadas del
-- mismo curso, "Curso Adultos" no alcanza para saber a cuál pertenece el
-- renglón. El curso, el día y la hora se siguen guardando aparte porque de
-- ahí los leen las inscripciones y el motor de cobro.

ALTER TABLE "Sesion" ADD COLUMN "temporadaCursoId" TEXT;
ALTER TABLE "Sesion" ADD COLUMN "franjaLaboralId" TEXT;

-- Cada sesión estrena la temporada de su curso. Donde haya varias se toma
-- la primera; son datos viejos y el renglón se puede reasignar a mano.
UPDATE "Sesion" s
SET "temporadaCursoId" = (
  SELECT t."id" FROM "TemporadaCurso" t
  WHERE t."tipoCursoId" = s."tipoCursoId"
  ORDER BY t."desde" ASC LIMIT 1
);

-- Y la franja laboral que le corresponde, si la alberca abre ese día a esa
-- hora. Las que no —Guardavidas es sábado y hoy no se labora en sábado—
-- se quedan sin franja: el renglón existe, pero le falta escogerla.
UPDATE "Sesion" s
SET "franjaLaboralId" = (
  SELECT f."id" FROM "FranjaLaboral" f
  JOIN "DiaSemana" d ON d."id" = f."diaSemanaId"
  WHERE f."horarioId" = s."horarioId" AND d."numero" = s."diaSemana"
  LIMIT 1
);

ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_temporadaCursoId_fkey"
  FOREIGN KEY ("temporadaCursoId") REFERENCES "TemporadaCurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_franjaLaboralId_fkey"
  FOREIGN KEY ("franjaLaboralId") REFERENCES "FranjaLaboral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Sesion_temporadaCursoId_idx" ON "Sesion"("temporadaCursoId");
CREATE INDEX "Sesion_franjaLaboralId_idx" ON "Sesion"("franjaLaboralId");

-- El cupo y los extras son del renglón.
--
-- Estuvieron un rato en el curso: fue una lectura equivocada de lo que se
-- pidió. Van aquí, donde se pueden distinguir por hora, que era justo la
-- duda que no había que obligar a resolver de antemano.
ALTER TABLE "Sesion" ADD COLUMN "extras" INTEGER NOT NULL DEFAULT 10;

UPDATE "Sesion" s SET "cupoMaximo" = c."cupoMaximo"
FROM "TipoCurso" c WHERE c."id" = s."tipoCursoId" AND s."cupoMaximo" IS NULL;
UPDATE "Sesion" SET "cupoMaximo" = 35 WHERE "cupoMaximo" IS NULL;
UPDATE "Sesion" s SET "extras" = c."extras" FROM "TipoCurso" c WHERE c."id" = s."tipoCursoId";

ALTER TABLE "Sesion" ALTER COLUMN "cupoMaximo" SET NOT NULL;
ALTER TABLE "Sesion" ALTER COLUMN "cupoMaximo" SET DEFAULT 35;

ALTER TABLE "TipoCurso" DROP COLUMN "cupoMaximo";
ALTER TABLE "TipoCurso" DROP COLUMN "extras";
