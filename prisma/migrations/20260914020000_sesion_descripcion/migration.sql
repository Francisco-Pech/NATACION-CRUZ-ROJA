-- Una nota libre en el renglón, para lo que haga falta apuntar de esa clase.
ALTER TABLE "Sesion" ADD COLUMN "descripcion" TEXT;

-- Se va la tabla de comentarios del calendario.
--
-- Se creó para una pantalla de calendario que no se va a construir, y una
-- tabla sin nada que la lea no es una puerta abierta a futuro: es un lugar
-- donde caben datos que nadie va a ver. Lo que había que apuntar se apunta
-- en la descripción del renglón, que sí está a la vista de quien captura.
DROP TABLE IF EXISTS "NotaCalendario";
