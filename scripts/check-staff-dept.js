const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { prisma } = require("../src/prisma-client");

prisma.staff
  .findMany({
    where: { tenantId: "st-marys-hospital-id" },
    select: {
      employeeId: true,
      username: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  })
  .then((s) => console.log(JSON.stringify(s, null, 2)))
  .catch((e) => console.error(e.message))
  .finally(() => prisma.$disconnect());
