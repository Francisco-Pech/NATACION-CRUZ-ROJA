-- La rejilla deja de llevar cupo.
--
-- Se capturaba un tope y una tolerancia por renglón, y al inscribir el
-- sistema contaba y rechazaba. En la práctica era un estorbo: la alberca
-- acepta a quien llega, y quien captura acababa peleando con un número que
-- alguien puso hace meses.
--
-- Lo que sí hace falta es saber cuántos van, y eso no es una columna: se
-- cuenta de los inscritos y se enseña al escoger el horario.
ALTER TABLE "Sesion" DROP COLUMN "cupoMaximo";
ALTER TABLE "Sesion" DROP COLUMN "extras";
