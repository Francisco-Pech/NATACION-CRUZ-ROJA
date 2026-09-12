-- El cupo pasa a ser del curso.
--
-- Estaba en cada sesión: 79 renglones para mantener tres números distintos,
-- y al fondo de la pantalla, donde nadie lo encontraba. Ahora el número vive
-- en el curso y la sesión solo lleva el suyo si de verdad es distinto.
--
-- Se deja la puerta abierta a que varíe por hora —nadie sabe todavía si la
-- alberca aguanta lo mismo a las 6 que a las 10— sin obligar a decidirlo hoy.

ALTER TABLE "TipoCurso" ADD COLUMN "cupoMaximo" INTEGER NOT NULL DEFAULT 35;
ALTER TABLE "TipoCurso" ADD COLUMN "extras" INTEGER NOT NULL DEFAULT 10;

-- Cada curso se queda con el cupo que ya tenían sus sesiones. El 35 es el
-- número de arranque para cursos nuevos, NO un valor que se aplique a los
-- que ya existen: una capacidad que cambia sola empieza a aceptar alumnos
-- de más sin que nadie lo haya pedido.
--
-- Se toma el mayor de sus sesiones. Hoy todas coinciden dentro de cada
-- curso, así que da igual cuál; si alguna difiriera, quedarse con el mayor
-- no cierra lugares que ya estaban abiertos.
UPDATE "TipoCurso" c
SET "cupoMaximo" = s."tope"
FROM (
  SELECT "tipoCursoId", MAX("cupoMaximo") AS "tope"
  FROM "Sesion"
  GROUP BY "tipoCursoId"
) s
WHERE s."tipoCursoId" = c."id";

-- La sesión ya no está obligada a traer número: vacío quiere decir "el del
-- curso".
ALTER TABLE "Sesion" ALTER COLUMN "cupoMaximo" DROP NOT NULL;
ALTER TABLE "Sesion" ALTER COLUMN "cupoMaximo" DROP DEFAULT;

-- Las que coinciden con su curso se vacían, que es el caso de todas hoy.
-- Las que no, conservan el suyo y siguen mandando.
UPDATE "Sesion" s
SET "cupoMaximo" = NULL
FROM "TipoCurso" c
WHERE c."id" = s."tipoCursoId" AND s."cupoMaximo" = c."cupoMaximo";

-- Identificador público de la sesión. Era la última pantalla que pasaba
-- ids de la base en sus formularios.
ALTER TABLE "Sesion" ADD COLUMN "hash" TEXT;
UPDATE "Sesion" SET "hash" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24) WHERE "hash" IS NULL;
ALTER TABLE "Sesion" ALTER COLUMN "hash" SET NOT NULL;
CREATE UNIQUE INDEX "Sesion_hash_key" ON "Sesion"("hash");

-- Una nota por fecha: un pendiente, algo que haga falta saber.
--
-- No afecta nada: ni la fecha límite, ni los cargos, ni cancela clases. Un
-- día sin clase se captura en "DiaInhabil", que sí mueve la fecha límite.
-- Si esto pudiera cancelar, habría dos maneras de apagar un día y tarde o
-- temprano dirían cosas distintas.
CREATE TABLE "NotaCalendario" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaCalendario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotaCalendario_hash_key" ON "NotaCalendario"("hash");
CREATE INDEX "NotaCalendario_fecha_idx" ON "NotaCalendario"("fecha");

-- Si se borra al usuario, la nota se queda: lo que decía sigue importando
-- aunque ya no esté quien lo escribió.
ALTER TABLE "NotaCalendario" ADD CONSTRAINT "NotaCalendario_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
