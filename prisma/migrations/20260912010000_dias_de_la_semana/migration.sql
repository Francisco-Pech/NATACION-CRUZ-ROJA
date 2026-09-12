-- Los días de la semana pasan de ser una lista en el código a una tabla que
-- la delegación puede administrar. No se relaciona todavía con Sesion:
-- `Sesion.diaSemana` sigue guardando el número, y la tabla es el catálogo.
CREATE TABLE "DiaSemana" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DiaSemana_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiaSemana_clave_key" ON "DiaSemana"("clave");
CREATE UNIQUE INDEX "DiaSemana_numero_key" ON "DiaSemana"("numero");
