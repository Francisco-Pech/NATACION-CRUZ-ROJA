-- Las franjas se ordenan solas por su hora de inicio: "06:00" va antes que
-- "07:00" también como texto. Guardar un orden aparte era pedirle a alguien
-- que mantuviera a mano algo que el reloj ya resuelve.
ALTER TABLE "Horario" DROP COLUMN "orden";
