-- Casi todos los cursos corren todo el año; solo se pausan en las temporadas
-- vacacionales del calendario. Salvavidas es la excepción: va por temporada.
-- Por ahora es la bandera nada más; las fechas de temporada se agregan
-- cuando la delegación las defina.
ALTER TABLE "TipoCurso" ADD COLUMN "todoElAnio" BOOLEAN NOT NULL DEFAULT true;
UPDATE "TipoCurso" SET "todoElAnio" = false WHERE "clave" = 'SALVAVIDAS';
