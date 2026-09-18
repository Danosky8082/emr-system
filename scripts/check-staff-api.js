const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { prisma } = require("../src/prisma-client");

(async () => {
  console.log("→ starting");
  const admin = await prisma.staff.findFirst({
    where: { role: "Admin", tenantId: "st-marys-hospital-id" },
    select: { id: true, tenantId: true, email: true, username: true },
  });
  console.log("→ admin:", admin);
  if (!admin) {
    console.error("No admin found for st-marys-hospital-id");
    return;
  }
  const token = jwt.sign(
    { id: admin.id, role: "Admin", tenantId: admin.tenantId, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  console.log("→ token generated");
  const res = await axios.get("http://localhost:3000/api/staff", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("→ response status:", res.status);
  console.log(JSON.stringify(res.data, null, 2));
})()
  .catch((e) => {
    console.error("FAILED:");
    console.error(e.response?.data || e.message);
  })
  .finally(() => prisma.$disconnect());
