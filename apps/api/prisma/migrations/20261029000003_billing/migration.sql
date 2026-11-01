-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'YAPE_PLIN', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('VALID', 'VOIDED');

-- CreateEnum
CREATE TYPE "SplitMode" AS ENUM ('EQUAL', 'BY_ITEMS');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "part_id" UUID,
    "closure_id" UUID,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "received_amount" DECIMAL(10,2),
    "change_amount" DECIMAL(10,2),
    "reference" VARCHAR(40),
    "idempotency_key" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "paid_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'VALID',
    "void_reason" VARCHAR(200),
    "voided_by_id" UUID,
    "voided_at" TIMESTAMPTZ(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_splits" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "mode" "SplitMode" NOT NULL,
    "base_amount" DECIMAL(10,2) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ(3),

    CONSTRAINT "bill_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_parts" (
    "id" UUID NOT NULL,
    "split_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "bill_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_part_items" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "units" INTEGER NOT NULL,

    CONSTRAINT "bill_part_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_closures" (
    "id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_cash" DECIMAL(10,2) NOT NULL,
    "counted_cash" DECIMAL(10,2) NOT NULL,
    "expected_yape_plin" DECIMAL(10,2) NOT NULL,
    "counted_yape_plin" DECIMAL(10,2) NOT NULL,
    "expected_card" DECIMAL(10,2) NOT NULL,
    "counted_card" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "accounts_count" INTEGER NOT NULL,
    "notes" VARCHAR(300),

    CONSTRAINT "day_closures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE INDEX "payments_closure_id_idx" ON "payments"("closure_id");

-- CreateIndex
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- CreateIndex
CREATE INDEX "bill_splits_order_id_idx" ON "bill_splits"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_parts_split_id_position_key" ON "bill_parts"("split_id", "position");

-- CreateIndex
CREATE INDEX "bill_part_items_part_id_idx" ON "bill_part_items"("part_id");

-- CreateIndex
CREATE INDEX "bill_part_items_order_item_id_idx" ON "bill_part_items"("order_item_id");

-- CreateIndex
CREATE INDEX "day_closures_closed_at_idx" ON "day_closures"("closed_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "bill_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_closure_id_fkey" FOREIGN KEY ("closure_id") REFERENCES "day_closures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_splits" ADD CONSTRAINT "bill_splits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_splits" ADD CONSTRAINT "bill_splits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_parts" ADD CONSTRAINT "bill_parts_split_id_fkey" FOREIGN KEY ("split_id") REFERENCES "bill_splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_part_items" ADD CONSTRAINT "bill_part_items_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "bill_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_part_items" ADD CONSTRAINT "bill_part_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_closures" ADD CONSTRAINT "day_closures_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agregado a mano (specs/005-caja-reportes/data-model.md): restricciones que Prisma no expresa.
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_received_check" CHECK (("method" = 'CASH') = ("received_amount" IS NOT NULL));
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_covers_check" CHECK ("received_amount" IS NULL OR "received_amount" >= "amount");
ALTER TABLE "bill_part_items" ADD CONSTRAINT "bill_part_items_units_check" CHECK ("units" >= 1);

-- Una sola división vigente por pedido.
CREATE UNIQUE INDEX "bill_splits_one_active_per_order" ON "bill_splits"("order_id") WHERE "superseded_at" IS NULL;

-- Reportes por rango de cierre de cuentas pagadas (SC-007).
CREATE INDEX "orders_status_closed_at_idx" ON "orders"("status", "closed_at");
