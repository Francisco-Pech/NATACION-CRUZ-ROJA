-- El nombre de una temporada es una nota, no un dato: la repetición ya dice
-- qué clase de temporada es y las fechas dicen cuándo corre. Obligarlo hacía
-- que alguien inventara "Temporada 1" sin que eso significara nada.
ALTER TABLE "TemporadaCurso" ALTER COLUMN "nombre" DROP NOT NULL;
