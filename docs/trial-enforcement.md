# Trial Enforcement — Pre-Launch Checklist

The hospital schema already contains these fields:

| Field                | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `plan`               | "trial" \| "basic" \| "pro" \| "enterprise" |
| `status`             | "active" \| "suspended"                     |
| `isActive`           | Boolean (suspended check)                   |
| `trialEndsAt`        | When the 14-day trial ends                  |
| `subscriptionEndsAt` | When the paid plan renews                   |
| `maxStaff`           | Staff limit for this plan                   |
| `maxPatients`        | Patient limit for this plan                 |

They are **intentionally not enforced during development**.

## To enable enforcement before launch:

### Step 1: Add the middleware to server.js

```javascript
const enforceTenantStatus = async (req, res, next) => {
  try {
    if (req.path.startsWith("/api/platform")) return next();
    if (!req.tenantId) return next();

    const hospital = await prisma.hospital.findUnique({
      where: { id: req.tenantId },
      select: {
        plan: true,
        status: true,
        isActive: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    });

    if (!hospital) return res.status(403).json({ error: "Hospital not found" });

    if (!hospital.isActive || hospital.status === "suspended") {
      return res.status(403).json({
        error: "Hospital account is suspended.",
        code: "HOSPITAL_SUSPENDED",
      });
    }

    if (
      hospital.plan === "trial" &&
      hospital.trialEndsAt &&
      new Date(hospital.trialEndsAt) < new Date()
    ) {
      return res.status(402).json({
        error: "Trial expired. Please upgrade.",
        code: "TRIAL_EXPIRED",
        trialEndsAt: hospital.trialEndsAt,
      });
    }

    if (
      hospital.plan !== "trial" &&
      hospital.subscriptionEndsAt &&
      new Date(hospital.subscriptionEndsAt) < new Date()
    ) {
      return res.status(402).json({
        error: "Subscription expired. Please renew.",
        code: "SUBSCRIPTION_EXPIRED",
      });
    }

    next();
  } catch (err) {
    console.error("Tenant enforcement error:", err);
    next();
  }
};
```
