-- Los roles dejan de ser tres valores fijos en el código y pasan a ser
-- registros, para poder crear uno nuevo —un supervisor que vea cobranza
-- pero no toque precios— sin tocar el código.
--
-- Los permisos sí se quedan en el código: cada uno corresponde a algo que
-- de verdad se protege, e inventar uno desde la pantalla no abriría nada,
-- solo daría la impresión de que sí.

-- El nombre "Rol" lo ocupa el tipo enumerado, así que primero hay que
-- soltarlo. La clave de cada usuario se guarda en una columna de paso para
-- no perder quién era quién.
ALTER TABLE "Usuario" ADD COLUMN "rolClave" TEXT;
UPDATE "Usuario" SET "rolClave" = "rol"::text;
ALTER TABLE "Usuario" DROP COLUMN "rol";
DROP TYPE "Rol";

CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "permisos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Rol_hash_key" ON "Rol"("hash");
CREATE UNIQUE INDEX "Rol_clave_key" ON "Rol"("clave");

-- Los tres que ya existían, con lo que ya podían hacer.
--
-- Mover precios y cambiar contraseñas no entran en Administrador: hoy son
-- de Root, y esta migración traduce lo que hay, no cambia quién puede qué.
INSERT INTO "Rol" ("id", "hash", "clave", "nombre", "descripcion", "permisos") VALUES
  ('rol-administrador', substr(md5(random()::text || clock_timestamp()::text || 'adm'), 1, 24),
   'ADMINISTRADOR', 'Administrador', 'Todo, incluida la configuración de la escuela.',
   ARRAY['VER_PANEL','ALUMNOS','COBRAR','LOCKERS','ASISTENCIA','CONFIGURAR','USUARIOS']),
  ('rol-capturista', substr(md5(random()::text || clock_timestamp()::text || 'cap'), 1, 24),
   'CAPTURISTA', 'Capturista', 'Alumnos, cobros, lockers y credenciales.',
   ARRAY['VER_PANEL','ALUMNOS','COBRAR','LOCKERS']),
  ('rol-profesor', substr(md5(random()::text || clock_timestamp()::text || 'pro'), 1, 24),
   'PROFESOR', 'Profesor', 'Solo escanear el QR y pasar asistencia.',
   ARRAY['ASISTENCIA']);

-- Cada usuario se queda con el rol que ya tenía.
ALTER TABLE "Usuario" ADD COLUMN "rolId" TEXT;
UPDATE "Usuario" u SET "rolId" = r."id" FROM "Rol" r WHERE r."clave" = u."rolClave";

-- Por si quedara alguno sin pareja: al más limitado, nunca al más abierto.
UPDATE "Usuario" SET "rolId" = 'rol-profesor' WHERE "rolId" IS NULL;

ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolId_fkey"
  FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Usuario_rolId_idx" ON "Usuario"("rolId");

-- No puede haber usuario sin rol.
ALTER TABLE "Usuario" ALTER COLUMN "rolId" SET NOT NULL;
ALTER TABLE "Usuario" DROP COLUMN "rolClave";
