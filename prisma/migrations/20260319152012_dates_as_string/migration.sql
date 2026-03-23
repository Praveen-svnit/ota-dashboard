-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OtaListing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "propertyId" TEXT NOT NULL,
    "ota" TEXT NOT NULL,
    "status" TEXT,
    "subStatus" TEXT,
    "liveDate" TEXT,
    "otaId" TEXT,
    "syncedAt" TEXT NOT NULL,
    CONSTRAINT "OtaListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OtaListing" ("id", "liveDate", "ota", "otaId", "propertyId", "status", "subStatus", "syncedAt") SELECT "id", "liveDate", "ota", "otaId", "propertyId", "status", "subStatus", "syncedAt" FROM "OtaListing";
DROP TABLE "OtaListing";
ALTER TABLE "new_OtaListing" RENAME TO "OtaListing";
CREATE INDEX "OtaListing_ota_idx" ON "OtaListing"("ota");
CREATE INDEX "OtaListing_subStatus_idx" ON "OtaListing"("subStatus");
CREATE UNIQUE INDEX "OtaListing_propertyId_ota_key" ON "OtaListing"("propertyId", "ota");
CREATE TABLE "new_Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "fhLiveDate" TEXT,
    "fhStatus" TEXT,
    "syncedAt" TEXT NOT NULL
);
INSERT INTO "new_Property" ("city", "fhLiveDate", "fhStatus", "id", "name", "syncedAt") SELECT "city", "fhLiveDate", "fhStatus", "id", "name", "syncedAt" FROM "Property";
DROP TABLE "Property";
ALTER TABLE "new_Property" RENAME TO "Property";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
