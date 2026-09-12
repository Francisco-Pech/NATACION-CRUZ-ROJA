-- La migración anterior derivó la clave del nombre: "Personal Cruz Roja"
-- quedó como PERSONAL_CRUZ_ROJA. El seeder lo siembra como PERSONAL, así
-- que no se reconocían y salía duplicado en la lista.
--
-- Se reconcilia aquí y no a mano: cualquier base que ya traiga el descuento
-- —la de producción incluida— tiene el mismo desajuste.
UPDATE "Descuento" SET "clave" = 'PERSONAL'
WHERE "clave" = 'PERSONAL_CRUZ_ROJA'
  AND NOT EXISTS (SELECT 1 FROM "Descuento" o WHERE o."clave" = 'PERSONAL');

-- Si el seeder ya alcanzó a crear el gemelo, se va el que nadie usa.
DELETE FROM "Descuento" d
WHERE d."clave" = 'PERSONAL_CRUZ_ROJA'
  AND NOT EXISTS (SELECT 1 FROM "Inscripcion" i WHERE i."descuentoId" = d."id");
