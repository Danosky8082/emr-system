// utils/username.js
const prisma = require('../lib/prisma');

/**
 * Generates a username in the form: <slug>-<4 random digits>
 * e.g. stmary-4821, caretech-0917
 *
 * Retries on collision so uniqueness is guaranteed within the tenant.
 *
 * @param {string} slug       - hospital slug (e.g. "stmary")
 * @param {number} tenantId   - hospital/tenant id
 * @param {object} [tx]       - optional Prisma transaction client
 * @returns {Promise<string>}
 */
async function generateUsername(slug, tenantId, tx = prisma) {
  const base = String(slug)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!base) throw new Error('Invalid slug for username generation');

  const MAX_ATTEMPTS = 50;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // 1000–9999, always 4 digits (no leading-zero ambiguity)
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const candidate = `${base}-${suffix}`;

    const existing = await tx.staff.findFirst({
      where: { tenantId, username: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;
  }

  throw new Error('Could not generate a unique username, please try again');
}

module.exports = { generateUsername };