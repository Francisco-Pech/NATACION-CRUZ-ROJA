-- El precio ya no depende de que exista un ciclo anual.
--
-- Lo que decide cuándo rige un precio es su tramo de fechas, no el ciclo.
-- Exigir el ciclo impedía lo único para lo que se hizo el tramo: capturar
-- hoy el precio del año que entra, antes de que ese año exista.
ALTER TABLE "Tarifa" ALTER COLUMN "cicloAnualId" DROP NOT NULL;
