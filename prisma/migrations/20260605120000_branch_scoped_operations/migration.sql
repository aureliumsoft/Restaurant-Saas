-- Branch-scoped orders and employee branch assignments

ALTER TABLE "Order" ADD COLUMN "branchId" TEXT;

CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");
CREATE INDEX "Order_restaurantId_branchId_ticketDate_idx" ON "Order"("restaurantId", "branchId", "ticketDate");

ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_restaurantId_ticketDate_ticketNumber_key";

CREATE UNIQUE INDEX "Order_restaurantId_branchId_ticketDate_ticketNumber_key" ON "Order"("restaurantId", "branchId", "ticketDate", "ticketNumber");

CREATE TABLE "EmployeeBranch" (
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "EmployeeBranch_pkey" PRIMARY KEY ("employeeId","branchId")
);

CREATE INDEX "EmployeeBranch_branchId_idx" ON "EmployeeBranch"("branchId");

ALTER TABLE "EmployeeBranch" ADD CONSTRAINT "EmployeeBranch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeBranch" ADD CONSTRAINT "EmployeeBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeInvite" ADD COLUMN "branchIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
