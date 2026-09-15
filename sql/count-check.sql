SELECT 'ServicePricing' AS tbl, COUNT(*)::int AS n FROM "ServicePricing"
UNION ALL SELECT 'Medication', COUNT(*)::int FROM "Medication"
UNION ALL SELECT 'Clinic', COUNT(*)::int FROM "Clinic"
UNION ALL SELECT 'Ward', COUNT(*)::int FROM "Ward"
UNION ALL SELECT 'Department', COUNT(*)::int FROM "Department"
UNION ALL SELECT 'Staff', COUNT(*)::int FROM "Staff";