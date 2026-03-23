-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "fhLiveDate" DATETIME,
    "fhStatus" TEXT,
    "syncedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OtaListing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "propertyId" TEXT NOT NULL,
    "ota" TEXT NOT NULL,
    "status" TEXT,
    "subStatus" TEXT,
    "liveDate" DATETIME,
    "otaId" TEXT,
    "syncedAt" DATETIME NOT NULL,
    CONSTRAINT "OtaListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OtaListing_ota_idx" ON "OtaListing"("ota");

-- CreateIndex
CREATE INDEX "OtaListing_subStatus_idx" ON "OtaListing"("subStatus");

-- CreateIndex
CREATE UNIQUE INDEX "OtaListing_propertyId_ota_key" ON "OtaListing"("propertyId", "ota");
