-- check-counts.sql
-- Shows how many records exist in each tenant-scoped table

SELECT 'Hospital' AS tbl, COUNT(*)::int AS total FROM "Hospital"
UNION ALL SELECT 'HospitalSettings', COUNT(*)::int FROM "HospitalSettings"
UNION ALL SELECT 'Clinic', COUNT(*)::int FROM "Clinic"
UNION ALL SELECT 'Ward', COUNT(*)::int FROM "Ward"
UNION ALL SELECT 'ServiceConfiguration', COUNT(*)::int FROM "ServiceConfiguration"
UNION ALL SELECT 'ServicePricing', COUNT(*)::int FROM "ServicePricing"
UNION ALL SELECT 'Medication', COUNT(*)::int FROM "Medication"
UNION ALL SELECT 'Staff', COUNT(*)::int FROM "Staff"
UNION ALL SELECT 'RolePermission', COUNT(*)::int FROM "RolePermission"
UNION ALL SELECT 'Patient', COUNT(*)::int FROM "Patient"
UNION ALL SELECT 'Department', COUNT(*)::int FROM "Department"
ORDER BY tbl;