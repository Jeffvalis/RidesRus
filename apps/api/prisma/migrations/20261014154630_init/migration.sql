-- CreateEnum
CREATE TYPE "HailStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'BOARDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('BOARDED', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('PASSENGER_WALLET', 'FARE_REVENUE', 'GATEWAY_CLEARING', 'PROMO_EXPENSE');

-- CreateEnum
CREATE TYPE "TransferKind" AS ENUM ('TOPUP', 'FARE', 'REFUND', 'PROMO');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftKey" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fareKobo" INTEGER NOT NULL,
    "avgSpeedMps" DOUBLE PRECISION NOT NULL,
    "path" JSONB NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "seq" INTEGER NOT NULL,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "occupied" INTEGER NOT NULL DEFAULT 0,
    "routeId" TEXT NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hail" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "status" "HailStatus" NOT NULL DEFAULT 'PENDING',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Hail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "shiftId" TEXT,
    "hailId" TEXT,
    "boardStopId" TEXT,
    "dropoffStopId" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'BOARDED',
    "fareKobo" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fareTransferId" TEXT,
    "boardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "comment" TEXT,
    "ratedAt" TIMESTAMP(3),

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "passengerId" TEXT,
    "balanceKobo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "kind" "TransferKind" NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopUp" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerTxId" TEXT,
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverActionLog" (
    "idempotencyKey" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverActionLog_pkey" PRIMARY KEY ("idempotencyKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_email_key" ON "Passenger"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_code_key" ON "Driver"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_phone_key" ON "Driver"("phone");

-- CreateIndex
CREATE INDEX "ShiftKey_driverId_idx" ON "ShiftKey"("driverId");

-- CreateIndex
CREATE INDEX "Shift_busId_endedAt_idx" ON "Shift"("busId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Route_code_key" ON "Route"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Stop_routeId_seq_key" ON "Stop"("routeId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_code_key" ON "Bus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_plate_key" ON "Bus"("plate");

-- CreateIndex
CREATE INDEX "Hail_busId_status_idx" ON "Hail"("busId", "status");

-- CreateIndex
CREATE INDEX "Hail_passengerId_status_idx" ON "Hail"("passengerId", "status");

-- CreateIndex
CREATE INDEX "Hail_createdAt_idx" ON "Hail"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_hailId_key" ON "Trip"("hailId");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_idempotencyKey_key" ON "Trip"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_fareTransferId_key" ON "Trip"("fareTransferId");

-- CreateIndex
CREATE INDEX "Trip_busId_status_idx" ON "Trip"("busId", "status");

-- CreateIndex
CREATE INDEX "Trip_passengerId_boardedAt_idx" ON "Trip"("passengerId", "boardedAt");

-- CreateIndex
CREATE INDEX "Trip_boardedAt_idx" ON "Trip"("boardedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_passengerId_key" ON "LedgerAccount"("passengerId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_reference_key" ON "Transfer"("reference");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopUp_reference_key" ON "TopUp"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "TopUp_transferId_key" ON "TopUp"("transferId");

-- CreateIndex
CREATE INDEX "TopUp_passengerId_createdAt_idx" ON "TopUp"("passengerId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShiftKey" ADD CONSTRAINT "ShiftKey_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftKey" ADD CONSTRAINT "ShiftKey_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hail" ADD CONSTRAINT "Hail_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hail" ADD CONSTRAINT "Hail_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_hailId_fkey" FOREIGN KEY ("hailId") REFERENCES "Hail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopUp" ADD CONSTRAINT "TopUp_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverActionLog" ADD CONSTRAINT "DriverActionLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Business invariants enforced by Postgres (application code checks these too;
-- these are the backstop that holds even if a future code path forgets).
-- ─────────────────────────────────────────────────────────────────────────────

-- Seats can never go negative or exceed capacity.
ALTER TABLE "Bus" ADD CONSTRAINT "bus_occupied_within_capacity" CHECK ("occupied" >= 0 AND "occupied" <= "capacity");
ALTER TABLE "Bus" ADD CONSTRAINT "bus_capacity_positive" CHECK ("capacity" > 0);

-- A passenger wallet can never be overdrawn.
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "wallet_non_negative" CHECK ("kind" <> 'PASSENGER_WALLET' OR "balanceKobo" >= 0);

-- Fares and top-ups are positive whole kobo; ratings are 1–5.
ALTER TABLE "Trip" ADD CONSTRAINT "trip_fare_positive" CHECK ("fareKobo" > 0);
ALTER TABLE "Trip" ADD CONSTRAINT "trip_rating_range" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5));
ALTER TABLE "TopUp" ADD CONSTRAINT "topup_amount_positive" CHECK ("amountKobo" > 0);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "entry_non_zero" CHECK ("amountKobo" <> 0);

-- One open hail per passenger, and one bus ride at a time.
CREATE UNIQUE INDEX "hail_one_active_per_passenger" ON "Hail" ("passengerId") WHERE "status" IN ('PENDING', 'ACKNOWLEDGED');
CREATE UNIQUE INDEX "trip_one_active_per_passenger" ON "Trip" ("passengerId") WHERE "status" = 'BOARDED';

-- One open shift per bus and per driver.
CREATE UNIQUE INDEX "shift_one_open_per_bus" ON "Shift" ("busId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "shift_one_open_per_driver" ON "Shift" ("driverId") WHERE "endedAt" IS NULL;
