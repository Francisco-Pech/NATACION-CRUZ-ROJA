-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMINISTRADOR', 'RECEPCION', 'PROFESOR');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('NINOS', 'GENERAL');

-- CreateEnum
CREATE TYPE "EstadoCiclo" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoInscripcion" AS ENUM ('ACTIVA', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoCargo" AS ENUM ('PENDIENTE', 'EN_REVISION', 'PAGADO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'SPEI', 'OXXO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('EN_REVISION', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('SOLICITADA', 'EN_PROCESO', 'FACTURADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoDescuento" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumno" (
    "id" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "contactoEmergenciaNombre" TEXT,
    "contactoEmergenciaTelefono" TEXT,
    "condicionesMedicas" TEXT,
    "categoria" "Categoria" NOT NULL DEFAULT 'GENERAL',
    "fotoUrl" TEXT,
    "rfc" TEXT,
    "razonSocial" TEXT,
    "codigoPostal" TEXT,
    "regimenFiscal" TEXT,
    "usoCfdi" TEXT,
    "datosCompletos" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloAnual" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "estado" "EstadoCiclo" NOT NULL DEFAULT 'ABIERTO',
    "diasHabilesLimite" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "CicloAnual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscripcion" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "cicloAnualId" TEXT NOT NULL,
    "grupoId" TEXT,
    "descuentoId" TEXT,
    "folio" TEXT NOT NULL,
    "tokenQR" TEXT NOT NULL,
    "estado" "EstadoInscripcion" NOT NULL DEFAULT 'ACTIVA',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Periodo" (
    "id" TEXT NOT NULL,
    "cicloAnualId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "clave" TEXT NOT NULL,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "recargo" INTEGER NOT NULL DEFAULT 5000,
    "precioLocker" INTEGER NOT NULL DEFAULT 10000,
    "estado" "EstadoCiclo" NOT NULL DEFAULT 'ABIERTO',
    "cargosGenerados" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaInhabil" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "DiaInhabil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarifa" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "monto" INTEGER NOT NULL,

    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Descuento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoDescuento" NOT NULL,
    "valor" INTEGER NOT NULL,
    "vigenciaDesde" TIMESTAMP(3),
    "vigenciaHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Descuento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dias" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "cupoMaximo" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locker" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Locker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionLocker" (
    "id" TEXT NOT NULL,
    "lockerId" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,

    CONSTRAINT "AsignacionLocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "montoMensualidad" INTEGER NOT NULL,
    "montoLockers" INTEGER NOT NULL DEFAULT 0,
    "montoDescuento" INTEGER NOT NULL DEFAULT 0,
    "montoRecargo" INTEGER NOT NULL DEFAULT 0,
    "montoNeto" INTEGER NOT NULL,
    "estado" "EstadoCargo" NOT NULL DEFAULT 'PENDIENTE',
    "recargoAplicadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "montoCobrado" INTEGER NOT NULL,
    "montoComision" INTEGER NOT NULL DEFAULT 0,
    "montoNeto" INTEGER NOT NULL,
    "referencia" TEXT,
    "comprobanteUrl" TEXT,
    "stripePaymentIntentId" TEXT,
    "estado" "EstadoPago" NOT NULL DEFAULT 'CONFIRMADO',
    "registradoPorId" TEXT,
    "validadoPorId" TEXT,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudFactura" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "rfc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "codigoPostal" TEXT NOT NULL,
    "regimenFiscal" TEXT NOT NULL,
    "usoCfdi" TEXT NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'SOLICITADA',
    "notas" TEXT,
    "atendidaPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudFactura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "registradaPorId" TEXT NOT NULL,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigComision" (
    "id" TEXT NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoFijo" INTEGER NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0.16,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "diasCorteAntesDeVencimiento" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConfigComision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CicloAnual_anio_key" ON "CicloAnual"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "Inscripcion_folio_key" ON "Inscripcion"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "Inscripcion_tokenQR_key" ON "Inscripcion"("tokenQR");

-- CreateIndex
CREATE UNIQUE INDEX "Inscripcion_alumnoId_cicloAnualId_key" ON "Inscripcion"("alumnoId", "cicloAnualId");

-- CreateIndex
CREATE UNIQUE INDEX "Periodo_clave_key" ON "Periodo"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "Periodo_cicloAnualId_mes_key" ON "Periodo"("cicloAnualId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "DiaInhabil_fecha_key" ON "DiaInhabil"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Tarifa_periodoId_categoria_key" ON "Tarifa"("periodoId", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Locker_numero_key" ON "Locker"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionLocker_lockerId_periodoId_key" ON "AsignacionLocker"("lockerId", "periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_inscripcionId_periodoId_key" ON "Cargo"("inscripcionId", "periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudFactura_cargoId_key" ON "SolicitudFactura"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "Asistencia_inscripcionId_fecha_key" ON "Asistencia"("inscripcionId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigComision_metodo_key" ON "ConfigComision"("metodo");

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_cicloAnualId_fkey" FOREIGN KEY ("cicloAnualId") REFERENCES "CicloAnual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_descuentoId_fkey" FOREIGN KEY ("descuentoId") REFERENCES "Descuento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Periodo" ADD CONSTRAINT "Periodo_cicloAnualId_fkey" FOREIGN KEY ("cicloAnualId") REFERENCES "CicloAnual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarifa" ADD CONSTRAINT "Tarifa_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionLocker" ADD CONSTRAINT "AsignacionLocker_lockerId_fkey" FOREIGN KEY ("lockerId") REFERENCES "Locker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionLocker" ADD CONSTRAINT "AsignacionLocker_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionLocker" ADD CONSTRAINT "AsignacionLocker_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudFactura" ADD CONSTRAINT "SolicitudFactura_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudFactura" ADD CONSTRAINT "SolicitudFactura_atendidaPorId_fkey" FOREIGN KEY ("atendidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
