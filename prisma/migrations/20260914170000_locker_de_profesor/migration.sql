-- Un locker apartado para un profesor.
--
-- Va en su propia tabla y no en `AsignacionLocker` porque es otra cosa: el
-- del alumno cuelga de un periodo y genera cargo cada mes; el del profesor
-- no se cobra y se queda apartado hasta que alguien lo libere. Meter los
-- dos en la misma tabla obligaba a dejar el periodo en nulo y a que cada
-- consulta de cobranza se acordara de excluirlos.
CREATE TABLE "LockerDeProfesor" (
  "id"        TEXT NOT NULL,
  "lockerId"  TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "creadoEn"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LockerDeProfesor_pkey" PRIMARY KEY ("id")
);

-- Uno por locker: si ya es de un profesor, no puede ser de otro.
CREATE UNIQUE INDEX "LockerDeProfesor_lockerId_key" ON "LockerDeProfesor"("lockerId");
CREATE INDEX "LockerDeProfesor_usuarioId_idx" ON "LockerDeProfesor"("usuarioId");

ALTER TABLE "LockerDeProfesor" ADD CONSTRAINT "LockerDeProfesor_lockerId_fkey"
  FOREIGN KEY ("lockerId") REFERENCES "Locker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LockerDeProfesor" ADD CONSTRAINT "LockerDeProfesor_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
