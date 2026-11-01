-- CreateTable
CREATE TABLE "order_item_status_changes" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "from_status" "OrderItemStatus" NOT NULL,
    "to_status" "OrderItemStatus" NOT NULL,
    "is_undo" BOOLEAN NOT NULL DEFAULT false,
    "changed_by_id" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ready_notices" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_at" TIMESTAMPTZ(3),
    "withdrawn_at" TIMESTAMPTZ(3),

    CONSTRAINT "ready_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_void_acks" (
    "item_void_id" UUID NOT NULL,
    "acknowledged_by_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_void_acks_pkey" PRIMARY KEY ("item_void_id")
);

-- CreateIndex
CREATE INDEX "order_item_status_changes_order_item_id_changed_at_idx" ON "order_item_status_changes"("order_item_id", "changed_at");

-- CreateIndex
CREATE INDEX "ready_notices_recipient_id_idx" ON "ready_notices"("recipient_id");

-- CreateIndex
CREATE INDEX "ready_notices_order_item_id_idx" ON "ready_notices"("order_item_id");

-- AddForeignKey
ALTER TABLE "order_item_status_changes" ADD CONSTRAINT "order_item_status_changes_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_status_changes" ADD CONSTRAINT "order_item_status_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ready_notices" ADD CONSTRAINT "ready_notices_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ready_notices" ADD CONSTRAINT "ready_notices_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_void_acks" ADD CONSTRAINT "kitchen_void_acks_item_void_id_fkey" FOREIGN KEY ("item_void_id") REFERENCES "item_voids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_void_acks" ADD CONSTRAINT "kitchen_void_acks_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Agregado a mano (specs/004-cocina/data-model.md §1): Prisma no declara índices parciales.

-- Como máximo un aviso de plato listo abierto (sin ver ni retirar) por ítem.
CREATE UNIQUE INDEX "ready_notices_open_item" ON "ready_notices"("order_item_id") WHERE "seen_at" IS NULL AND "withdrawn_at" IS NULL;
