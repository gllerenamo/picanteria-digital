-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('DRAFT', 'PENDING', 'PREPARING', 'READY', 'VOIDED');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "waiter_id" UUID NOT NULL,
    "guest_count" INTEGER,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "dispatch_id" UUID,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "voided_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(10,2),
    "notes" VARCHAR(140),
    "status" "OrderItemStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_dispatches" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "sent_by_id" UUID NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_voids" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "units" INTEGER NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "voided_by_id" UUID NOT NULL,
    "voided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_voids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_table_id_idx" ON "orders"("table_id");

-- CreateIndex
CREATE INDEX "orders_waiter_id_idx" ON "orders"("waiter_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_items_order_id_status_idx" ON "order_items"("order_id", "status");

-- CreateIndex
CREATE INDEX "order_items_dispatch_id_idx" ON "order_items"("dispatch_id");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_dispatches_sequence_key" ON "kitchen_dispatches"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_dispatches_idempotency_key_key" ON "kitchen_dispatches"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_dispatches_order_id_round_key" ON "kitchen_dispatches"("order_id", "round");

-- CreateIndex
CREATE INDEX "item_voids_order_item_id_idx" ON "item_voids"("order_item_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "kitchen_dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_dispatches" ADD CONSTRAINT "kitchen_dispatches_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_dispatches" ADD CONSTRAINT "kitchen_dispatches_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_voids" ADD CONSTRAINT "item_voids_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_voids" ADD CONSTRAINT "item_voids_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Agregado a mano (specs/003-mesas-pedidos/data-model.md §6): Prisma no declara índices
-- parciales ni restricciones CHECK.

-- Como máximo una orden abierta por mesa (FR-003, research.md §3).
CREATE UNIQUE INDEX "orders_one_open_per_table" ON "orders"("table_id") WHERE "status" = 'OPEN';

-- Invariantes del ítem (research.md §8).
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" >= 1);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_voided_quantity_check" CHECK ("voided_quantity" >= 0 AND "voided_quantity" <= "quantity");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_dispatch_check" CHECK (("status" = 'DRAFT') = ("dispatch_id" IS NULL));
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_check" CHECK (("status" = 'DRAFT') = ("unit_price" IS NULL));
