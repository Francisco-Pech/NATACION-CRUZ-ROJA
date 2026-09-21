-- Quien se inscribió por internet y todavía no es alumno.
--
-- Vive aparte de Alumno a propósito: hasta que alguien de la delegación la
-- da de alta no hay alumno, ni folio, ni cargos. Un formulario abierto lo
-- llena cualquiera, y un alumno inventado con folio podría pagar, pasar
-- lista y sacar credencial.
CREATE TABLE "SolicitudDeRegistro" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "tipoCursoId" TEXT NOT NULL,
    "horarioId" TEXT NOT NULL,
    -- Vacío: no quiere locker. No todos lo usan y se cobra aparte cada mes.
    "lockerId" TEXT,
    "telefono" TEXT,
    -- Cuándo se atendió y quién: al darla de alta o al descartarla.
    "atendidaEn" TIMESTAMP(3),
    "atendidaPorId" TEXT,
    "inscripcionId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudDeRegistro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolicitudDeRegistro_hash_key" ON "SolicitudDeRegistro"("hash");
CREATE INDEX "SolicitudDeRegistro_atendidaEn_idx" ON "SolicitudDeRegistro"("atendidaEn");

ALTER TABLE "SolicitudDeRegistro" ADD CONSTRAINT "SolicitudDeRegistro_tipoCursoId_fkey"
    FOREIGN KEY ("tipoCursoId") REFERENCES "TipoCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SolicitudDeRegistro" ADD CONSTRAINT "SolicitudDeRegistro_horarioId_fkey"
    FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SolicitudDeRegistro" ADD CONSTRAINT "SolicitudDeRegistro_lockerId_fkey"
    FOREIGN KEY ("lockerId") REFERENCES "Locker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SolicitudDeRegistro" ADD CONSTRAINT "SolicitudDeRegistro_atendidaPorId_fkey"
    FOREIGN KEY ("atendidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SolicitudDeRegistro" ADD CONSTRAINT "SolicitudDeRegistro_inscripcionId_fkey"
    FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
