-- CreateTable
CREATE TABLE "financial_statuses" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hasDebt" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'REGULAR',
    "outstandingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_statuses_studentId_key" ON "financial_statuses"("studentId");

-- CreateIndex
CREATE INDEX "financial_statuses_schoolId_idx" ON "financial_statuses"("schoolId");

-- CreateIndex
CREATE INDEX "financial_statuses_status_idx" ON "financial_statuses"("status");
