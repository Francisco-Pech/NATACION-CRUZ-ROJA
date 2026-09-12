-- Cuántas veces se puede dar un descuento. Vacío es "sin límite", que es
-- como están todos hoy.
--
-- Las columnas de vigencia ya existían pero nunca se habían usado ni se
-- podían capturar; ahora sí, y vacías siguen queriendo decir "sin límite de
-- fecha".
ALTER TABLE "Descuento" ADD COLUMN "limiteUsos" INTEGER;
