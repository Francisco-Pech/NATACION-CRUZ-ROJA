-- CreateTable
CREATE TABLE "PeriodoSinClases" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "PeriodoSinClases_pkey" PRIMARY KEY ("id")
);
