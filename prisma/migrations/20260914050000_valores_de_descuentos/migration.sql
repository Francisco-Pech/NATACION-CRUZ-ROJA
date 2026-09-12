-- Los porcentajes que confirmó la Delegación.
--
-- Van en migración y no en el seeder porque el seeder no reescribe el valor
-- de un descuento que ya existe: es dinero, y lo decide quien administra.
-- Para las bases que ya están en pie, esto es lo que las pone al día.
UPDATE "Descuento" SET "valor" = 50 WHERE "clave" = 'INAPAM';
UPDATE "Descuento" SET "valor" = 100 WHERE "clave" IN ('PERSONAL', 'CORTESIA');

-- Especial ya tiene porcentaje, así que se enciende: se había sembrado
-- apagado justamente porque no lo tenía.
UPDATE "Descuento"
SET "valor" = 20, "activo" = true, "descripcion" = 'Caso especial autorizado por la Delegación.'
WHERE "clave" = 'ESPECIAL';

-- Se va Beca, que no forma parte del catálogo acordado.
--
-- Solo si nadie la lleva: con una inscripción encima, borrarla dejaría un
-- estado de cuenta que cobró de menos y ya no podría explicar por qué.
DELETE FROM "Descuento" d
WHERE d."clave" = 'BECA'
  AND NOT EXISTS (SELECT 1 FROM "Inscripcion" i WHERE i."descuentoId" = d."id");
