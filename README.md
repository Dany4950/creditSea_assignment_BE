# CreditSea Backend

Node.js + Express + MongoDB (Mongoose) API for the CreditSea Flutter loan app.

## Quick start (local)

1. Install **Node.js 20 LTS** and create a free **MongoDB Atlas** cluster (Database Access -> add a user; Network Access -> allow `0.0.0.0/0`; Connect -> copy the connection string).
2. In this folder:
   ```bash
   cp .env.example .env        # then edit .env: MONGODB_URI, JWT_SECRET, ADMIN_KEY
   npm install
   npm run seed                # optional: demo users (see below)
   npm run dev                 # http://localhost:3000/api/health
   npm test                    # unit tests for pricing / credit score / dates
   ```
   Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Deploy on Render (free)
Push this folder to GitHub -> Render -> **New + > Blueprint** (uses `render.yaml`) or **New Web Service** with build `npm install`, start `npm start`. Set `MONGODB_URI` and `ADMIN_KEY`; keep `DEMO_MODE=true`. The free tier sleeps after inactivity, so the first request can take 30-50 s: open `/api/health` before using the app or recording.

## OTP (pool mode, no SMS provider)
OTP expiry (5 min), resend cooldown (30 s), attempt limit (5) and single use are real in every mode. Delivery is simulated:
- `DEMO_MODE=true`: the server keeps a pool of 5 valid codes (`OTP_POOL_MOBILE`, 4 digits; `OTP_POOL_EMAIL`, 6 digits).
  Every OTP request is answered with one random code from the pool (returned in the response and shown by the app as a notification);
  at verification **any** code from the pool is accepted. Defaults: mobile `4821 7350 1946 6037 2584`, email `482193 735028 194657 603714 258430`.
- **Real email OTP:** fill `SMTP_*` in the environment (Brevo free tier or Gmail app password). Email codes are then random, emailed and never returned.
- **Real SMS:** plug MSG91 / Twilio / Fast2SMS into `src/services/otpService.js` and set `DEMO_MODE=false`. India requires DLT registration
  for SMS sender IDs and templates, which takes days, so pool mode is used for review.

## Demo accounts (`npm run seed`, password `Demo@1234`)
| Mobile | PAN | Credit score | Result |
|---|---|---|---|
| 9999999999 | ABCDE1234F | 800 | up to Rs 1,00,000 |
| 8888888888 | ABCDE1230F | 600 | up to Rs 25,000 |
| 7777777777 | ABCDE0123F | 580 | not eligible |

PAN `AAAAA0000A` simulates "PAN not found".

## Business rules
- **Pricing:** 1% interest **per day**, tenure 20-45 days, single repayment, amount Rs 5,000+ in steps of Rs 1,000.
  `interest = principal x 1% x days`, `processingFee = 10% of principal` (deducted from disbursal), `totalPayable = principal + interest`, `disbursed = principal - fee`.
  Example: 30,000 for 40 days -> interest 12,000, fee 3,000, payable 42,000, disbursed 27,000.
- **Eligibility:** profile complete -> age 21-60 -> credit score >= 600 -> no other active loan.
- **Limit by score:** 600-649 -> 25,000 | 650-699 -> 50,000 | 700-749 -> 75,000 | 750+ -> 1,00,000.
- **Mock credit bureau:** PAN digits < 1000 -> 580; else 600 + (digits % 5) x 50.
- **Offer flow:** `POST /loans/apply` stores an `OFFERED` loan (a newer apply replaces it); `POST /loans/:id/accept` submits it.
- **Status flow:** `SUBMITTED -> UNDER_REVIEW -> KYC -> NACH -> SIGN -> DISBURSING -> DISBURSED`, or `REJECTED` after review.
  `statusLabel` maps this to the brief's chain: Submitted -> Under Review -> **Approved** (KYC/NACH/SIGN/DISBURSING) / **Rejected** -> Disbursed.
  A step advances every `STEP_DELAY_SECONDS` (default 8, whole flow about a minute). The review decision re-checks age, score and limit.
  Progress is computed lazily from timestamps whenever a loan is read, so it survives restarts and sleeping free-tier hosts.
- **Demo rejection:** with `DEMO_MODE=true`, a loan of exactly Rs 5,000 is rejected at review. Or force any outcome with the admin endpoint.

## API (base `/api`, JSON; errors: `{ "message", "code", "errors"? }`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /health | - | liveness |
| POST | /auth/request-otp | - | `{mobile}` -> sends 4-digit OTP (409 USER_EXISTS if registered) |
| POST | /auth/verify-otp | - | `{mobile, otp}` -> `{registrationToken}` |
| POST | /auth/set-password | - | `{mobile, password, registrationToken}` -> 201 |
| POST | /auth/login | - | `{mobile, password}` -> `{token, user}` |
| POST | /auth/logout | Bearer | invalidates all tokens of the user |
| GET/PUT | /user/profile | Bearer | read / edit name + marital status |
| GET/PUT | /onboarding/personal | Bearer | personal details (age >= 18) |
| GET | /onboarding/email | Bearer | `{email, verified}` |
| POST | /onboarding/email/send-otp, /verify | Bearer | email verification (6-digit OTP) |
| GET | /onboarding/pan | Bearer | `{verified, panMasked}` |
| POST | /onboarding/pan/verify | Bearer | `{pan}`; stored AES-256-GCM encrypted, never returned |
| GET | /loans/eligibility | Bearer | `{eligible, minAmount, maxAmount, reason?, message?, activeLoanId?}`; reason is one of ACTIVE_LOAN_EXISTS, SCORE_TOO_LOW, AGE_NOT_ELIGIBLE, PROFILE_INCOMPLETE |
| POST | /loans/quote | Bearer | `{amount, days}` -> server-side pricing |
| POST | /loans/apply | Bearer | `{amount, days, purpose}` -> 201 Loan (status OFFERED) |
| POST | /loans/:id/accept | Bearer | OFFERED -> SUBMITTED, engine starts |
| GET | /loans?page=&limit= | Bearer | paginated `{items, page, limit, total, hasMore}` (offers excluded) |
| GET | /loans/:id | Bearer | Loan (advances status lazily; poll it) |
| POST | /loans/:id/repay | Bearer | mock repayment + credit score update |
| PATCH | /admin/loans/:id/status | x-admin-key | `{action: approve\|reject\|disburse\|overdue, reason?}` |

Import `postman/creditsea.postman_collection.json` (set `baseUrl`, `adminKey`); requests save the tokens and loan id automatically.

## Credit scoring + repayment (bonus)
`POST /loans/:id/repay` `{method: UPI|CARD|NETBANKING}` is a **mock** payment (no real money). It marks a DISBURSED loan `REPAID`,
frees the user to borrow again and updates the credit score: **on time +50**, **late -30** (clamped to 300..900).
The score drives the loan limit (600 -> Rs 25,000, 650 -> Rs 50,000 ...), so repaying on time unlocks a higher limit.
Response: `{loan, creditScore, scoreChange, onTime}`. Double taps are safe (atomic status guard).
Demo: admin action `overdue` backdates the due date so a late repayment shows the penalty.
`npm run seed:loans` adds 25 historic loans to a demo user to demonstrate pagination.

## Security
bcrypt passwords, JWT with server-side revocation (`tokenVersion`), hashed single-use OTPs with expiry / cooldown / attempt limits, login lockout, rate limiting, Helmet, zod validation, PAN encryption, one-active-loan unique index, no request bodies in logs.

## Structure
`src/{config,controllers,middleware,models,routes,services,utils,validators}`, `scripts/seed.js`, `tests/`.
