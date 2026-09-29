-- Dining table floor plan: shapes + grid placement + branch floor size

CREATE TYPE "DiningTableShape" AS ENUM ('CIRCLE', 'SQUARE', 'RECTANGLE');

ALTER TABLE "DiningTable"
  ADD COLUMN IF NOT EXISTS "shape" "DiningTableShape" NOT NULL DEFAULT 'SQUARE',
  ADD COLUMN IF NOT EXISTS "gridRow" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "gridCol" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "gridRowSpan" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "gridColSpan" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "tableFloorRows" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS "tableFloorCols" INTEGER NOT NULL DEFAULT 4;

-- Lay out existing tables by sortOrder into a 4-column grid; grow floor rows if needed.
WITH ranked AS (
  SELECT
    id,
    "branchId",
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE("branchId", "restaurantId")
      ORDER BY "sortOrder" ASC, name ASC
    ) - 1 AS idx
  FROM "DiningTable"
)
UPDATE "DiningTable" t
SET
  "gridRow" = ranked.idx / 4,
  "gridCol" = ranked.idx % 4,
  "shape" = 'SQUARE',
  "gridRowSpan" = 1,
  "gridColSpan" = 1
FROM ranked
WHERE t.id = ranked.id;

UPDATE "Branch" b
SET "tableFloorRows" = GREATEST(
  4,
  COALESCE(
    (
      SELECT MAX(t."gridRow") + 1
      FROM "DiningTable" t
      WHERE t."branchId" = b.id
    ),
    4
  )
),
"tableFloorCols" = GREATEST(4, b."tableFloorCols");
