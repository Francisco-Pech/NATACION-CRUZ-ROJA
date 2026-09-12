-- Las recurrencias ya se ordenan solas por los meses que cubren: 1 mensual,
-- 3 trimestral, 6 semestral, 12 anual. Guardar además un "orden" era pedir
-- que alguien mantuviera a mano un número que repetía esa misma secuencia.
ALTER TABLE "FrecuenciaPago" DROP COLUMN "orden";
