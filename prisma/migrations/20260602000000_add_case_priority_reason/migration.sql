-- Human-readable explanation of why a case got its priority (set when the
-- screener auto-triages a new case; nullable / cleared on manual override).
ALTER TABLE "cases" ADD COLUMN "priority_reason" TEXT;
