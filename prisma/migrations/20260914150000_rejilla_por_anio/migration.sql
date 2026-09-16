-- La rejilla admite el mismo curso, día y hora en años distintos.
--
-- Hasta hoy un renglón era único por curso + día + horario, sin el año.
-- Eso impedía tener "Adultos, lunes 6:00" de 2026 y de 2027 a la vez: al
-- capturar el segundo, el sistema respondía "ya está en la lista". Con
-- la temporada dentro de la llave, cada año lleva su propia rejilla y se
-- puede dejar armado el año que entra sin tocar el que corre.
--
-- Los cinco renglones viejos de Guardavidas no tienen temporada, y para
-- Postgres dos nulos no son iguales: entre ellos la llave no los distingue.
-- No importa — la pantalla exige escoger una temporada, así que por ahí no
-- se crean más, y esos cinco están desactivados.
DROP INDEX "Sesion_tipoCursoId_horarioId_diaSemana_key";

CREATE UNIQUE INDEX "Sesion_temporadaCursoId_tipoCursoId_horarioId_diaSemana_key"
  ON "Sesion"("temporadaCursoId", "tipoCursoId", "horarioId", "diaSemana");
