-- Branch-scoped dining tables for POS / kiosk dine-in

ALTER TABLE "DiningTable" ADD COLUMN "branchId" TEXT;

UPDATE "DiningTable" dt
SET "branchId" = sub."branchId"
FROM (
  SELECT DISTINCT ON (dt2.id)
    dt2.id AS "tableId",
    b.id AS "branchId"
  FROM "DiningTable" dt2
  INNER JOIN "Branch" b ON b."restaurantId" = dt2."restaurantId"
  ORDER BY dt2.id, b."createdAt" ASC
) sub
WHERE dt.id = sub."tableId" AND dt."branchId" IS NULL;

CREATE INDEX "DiningTable_branchId_idx" ON "DiningTable"("branchId");

ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiningTable" DROP CONSTRAINT IF EXISTS "DiningTable_restaurantId_name_key";

CREATE UNIQUE INDEX "DiningTable_restaurantId_branchId_name_key"
  ON "DiningTable"("restaurantId", "branchId", "name");
