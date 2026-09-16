-- Qué grupos imparte cada profesor.
--
-- Un grupo es un curso a una hora, no una sesión suelta: quien da Adultos de
-- 6 lo da lunes, miércoles y viernes, y tener que marcarle los tres días por
-- separado invita a que falte uno y el profesor no vea a su propia gente.
--
-- Se asigna desde Usuarios, y un grupo puede tener más de un profesor: en
-- vacaciones o por enfermedad alguien cubre a otro, y esa suplencia no
-- debería obligar a reescribir el horario.
CREATE TABLE "ProfesorDeGrupo" (
  "id"          TEXT NOT NULL,
  "usuarioId"   TEXT NOT NULL,
  "tipoCursoId" TEXT NOT NULL,
  "horarioId"   TEXT NOT NULL,
  "creadoEn"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfesorDeGrupo_pkey" PRIMARY KEY ("id")
);

-- El mismo grupo dos veces al mismo profesor es un error de captura, no una
-- petición: la lista le saldría duplicada.
CREATE UNIQUE INDEX "ProfesorDeGrupo_usuarioId_tipoCursoId_horarioId_key"
  ON "ProfesorDeGrupo"("usuarioId", "tipoCursoId", "horarioId");
CREATE INDEX "ProfesorDeGrupo_usuarioId_idx" ON "ProfesorDeGrupo"("usuarioId");

ALTER TABLE "ProfesorDeGrupo" ADD CONSTRAINT "ProfesorDeGrupo_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfesorDeGrupo" ADD CONSTRAINT "ProfesorDeGrupo_tipoCursoId_fkey"
  FOREIGN KEY ("tipoCursoId") REFERENCES "TipoCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfesorDeGrupo" ADD CONSTRAINT "ProfesorDeGrupo_horarioId_fkey"
  FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Que el profesor vio la credencial del alumno ese mes.
--
-- Una por alumno y por mes: se pide al menos una vez, no cada clase. Guarda
-- cómo se verificó —escaneando el QR o tecleando el folio— porque no es lo
-- mismo: el escaneo prueba que el papel estaba ahí, el folio se puede dictar
-- por teléfono.
--
-- No bloquea nada. El alumno sin verificar sale señalado y el mes queda
-- marcado como incompleto, pero la lista se sigue pasando: quien olvidó su
-- credencial el día 1 no puede quedarse sin asistencias todo el mes.
CREATE TABLE "VerificacionCredencial" (
  "id"             TEXT NOT NULL,
  "inscripcionId"  TEXT NOT NULL,
  "anio"           INTEGER NOT NULL,
  "mes"            INTEGER NOT NULL,
  "verificadaPorId" TEXT NOT NULL,
  -- ESCANEO cuando se leyó el QR; FOLIO cuando se tecleó.
  "como"           TEXT NOT NULL,
  "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificacionCredencial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerificacionCredencial_inscripcionId_anio_mes_key"
  ON "VerificacionCredencial"("inscripcionId", "anio", "mes");

ALTER TABLE "VerificacionCredencial" ADD CONSTRAINT "VerificacionCredencial_inscripcionId_fkey"
  FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificacionCredencial" ADD CONSTRAINT "VerificacionCredencial_verificadaPorId_fkey"
  FOREIGN KEY ("verificadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
