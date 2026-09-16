-- Cuántos meses dura un curso para cada alumno.
--
-- Se agrega en dos pasos a propósito. Primero la columna sin valor por
-- omisión, para que nadie se quede sin la columna, y después el
-- predeterminado de 3 para los cursos que se creen de aquí en adelante.
ALTER TABLE "TipoCurso" ADD COLUMN "maxMeses" INTEGER;

UPDATE "TipoCurso" SET "maxMeses" = 3 WHERE "maxMeses" IS NULL;

ALTER TABLE "TipoCurso" ALTER COLUMN "maxMeses" SET DEFAULT 3;
