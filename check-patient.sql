-- check-patient.sql
-- Verify the soft-deleted patient still exists in the DB

SELECT
  id,
  "hospitalId",
  "firstName",
  "lastName",
  "deletedAt",
  "deletedBy",
  "deleteReason",
  "fileStatus",
  "isArchived"
FROM "Patient"
WHERE id = 'cmtzwkx0z00199clgfvkvkk15';