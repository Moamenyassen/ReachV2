# Reach V2 — Product Roadmap

> Last updated: 2026-05-14
> This is a living working document. Update as features ship or priorities shift.

Reach V2 is positioned as a **Route Optimization System** for field sales teams. This roadmap turns it into one — and adds the surrounding features that make it sellable.

---

## 🎯 Strategic premise

The two existential gaps today:

1. **The app is called Route Optimizer but does not actually optimize routes.** [src/components/features/Optimizer/AIOptimizer.tsx](src/components/features/Optimizer/AIOptimizer.tsx) asks Gemini for advice. A real solver computes mathematically optimal routes in seconds. Competitors like Route4Me, Onfleet, and OptimoRoute charge $19-$249 per rep per month for this — and it can be built with free open-source software.
2. **No mobile / field-execution layer.** Field reps work outside, not at desks. There is currently no way for them to see today's route on a phone, navigate, mark customers as visited, or capture proof of visit.

Closing those two gaps takes the product from "an analytics dashboard with maps" to "an actual route optimization platform".

---

## 📊 Full decision table

Effort:
- 🟢 less than 1 day
- 🟡 2-5 days
- 🔴 1-6 weeks

| # | Feature | What it does | Effort | Build cost | Monthly cost | Revenue potential |
|---|---------|--------------|--------|------------|--------------|--------------------|
| 1 | **Real route solver** (VROOM / OR-Tools) | Calculates the actual best route per rep instead of asking Gemini for advice | 🔴 3-5 days | $0 | $0 | Justifies the product name; lets you charge $20+/rep |
| 2 | **Phone-friendly view (PWA)** | Reps add Reach to their phone home screen, see today's stops, tap "Visited" | 🔴 4-6 days | $0 | $0 → $25/mo at 100+ tenants | Field-ops customers pay 3× more for this |
| 3 | **Visit time windows + service duration** | Add DB columns: "this customer accepts visits 10am-12pm, takes 20 min" | 🟢 1 day | $0 | $0 | Required for #1 to be real |
| 4 | **Drag-and-drop route reorder** | Manager rearranges stops on a map, sees new distance live | 🟢 ½ day | $0 | $0 | "Pro" feel |
| 5 | **Distance + time labels on map** | Show "5.2 km · 12 min" on each route line | 🟢 1 hour | $0 | $0 | "Pro" feel |
| 6 | **Export route to Google Maps** | One-click button opens today's route in Google Maps for nav | 🟢 30 min | $0 | $0 | Bridge until mobile PWA ships |
| 7 | **Printable PDF route sheet** | Driver prints today's customers with checkboxes, phone numbers, GPS | 🟢 2 hours | $0 | $0 | Loved by old-school managers |
| 8 | **Tap-to-call phone numbers** | Tap a customer's phone in the app to call them | 🟢 15 min | $0 | $0 | Phone usability |
| 9 | **Excel two-way sync** | Manager edits routes in Excel, uploads, diff applied | 🟡 2-3 days | $0 | $0 | Kills the "we use Excel" sales objection |
| 10 | **Google Sheets connector** | Same idea via Google Sheets API | 🟡 2 days | $0 | $0 | Kills the "we use Sheets" objection |
| 11 | **Lead scoring in Market Scanner** | Each scanned business gets a fit score (proximity to route + industry + revenue) | 🟡 2-3 days | $0 | $0 (rules) or ~$3/mo (Gemini) | Premium-tier feature |
| 12 | **Churn prediction** | "These 23 customers haven't been visited in 6 weeks — likely to churn" | 🟡 2 days | $0 | $0 | Premium-tier feature, popular with sales managers |
| 13 | **Visit cadence recommender** | "Customer X should be weekly not monthly, based on order pattern" | 🟡 1-2 days | $0 | $0 | Premium-tier feature |
| 14 | **Sysadmin AI cost projection card** | Project monthly Gemini burn on the API Usage tab; alert when a tenant exceeds threshold | 🟢 1 hour | $0 | $0 | Operational sanity |
| 15 | **WhatsApp customer notifications** | "Your rep arrives in 30 min" auto-message | 🟡 3-5 days | $0 | ~$0.027 per message in SA → ~$27/mo per 1,000 messages | Sell as $5/mo add-on per tenant = 80% margin |
| 16 | **SMS notifications (fallback)** | Same as #15 but SMS via Twilio | 🟡 2 days | $0 | ~$0.04 per SMS (Twilio SA) | Bundle into WhatsApp add-on |
| 17 | **Email notifications** | Visit confirmations, license reminders, etc. | 🟢 1 day | $0 | Free up to 3k/mo (Resend); $20/mo for 50k | Operational |
| 18 | **Salesforce / HubSpot CRM sync** | Pull accounts, push visit activity back | 🔴 5-7 days each | $0 | $0 (free API tiers) | Enterprise deal-unblocker |
| 19 | **Webhook outputs** | On visit-complete / route-optimized / license-expiring, POST to customer URL | 🟢 1 day | $0 | $0 | Lets customers wire to Zapier/Make themselves |
| 20 | **Native iOS / Android apps** | Real App Store / Play Store apps (Capacitor wraps the PWA) | 🔴 4-6 weeks | $0 | $99/yr Apple + $25 one-time Google | "We have apps" credibility |
| 21 | **Production hosting** | Stop running uvicorn on a laptop; deploy to Railway/Fly.io/Render | 🟡 1 day | $0 | ~$30-50/mo | Required for paying customers |
| 22 | **Error monitoring (Sentry)** | Get notified when something crashes in production | 🟢 1 hour | $0 | Free up to 5k errors/mo; $26/mo paid | You catch bugs before customers do |
| 23 | **Per-rep pricing add-on** | Charge extra for each active field rep | 🟡 1-2 days | $0 | $0 | New revenue line; uses the usage logs already in place |
| 24 | **Public API for tenants** | Let large customers integrate Reach into their stack | 🟡 3 days | $0 | $0 | $99-499/mo enterprise add-on |

---

## 💰 Realistic monthly cost projections

| Phase | Tenants | Monthly recurring cost |
|---|---|---|
| Today (local dev, free Supabase) | 2 | **$0** |
| First paying customers (hosted backend + Supabase Pro) | 10 | **~$30-50** |
| 50 tenants, AI features on, no WhatsApp | 50 | **~$50-80** (+ ~$5 Gemini) |
| 100 tenants, AI on, ~5k WhatsApp msgs/mo | 100 | **~$200-300** total |
| 500 tenants, full stack on | 500 | **~$800-1,200** |

At ~$30/mo average per tenant, even 50 tenants ($1,500/mo MRR) leaves >95% gross margin. WhatsApp / SMS are the only line items that scale 1:1 with usage — and those should be billed through to the tenant.

---

## 🏆 Shipping order

| # | Feature | Estimated time | Recurring cost added |
|---|---------|----------------|----------------------|
| 1 | #3 Time windows + service duration (foundation) | 1 day | $0 |
| 2 | #1 Real route solver | 3-5 days | $0 |
| 3 | #5, #6, #4, #8 Quick wins batch (map labels, GMaps export, drag-reorder, tap-call) | 1 day | $0 |
| 4 | #2 Mobile PWA + visit-complete flow | 4-6 days | $0 |
| 5 | #9 or #10 Excel / Google Sheets sync | 2-3 days | $0 |
| 6 | #21, #22 Production hosting + Sentry | 1 day | ~$30-50/mo |
| 7 | #15 WhatsApp notifications | 3-5 days | Usage-based (billed through to tenant) |
| 8 | #11, #12, #13 Smart AI features batch | 1-2 weeks | Usage-based (~$3/mo) |
| 9 | #18 First CRM sync (Salesforce or HubSpot) | 5-7 days | $0 |
| 10 | #20 Native iOS / Android apps | 4-6 weeks | ~$10/mo amortized |

**Bottom line:** items 1-5 give you a real route-optimization product that runs on phones and integrates with Excel — all in roughly **3 weeks of focused work**, with **$0 recurring cost added**.

---

## 📱 Mobile PWA — Deep Dive (Item #2)

> **Status:** Phase 1 scope locked. Ready to build on confirmation.
> See the glossary at the bottom of this file for an explanation of PWA, Capacitor, etc.

### What a Reach PWA actually looks like to a user
1. Rep opens `reach.yourdomain.com` on their phone (Chrome on Android / Safari on iOS).
2. Browser shows a banner: **"Add Reach to home screen?"** Tap "Add".
3. The Reach icon appears on the home screen between WhatsApp and Camera.
4. Tapping it opens Reach **full-screen — no browser bar, no tabs**. Indistinguishable from a native app.
5. **No App Store. No download. No update process.** Push a code change → every rep gets it next time they open the app.

### A day in the life of a field rep (target experience by Phase 2)

| Time | What the rep sees on the phone |
|------|-------------------------------|
| **8:00 AM** | Opens Reach. Sees **"Today's Route: 22 stops · 87 km · est. 7h 30m"**. List of customers in optimal order. |
| **8:05 AM** | Taps customer #1 → sees address, phone, last visit notes, big **"Navigate"** button → opens Google Maps with turn-by-turn. |
| **8:30 AM** | Arrives. Taps **"Start Visit"** — app captures GPS. |
| **8:45 AM** | Done. Taps **"Mark Visited"** → quick form: outcome (sale / no-sale / closed), order amount, photo of storefront, customer signature. Submits. |
| **8:46 AM** | Card moves to "Done" pile. Customer #2 highlighted as **"Next →"**. |
| **10:15 AM** | No signal area. Marks customer #6 visited anyway — stored locally, shows **🔄 1 pending** badge. |
| **10:30 AM** | Signal back. Badge clears, all sync'd. |
| **3:00 PM** | Push notification: **"Manager added Customer #23 to your route"**. Tap → it appears in the right slot. |
| **5:30 PM** | End-of-day card: **"You visited 19/22 today. ✓ Submit Daily Report"** |

### Supervisor / manager view on mobile (same PWA, role-aware)

| | |
|---|---|
| 📍 **Live rep tracker** | Map showing where each rep is now (last GPS ping) |
| 📊 **Live progress** | "Ahmed: 12/20 · Khalid: 5/18 · Mona: 18/18 ✅" updating real-time |
| 🚨 **Alerts** | "Ahmed at same location for 45 min" / "Khalid missed his 11am window" |
| 💬 **Send message** | Push a note to a rep's phone instantly |
| 🔄 **Reassign** | Drag a customer between rep lists — pushed to both phones live |

### Phase breakdown

| Phase | Scope | Time | New libs / infra |
|---|---|---|---|
| **1 — Read-only today's route** | Install banner, login, today's route list, customer detail (tap-to-call / tap-to-navigate), map view, supervisor schedule view (limited) | 1-2 weeks | `vite-plugin-pwa` |
| **2 — Visit-complete loop** | Mark visited + outcome + photo + signature, offline write queue, new `visit_events` table | 2 weeks | Dexie.js, Supabase Storage |
| **3 — Live monitoring** | Rep GPS pings, manager live map, push notifications, in-app messaging | 1-2 weeks | Web Push (VAPID), Supabase Realtime extensions |
| **4 — Advanced (later)** | Auto end-of-day report, voice notes, barcode scanner, Capacitor wrap to App Store | 2-3 weeks | Capacitor, $99/yr Apple + $25 Google |

### Stack alignment — what's already in place

| Need | Status |
|---|---|
| React 19 + Vite | ✅ Already there (Vite has official PWA plugin) |
| Supabase Auth | ✅ Already wired |
| Supabase Realtime | ✅ Already used in `src/App.tsx` |
| Supabase Storage | ✅ Available for photos/signatures |
| Leaflet maps | ✅ Already used in desktop screens |
| FastAPI backend | ✅ Already there for any custom endpoints |
| `route_visits` table | ✅ Exists; needs `visit_events` companion in Phase 2 |
| HTTPS (required for PWA) | ⚠️ Need production hosting (~$30-50/mo) for real-world use |
| Service Worker + manifest | ⚠️ Need to add via `vite-plugin-pwa` (free) |
| Offline DB | ⚠️ Need Dexie.js (free) in Phase 2 |

**Net new infrastructure: Service Worker, manifest, Dexie.** All free open-source libraries. The hard parts (auth, realtime, DB, maps) are already done.

### Honest limitations

| Limitation | Severity | Workaround |
|---|---|---|
| **iOS push notifications** require iOS 16.4+ AND user must add to home screen first | 🟡 Medium | Android works perfectly. iOS users get in-app notifications instead |
| **iOS background GPS** severely limited — app must be open | 🟠 High | Manager sees rep's location only when rep has app open. Continuous tracking needs native |
| **Background sync** unreliable on iOS | 🟡 Medium | Sync on next app open (reps open app every 5-10 min anyway) |
| **App Store presence** | 🟡 Brand perception | Capacitor wrap later to ship to stores without rewriting |
| **iOS install friction** — "Add to Home Screen" hidden in Safari share menu | 🟡 Medium | Provide one-page guide with screenshots |
| **Deep OS integration** (Siri shortcuts, widgets, watch) | 🟢 Low | Not relevant for v1 |

**Bottom line:** Saudi Arabia / MENA market is ~70% Android — PWA is a fantastic fit. iOS users still get 80% of the value.

### PWA vs Native vs Hybrid

| | **PWA (recommended for v1)** | **Native iOS + Android** | **Hybrid (Capacitor wraps PWA)** |
|---|---|---|---|
| Time to ship v1 | **3-4 weeks** | 3-4 months × 2 platforms | 4-5 weeks |
| Cost to build | **$0** (your team) | $30-80k or 2 senior devs × 3 months | $0 (your team) |
| App Store presence | ❌ | ✅ | ✅ |
| iOS push notifications | ⚠️ Limited | ✅ Full | ✅ Full |
| iOS background GPS | ❌ | ✅ | ✅ |
| Update process | Push code → instant for all users | Submit to store → 1-7 day review | Submit to store, but JS updates instant |
| Apple Developer fee | $0 | $99/yr | $99/yr |
| Google Play fee | $0 | $25 one-time | $25 one-time |
| Code reuse | 100% with existing web app | 0% (separate codebases) | 95% (shared web code) |

**Recommended path:** ship the PWA first (Phases 1-3), prove product-market fit, **then wrap it in Capacitor (Phase 4+)** to get App Store presence without rewriting anything.

### Cost recap per phase

| Phase | One-time | Monthly recurring (added) |
|---|---|---|
| Phase 1 (read-only PWA) | $0 | $0 (free Supabase tier still OK) |
| Phase 2 (visit-complete + photos) | $0 | $25/mo when Supabase Storage exceeds 1 GB (~5,000 photos) |
| Phase 3 (live monitoring) | $0 | Free up to 2M realtime msgs/mo |
| Phase 4 (push notifications) | $0 | Free (web push uses your own server) |
| **Production hosting** (required for HTTPS / real-world use) | $0 | **~$30-50/mo** |
| Capacitor → App Store (later) | $0 | $99/yr Apple + $25 one-time Google |

**Total to launch full PWA: ~$30-50/mo recurring.** No per-rep fees, no App Store cuts.
For comparison: Onfleet charges **$149/mo for 3 drivers** ($50/driver/mo). You build equivalent for $50/mo total across all customers.

---

### ✅ Phase 1 locked decisions (2026-05-14)

| | Decision |
|---|---|
| **Scope** | Minimal — read-only "today's route" |
| **Roles with access** | USER, DRIVER, SUPERVISOR |
| **Subscription gate** | Elite tier only (non-elite tenants see upgrade prompt with "Talk to Sales" CTA) |
| **App routing** | `/m/*` routes inside the existing app (same codebase, no new infrastructure) |
| **Icon** | Generated placeholder using brand indigo/purple; swap with designer asset later |
| **Supervisor view in Phase 1** | Included as a limited schedule viewer (planned routes only — no live data until Phase 2) |

### 📋 Phase 1 deliverables (the build list)

| # | Deliverable | Notes |
|---|---|---|
| 1 | **PWA scaffolding** | `vite-plugin-pwa`, manifest, icons (192/512), service worker, "Add to home screen" prompt |
| 2 | **`/m` route gate** | Checks: authenticated + role ∈ {USER, DRIVER, SUPERVISOR} + company tier = Elite. Non-elite → upgrade prompt |
| 3 | **Mobile login layout** | Reuses Supabase Auth; tap-friendly form |
| 4 | **REP — Today's route list** | Customer cards in route order, status, distance to next, big "Navigate" button |
| 5 | **REP — Customer detail screen** | Address, tap-to-call phone, tap-to-WhatsApp, notes, past visit history |
| 6 | **REP — Map view tab** | Leaflet, reduced UI, all today's pins, current-location pin |
| 7 | **SUPERVISOR — Schedule view** | List of reps in their branch, today's stop count per rep, tap rep → schedule |
| 8 | **SUPERVISOR — Map overview** | All reps' routes overlaid with different colors |
| 9 | **iOS install guide** | One-screen popup with screenshots for "Add to Home Screen" via Safari share menu |
| 10 | **Mobile shell** | Bottom nav: Today · Map · Profile · Logout |
| 11 | **Theme + branding** | Respects company white-label colors via existing `BrandThemeContext` |

**NOT in Phase 1** (will show "Coming soon"): Mark Visited, photos, signatures, offline support, live GPS, real-time updates, push notifications, reschedule/cancel.

### 📅 Phase 1 timeline

| Day | Work |
|---|---|
| 1-2 | PWA scaffolding + manifest + service worker + tier/role gate |
| 3-5 | Rep "Today's route" list + customer detail + tap-to-call/nav |
| 6-7 | Map view + supervisor schedule view |
| 8 | iOS install guide + polish + bottom nav |
| 9-10 | End-to-end test on real Android + iOS phones, fix issues, browser verify |

**Total: ~2 calendar weeks of focused work.**

### 💰 Phase 1 cost
- Code & libraries: **$0**
- Hosting (local dev OK for testing): **$0**
- Reach icon: **$0** (generated placeholder, swap later)
- **Total recurring: $0**

Production hosting (~$30-50/mo) only needed when reps need to use it from outside your network.

---

## 📖 Quick glossary

| Term | Plain English |
|------|---------------|
| **PWA** (Progressive Web App) | A website that behaves like a phone app — has an icon on the home screen, opens full-screen, works offline. Twitter, Uber, and WhatsApp Web are all PWAs. No App Store required. |
| **VRP** (Vehicle Routing Problem) | The math problem of "what is the shortest set of routes that visits all my customers given X reps and Y constraints?" With 200 customers, the number of possible answers is bigger than the number of atoms in the universe — so you need a smart algorithm. |
| **VROOM** | Free, open-source software that solves VRP fast. Made by a French company (Verso). Used in production by Decathlon and the French Red Cross. Installs once, used forever, no recurring cost. |
| **OR-Tools** | Google's free open-source alternative to VROOM. Slower but handles weird constraints better (lunch breaks, vehicle types, skills). |
| **Capacitor** | Free tool that wraps your PWA into native iOS / Android apps so they can ship in the App Store / Play Store. Same web code, native shell. |
| **Realtime** (Supabase) | Live updates pushed to the browser — e.g. seeing a rep's GPS position move on the map without refreshing. |

---

## 🔁 Change log

| Date | Change |
|------|--------|
| 2026-05-14 | Roadmap created with 24-item feature table, cost analysis, glossary, and shipping order. |
| 2026-05-14 | Added "Mobile PWA — Deep Dive" section: full feature breakdown for all 4 phases, day-in-the-life walkthroughs, PWA vs Native vs Hybrid comparison, honest iOS limitations, locked Phase 1 decisions (read-only scope · USER/DRIVER/SUPERVISOR roles · Elite-tier gate · `/m/*` routes · supervisor schedule viewer included), and 11-item Phase 1 build list with 10-day timeline. |
