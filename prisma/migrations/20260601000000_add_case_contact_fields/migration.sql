-- Resident-provided contact info on a case, so caseworkers can see who needs
-- help and reach them. All nullable (anonymous sessions may omit them).
ALTER TABLE "cases" ADD COLUMN "contact_name" TEXT;
ALTER TABLE "cases" ADD COLUMN "contact_email" TEXT;
ALTER TABLE "cases" ADD COLUMN "contact_phone" TEXT;
