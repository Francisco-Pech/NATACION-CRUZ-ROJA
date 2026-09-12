-- Los descuentos pasan a ser un catálogo como los demás: con hash para los
-- endpoints, clave para que el seeder y la lógica se agarren de algo que no
-- cambia, y descripción para anotar a quién le toca.

ALTER TABLE "Descuento" ADD COLUMN "hash" TEXT;
UPDATE "Descuento" SET "hash" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24) WHERE "hash" IS NULL;
ALTER TABLE "Descuento" ALTER COLUMN "hash" SET NOT NULL;
CREATE UNIQUE INDEX "Descuento_hash_key" ON "Descuento"("hash");

-- La clave sale del nombre: mayúsculas, sin acentos y con guion bajo en
-- lugar de espacios. "Personal Cruz Roja" queda como PERSONAL_CRUZ_ROJA.
ALTER TABLE "Descuento" ADD COLUMN "clave" TEXT;
UPDATE "Descuento" SET "clave" = upper(
  regexp_replace(
    translate("nombre", 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'),
    '[^a-zA-Z0-9]+', '_', 'g'
  )
) WHERE "clave" IS NULL;
-- Por si dos nombres distintos derivan en la misma clave.
UPDATE "Descuento" d SET "clave" = d."clave" || '_' || substr(d."id", 1, 4)
WHERE EXISTS (SELECT 1 FROM "Descuento" o WHERE o."clave" = d."clave" AND o."id" <> d."id");
ALTER TABLE "Descuento" ALTER COLUMN "clave" SET NOT NULL;
CREATE UNIQUE INDEX "Descuento_clave_key" ON "Descuento"("clave");

ALTER TABLE "Descuento" ADD COLUMN "descripcion" TEXT;
