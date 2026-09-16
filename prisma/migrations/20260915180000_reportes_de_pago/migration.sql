-- El recado de quien no pudo pagar en línea.
--
-- Se guarda en la base y no solo se manda por correo: un correo que no sale
-- es una persona que se quedó sin pagar y sin que nadie se entere.
CREATE TABLE "ReporteDePago" (
    "id" TEXT NOT NULL,
    "folio" TEXT,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "imagen" BYTEA,
    "imagenTipo" TEXT,
    "avisadoPorCorreo" BOOLEAN NOT NULL DEFAULT false,
    "atendido" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReporteDePago_pkey" PRIMARY KEY ("id")
);

-- Lo primero que alguien va a preguntar es "¿qué falta por atender?".
CREATE INDEX "ReporteDePago_atendido_creadoEn_idx" ON "ReporteDePago"("atendido", "creadoEn");
