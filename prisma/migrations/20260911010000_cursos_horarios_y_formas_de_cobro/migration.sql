-- Cursos, horarios y formas de cobro.
--
-- Reemplaza la tabla plana Grupo por tres piezas separadas: qué cursos hay,
-- qué franjas horarias existen, y qué día se cruza con qué franja. Y cambia
-- la tarifa: el precio deja de colgar de la categoría del alumno y del mes,
-- y pasa a colgar del curso, con su forma de cobro.

-- ---------------------------------------------------------------- catálogos

CREATE TABLE "TipoCurso" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "TipoCurso_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TipoCurso_clave_key" ON "TipoCurso"("clave");

CREATE TABLE "Horario" (
    "id" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Horario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Horario_horaInicio_horaFin_key" ON "Horario"("horaInicio", "horaFin");

CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "tipoCursoId" TEXT NOT NULL,
    "horarioId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "cupoMaximo" INTEGER NOT NULL DEFAULT 20,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Sesion_tipoCursoId_horarioId_diaSemana_key"
    ON "Sesion"("tipoCursoId", "horarioId", "diaSemana");
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_tipoCursoId_fkey"
    FOREIGN KEY ("tipoCursoId") REFERENCES "TipoCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_horarioId_fkey"
    FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InscripcionSesion" (
    "id" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InscripcionSesion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InscripcionSesion_inscripcionId_sesionId_key"
    ON "InscripcionSesion"("inscripcionId", "sesionId");
ALTER TABLE "InscripcionSesion" ADD CONSTRAINT "InscripcionSesion_inscripcionId_fkey"
    FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InscripcionSesion" ADD CONSTRAINT "InscripcionSesion_sesionId_fkey"
    FOREIGN KEY ("sesionId") REFERENCES "Sesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TipoPago" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "TipoPago_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TipoPago_clave_key" ON "TipoPago"("clave");

CREATE TABLE "FrecuenciaPago" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "meses" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "FrecuenciaPago_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FrecuenciaPago_clave_key" ON "FrecuenciaPago"("clave");

-- Los cuatro tipos de curso se siembran aquí, no en el seeder, porque los
-- cargos que ya existen necesitan apuntar a uno y la columna es obligatoria.
-- El seeder los vuelve a sembrar por clave, así que esto es idempotente.
INSERT INTO "TipoCurso" ("id", "clave", "nombre", "orden") VALUES
    ('tipocurso-adultos',       'ADULTOS',       'Curso Adultos',  1),
    ('tipocurso-ninos',         'NINOS',         'Curso Niños',    2),
    ('tipocurso-personalizado', 'PERSONALIZADO', 'Personalizado',  3),
    ('tipocurso-salvavidas',    'SALVAVIDAS',    'Salvavidas',     4);

-- -------------------------------------------------------------------- Cargo

ALTER TABLE "Cargo" ADD COLUMN "tipoCursoId" TEXT;

-- Los cargos existentes heredan el curso que corresponde a la categoría del
-- alumno, que es lo que hasta hoy determinaba su precio.
UPDATE "Cargo" c
   SET "tipoCursoId" = CASE WHEN a."categoria" = 'NINOS'
                            THEN 'tipocurso-ninos'
                            ELSE 'tipocurso-adultos' END
  FROM "Inscripcion" i
  JOIN "Alumno" a ON a."id" = i."alumnoId"
 WHERE i."id" = c."inscripcionId";

ALTER TABLE "Cargo" ALTER COLUMN "tipoCursoId" SET NOT NULL;
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_tipoCursoId_fkey"
    FOREIGN KEY ("tipoCursoId") REFERENCES "TipoCurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "Cargo_inscripcionId_periodoId_key";
CREATE UNIQUE INDEX "Cargo_inscripcionId_periodoId_tipoCursoId_key"
    ON "Cargo"("inscripcionId", "periodoId", "tipoCursoId");

-- ------------------------------------------------------------------- Tarifa

-- La forma vieja (mes + categoría) no se puede traducir a la nueva
-- (ciclo + curso + forma de cobro): son ejes distintos. Se rehace, y el
-- seeder la vuelve a llenar. Los cargos ya emitidos no se tocan, porque
-- guardan sus montos calculados.
DROP TABLE "Tarifa";

CREATE TABLE "Tarifa" (
    "id" TEXT NOT NULL,
    "cicloAnualId" TEXT NOT NULL,
    "tipoCursoId" TEXT NOT NULL,
    "tipoPagoId" TEXT NOT NULL,
    "frecuenciaId" TEXT,
    "monto" INTEGER NOT NULL,
    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tarifa_cicloAnualId_tipoCursoId_tipoPagoId_frecuenciaId_key"
    ON "Tarifa"("cicloAnualId", "tipoCursoId", "tipoPagoId", "frecuenciaId");
ALTER TABLE "Tarifa" ADD CONSTRAINT "Tarifa_cicloAnualId_fkey"
    FOREIGN KEY ("cicloAnualId") REFERENCES "CicloAnual"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tarifa" ADD CONSTRAINT "Tarifa_tipoCursoId_fkey"
    FOREIGN KEY ("tipoCursoId") REFERENCES "TipoCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tarifa" ADD CONSTRAINT "Tarifa_tipoPagoId_fkey"
    FOREIGN KEY ("tipoPagoId") REFERENCES "TipoPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tarifa" ADD CONSTRAINT "Tarifa_frecuenciaId_fkey"
    FOREIGN KEY ("frecuenciaId") REFERENCES "FrecuenciaPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -------------------------------------------------------------------- Grupo

-- Grupo queda reemplazado por TipoCurso + Horario + Sesion. Las inscripciones
-- se vuelven a ligar a sus sesiones desde el seeder de demostración.
ALTER TABLE "Inscripcion" DROP CONSTRAINT "Inscripcion_grupoId_fkey";
ALTER TABLE "Inscripcion" DROP COLUMN "grupoId";
DROP TABLE "Grupo";
