-- Un festivo de fecha fija —Navidad, Año Nuevo— es el mismo todos los años.
-- Capturarlo año por año obliga a alguien a acordarse cada diciembre, y el
-- día que se olvide la fecha límite de pago sale mal sin que nadie se entere.
ALTER TABLE "DiaInhabil" ADD COLUMN "cadaAnio" BOOLEAN NOT NULL DEFAULT false;
