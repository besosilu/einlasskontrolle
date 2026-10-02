-- CreateTable
CREATE TABLE "members" (
    "id" SERIAL NOT NULL,
    "member_number" VARCHAR(50),
    "last_name" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "entry_time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entry_date" DATE NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "notes" TEXT,
    "created_by" VARCHAR(100),

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" SERIAL NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "records_total" INTEGER NOT NULL,
    "records_created" INTEGER NOT NULL,
    "records_updated" INTEGER NOT NULL,
    "records_skipped" INTEGER NOT NULL,
    "errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_member_links" (
    "import_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "action" VARCHAR(10) NOT NULL,

    CONSTRAINT "import_member_links_pkey" PRIMARY KEY ("import_id","member_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "members_member_number_key" ON "members"("member_number");

-- CreateIndex
CREATE INDEX "members_last_name_first_name_idx" ON "members"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "entries_member_id_idx" ON "entries"("member_id");

-- CreateIndex
CREATE INDEX "entries_entry_date_idx" ON "entries"("entry_date");

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_member_links" ADD CONSTRAINT "import_member_links_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "import_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_member_links" ADD CONSTRAINT "import_member_links_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
