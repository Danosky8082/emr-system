# PRE-LAUNCH TODO — TRIAL ENFORCEMENT

Trigger: 2 weeks before first paying customer

Steps:

1. Choose payment provider (recommend Paystack for Nigeria)
2. Build /billing/plans page
3. Build /billing/checkout flow (Paystack integration)
4. Add enforceTenantStatus() middleware:
   - Reads req.tenantId
   - Looks up hospital.plan + trialEndsAt
   - If trial expired AND plan = 'trial':
     - Allow /api/auth/login, /api/auth/logout, /api/hospitals/:id
     - Reject everything else with 402 Payment Required
5. Add <TrialBanner /> in Layout.jsx:
   - Shows only when plan = 'trial' and days remaining <= 7
   - Green if > 7 days, yellow if 3-7 days, red if < 3 days
6. Add axios interceptor in client.js:
   - On 402 response, redirect to /billing/plans
7. Add cron to auto-suspend hospitals 30 days after trial expiry

&&&&&&&&&&&&&&&&&

Answering each of your three questions

1. "Change Hospital" link — Do it now
   This is a 15-minute change and it's valuable for pitching. When you demo the app to a hospital owner, being able to switch tenants quickly shows off the multi-tenancy. Also, you have two hospitals seeded, so it's actually useful right now for your own testing.

Here's exactly what to add.

Step 1 — Add a "Change Hospital" button in the navbar's user section
Open emr-frontend/src/components/Layout.jsx. Find the .nav-user block:

jsx

<div className="nav-user">
  <span>{user?.firstName} {user?.lastName}</span>
  <span className="role-badge">{user?.role}</span>
  <button onClick={handleLogout} className="btn btn-danger btn-sm">Logout</button>
</div>
Replace with:

jsx

<div className="nav-user">
  <span>{user?.firstName} {user?.lastName}</span>
  <span className="role-badge">{user?.role}</span>
  <button
    onClick={() => {
      if (window.confirm('Switch to another hospital? You will be logged out.')) {
        handleLogout();
      }
    }}
    className="btn btn-secondary btn-sm"
    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
    title="Change hospital"
  >
    🏥 Switch
  </button>
  <button onClick={handleLogout} className="btn btn-danger btn-sm">Logout</button>
</div>
Why two buttons? Logout ends the session. "Switch" also logs out but signals a different intent — going back to the login page to log in as another hospital. Functionally identical, but clearer for users.

Optional — hide on mobile: if you want it only on desktop, add className="nav-hamburger" reversed... actually, keep it visible everywhere. On mobile it shows next to Logout, both compact.

Step 2 — Add it to the mobile menu too
Open emr-frontend/src/components/MobileMenu.jsx. Find the footer:

jsx

<div className="mobile-menu-footer">
  <button
    className="mobile-menu-logout"
    onClick={() => {
      onClose();
      window.dispatchEvent(new CustomEvent('app:logout'));
    }}
  >
    🚪 Logout
  </button>
</div>
Replace with:

jsx

<div className="mobile-menu-footer">
  <button
    className="mobile-menu-switch"
    onClick={() => {
      onClose();
      if (window.confirm('Switch to another hospital? You will be logged out.')) {
        window.dispatchEvent(new CustomEvent('app:logout'));
      }
    }}
  >
    🏥 Switch Hospital
  </button>
  <button
    className="mobile-menu-logout"
    onClick={() => {
      onClose();
      window.dispatchEvent(new CustomEvent('app:logout'));
    }}
  >
    🚪 Logout
  </button>
</div>
Append to emr-frontend/src/components/MobileMenu.css:

css
.mobile-menu-switch {
width: 100%;
padding: 12px 16px;
background: rgba(255, 255, 255, 0.1);
color: white;
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: 8px;
font-size: 14px;
font-weight: 600;
cursor: pointer;
margin-bottom: 8px;
transition: background 0.15s ease;
font-family: inherit;
}

.mobile-menu-switch:hover {
background: rgba(255, 255, 255, 0.2);
}
Deploy:

powershell
cd emr-frontend
npx vercel --prod --force
Test: log in as St. Mary's admin → click 🏥 Switch → you land on /login → log in as CareTech admin.

2. Trial enforcement — Wait until you go live
   Don't implement this now. Here's why:

Why it's premature
You have 0 real customers on trials right now. Both seeded hospitals have plan: 'trial' but nobody is actually using them except you.

Enforcing trials requires a billing flow you don't have yet. What happens when the trial expires? Redirect to a payment page? Which payment provider? Paystack? Flutterwave? Stripe? You haven't chosen.

Every "trial expired" edge case will break your dev workflow. You'll be constantly bumping trial dates on your test hospitals to keep testing.

A pitch demo with a "TRIAL EXPIRED" banner looks terrible. If a hospital owner is looking at the demo and sees the app nagging about expiry, they lose confidence.

What to do instead — right now
Just leave it as informational. The SuperAdmin dashboard already shows X days left for each hospital. That's enough for a pitch.

Add this to your pre-launch checklist and implement it 1–2 weeks before going live with your first paying customer:

text
PRE-LAUNCH TODO — TRIAL ENFORCEMENT
====================================

Trigger: 2 weeks before first paying customer

Steps:

1. Choose payment provider (recommend Paystack for Nigeria)
2. Build /billing/plans page
3. Build /billing/checkout flow (Paystack integration)
4. Add enforceTenantStatus() middleware:
   - Reads req.tenantId
   - Looks up hospital.plan + trialEndsAt
   - If trial expired AND plan = 'trial':
     - Allow /api/auth/login, /api/auth/logout, /api/hospitals/:id
     - Reject everything else with 402 Payment Required
5. Add <TrialBanner /> in Layout.jsx:
   - Shows only when plan = 'trial' and days remaining <= 7
   - Green if > 7 days, yellow if 3-7 days, red if < 3 days
6. Add axios interceptor in client.js:
   - On 402 response, redirect to /billing/plans
7. Add cron to auto-suspend hospitals 30 days after trial expiry
   Save this in a file called docs/pre-launch-trial-enforcement.md in your repo so it doesn't get lost.

What to say when pitching
When a hospital owner asks "what happens after the trial?":

"The trial runs for 14 days from signup. During that time you have full access. On day 15, if you haven't subscribed, the system goes read-only — you can see your data but can't add new records. You have 30 more days to subscribe before we archive the account. We'll notify you by email on day 10 and day 13."

Then implement it once you have a real contract.

3. Prisma migrations — Do it before the second developer joins
   Right now, prisma db push is fine because:

You're the only developer

Your schema changes are infrequent

Render's Docker builds db push works reliably

Migrate to proper migrations when any of these becomes true:

✅ A second developer joins the project

✅ You need to roll back a schema change

✅ You deploy to a second environment (staging + production)

✅ You need an audit trail of schema changes for compliance

Why migrations are better
prisma db push prisma migrate
Syncs schema directly to DB Creates versioned SQL files
No history Full history of every change
Can't roll back Can roll back to any point
Works for solo dev Required for teams
Might drop columns silently Explicit "this will lose data" prompts
How to migrate later (don't do this now)
When you're ready:

Step 1 — Generate the initial migration from your current schema:

powershell

# From emr-system/ — with .env pointing at your LOCAL DB

npx prisma migrate dev --name init --create-only
This creates prisma/migrations/0_init/migration.sql with the full schema.

Step 2 — Mark it as already applied on production:

powershell

# Point .env at Neon temporarily

npx prisma migrate resolve --applied 0_init

# Revert .env to localhost after

This tells Prisma "the production DB already has this schema — don't try to re-run it."

Step 3 — Update the Dockerfile:

Change:

dockerfile
CMD ["node", "server.js"]
To:

dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
Now every Render deploy runs pending migrations before starting the server.

Step 4 — Going forward, use migrations:

powershell

# Edit schema.prisma

npx prisma migrate dev --name add_new_field

# This creates a new migration file, applies it locally, and regenerates the client

# Commit the migration file

# On next Render deploy, `migrate deploy` applies it to production

Save this too in docs/pre-launch-prisma-migrations.md.

So — what to do right now
Task Do it now? Time
Change Hospital link ✅ Yes 15 min
Trial enforcement ❌ Wait until 2 weeks before first customer —
Prisma migrations ❌ Wait until 2nd developer or 2nd environment —
Rotate the 3 exposed secrets ✅ Yes 15 min
Fix More ▼ dropdown overflow ✅ Yes (if not done) 10 min
Right now, in order:
Add the Change Hospital button (both Layout.jsx and MobileMenu.jsx + CSS)

Confirm the More ▼ dropdown fix is applied

Deploy

Rotate the three secrets (Neon, Cloudinary, JWT) one at a time

That's your ~40-minute critical path.

Save two docs for later
Create these in your repo:

docs/pre-launch-trial-enforcement.md — with the checklist from section 2 above

docs/pre-launch-prisma-migrations.md — with the four-step migration guide from section 3 above

Then when you're 2 weeks from launch, you open the checklist and execute.

Report back
Confirmation the Switch Hospital button works on desktop and mobile

Confirmation the More ▼ dropdown now scrolls internally

Then we start the secret rotations

Once those three are done, your app is production-ready for a paid pilot.
