/*
  Warnings:

  - The values [WALLETS] on the enum `CustomerPaymentProvider` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `slotDurationMinutes` on the `Branch` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `customerAccountId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `groupName` on the `OrderItemModifier` table. All the data in the column will be lost.
  - You are about to drop the column `cardPaymentsEnabled` on the `Restaurant` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryEnabled` on the `Restaurant` table. All the data in the column will be lost.
  - You are about to drop the column `dineInEnabled` on the `Restaurant` table. All the data in the column will be lost.
  - You are about to drop the column `dineInPaymentTiming` on the `Restaurant` table. All the data in the column will be lost.
  - You are about to drop the `BlogPost` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BranchIngredientStock` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomerAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomerSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentationHeading` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentationModule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentationSubHeading` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ingredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IngredientStockEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MenuCategoryHiddenBranch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MenuItemIngredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NewsletterCampaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NewsletterSubscriber` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlatformFaq` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RestaurantEasypaisaCredentials` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RestaurantJazzCashCredentials` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CustomerPaymentProvider_new" AS ENUM ('NONE', 'PAYPAL', 'STRIPE');
ALTER TABLE "Restaurant" ALTER COLUMN "customerPaymentProvider" DROP DEFAULT;
ALTER TABLE "Restaurant" ALTER COLUMN "customerPaymentProvider" TYPE "CustomerPaymentProvider_new" USING ("customerPaymentProvider"::text::"CustomerPaymentProvider_new");
ALTER TYPE "CustomerPaymentProvider" RENAME TO "CustomerPaymentProvider_old";
ALTER TYPE "CustomerPaymentProvider_new" RENAME TO "CustomerPaymentProvider";
DROP TYPE "CustomerPaymentProvider_old";
ALTER TABLE "Restaurant" ALTER COLUMN "customerPaymentProvider" SET DEFAULT 'NONE';
COMMIT;

-- DropForeignKey
ALTER TABLE "BranchIngredientStock" DROP CONSTRAINT "BranchIngredientStock_branchId_fkey";

-- DropForeignKey
ALTER TABLE "BranchIngredientStock" DROP CONSTRAINT "BranchIngredientStock_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_accountId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerAccount" DROP CONSTRAINT "CustomerAccount_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerSession" DROP CONSTRAINT "CustomerSession_accountId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentationModule" DROP CONSTRAINT "DocumentationModule_headingId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentationModule" DROP CONSTRAINT "DocumentationModule_subHeadingId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentationSubHeading" DROP CONSTRAINT "DocumentationSubHeading_headingId_fkey";

-- DropForeignKey
ALTER TABLE "Ingredient" DROP CONSTRAINT "Ingredient_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientStockEntry" DROP CONSTRAINT "IngredientStockEntry_branchId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientStockEntry" DROP CONSTRAINT "IngredientStockEntry_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientStockEntry" DROP CONSTRAINT "IngredientStockEntry_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientStockEntry" DROP CONSTRAINT "IngredientStockEntry_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientStockEntry" DROP CONSTRAINT "IngredientStockEntry_menuItemVariationId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientStockEntry" DROP CONSTRAINT "IngredientStockEntry_orderId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientStockEntry" DROP CONSTRAINT "IngredientStockEntry_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "MenuCategoryHiddenBranch" DROP CONSTRAINT "MenuCategoryHiddenBranch_branchId_fkey";

-- DropForeignKey
ALTER TABLE "MenuCategoryHiddenBranch" DROP CONSTRAINT "MenuCategoryHiddenBranch_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItemIngredient" DROP CONSTRAINT "MenuItemIngredient_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItemIngredient" DROP CONSTRAINT "MenuItemIngredient_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItemIngredient" DROP CONSTRAINT "MenuItemIngredient_menuItemVariationId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerAccountId_fkey";

-- DropForeignKey
ALTER TABLE "RestaurantEasypaisaCredentials" DROP CONSTRAINT "RestaurantEasypaisaCredentials_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "RestaurantJazzCashCredentials" DROP CONSTRAINT "RestaurantJazzCashCredentials_restaurantId_fkey";

-- DropIndex
DROP INDEX "Customer_accountId_idx";

-- DropIndex
DROP INDEX "Customer_restaurantId_accountId_key";

-- DropIndex
DROP INDEX "Customer_restaurantId_idx";

-- DropIndex
DROP INDEX "MenuItemAttributeGroup_defaultLinkedRestaurantVariationId_idx";

-- DropIndex
DROP INDEX "Order_customerAccountId_createdAt_idx";

-- DropIndex
DROP INDEX "Order_customerAccountId_restaurantId_createdAt_idx";

-- AlterTable
ALTER TABLE "Branch" DROP COLUMN "slotDurationMinutes";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "accountId";

-- AlterTable
ALTER TABLE "MenuItemAttributeGroup" ADD COLUMN     "productOverrides" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "customerAccountId",
ALTER COLUMN "shortOrderId" SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- AlterTable
ALTER TABLE "OrderItemModifier" DROP COLUMN "groupName";

-- AlterTable
ALTER TABLE "Restaurant" DROP COLUMN "cardPaymentsEnabled",
DROP COLUMN "deliveryEnabled",
DROP COLUMN "dineInEnabled",
DROP COLUMN "dineInPaymentTiming";

-- DropTable
DROP TABLE "BlogPost";

-- DropTable
DROP TABLE "BranchIngredientStock";

-- DropTable
DROP TABLE "CustomerAccount";

-- DropTable
DROP TABLE "CustomerSession";

-- DropTable
DROP TABLE "DocumentationHeading";

-- DropTable
DROP TABLE "DocumentationModule";

-- DropTable
DROP TABLE "DocumentationSubHeading";

-- DropTable
DROP TABLE "Ingredient";

-- DropTable
DROP TABLE "IngredientStockEntry";

-- DropTable
DROP TABLE "MenuCategoryHiddenBranch";

-- DropTable
DROP TABLE "MenuItemIngredient";

-- DropTable
DROP TABLE "NewsletterCampaign";

-- DropTable
DROP TABLE "NewsletterSubscriber";

-- DropTable
DROP TABLE "PlatformFaq";

-- DropTable
DROP TABLE "RestaurantEasypaisaCredentials";

-- DropTable
DROP TABLE "RestaurantJazzCashCredentials";

-- DropEnum
DROP TYPE "DineInPaymentTiming";

-- DropEnum
DROP TYPE "IngredientStockEntrySource";

-- DropEnum
DROP TYPE "IngredientUnit";
