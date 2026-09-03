# The Grove — Custom Lead Widget

A self-contained FAB + modal widget for thegrove's RentCafe website, replacing
the current EliseAI chat bubble with three tiles: **Email an Agent**,
**Book a Tour**, and **Call or Text Us**. All three are custom forms that
post to our own backend (email + Attio); "Call or Text Us" additionally
hands the visitor's phone number to EliseAI's `textMe` endpoint so their AI
picks up the conversation by text, matching how BCGK already uses EliseAI
today.

See the project doc **`requirements-and-access-checklist.md`** for the full
requirements review, decisions log, and open questions this build is based
on — this README only covers running and deploying the code.

## What's in this folder

```
api/
  email-agent.js   Serverless function: POST /api/email-agent
  book-tour.js     Serverless function: POST /api/book-tour
  call-text.js     Serverless function: POST /api/call-text (email + Attio + EliseAI hand-off)
lib/
  config.js        Recipients, Attio object/attribute mapping, brand-ish constants
  email.js         Postmark API wrapper (fetch-based, no dependency)
  attio.js         Attio v2 API wrapper (fetch-based, no dependency)
  eliseai.js       Hands a phone number to EliseAI's "textMe" endpoint
  ics.js           Hand-rolled .ics calendar invite generator
  timezone.js      Correct wall-clock-to-UTC conversion for tour times
  validate.js      Required-field + honeypot + email/phone validation
  ratelimit.js     Minimal per-instance rate limiting
  cors.js          CORS headers (currently open "*", see TODO inside)
public/
  widget.js        The embeddable front-end widget (FAB + modal), Shadow-DOM isolated
scripts/
  test-postmark.js           Sends one real test email — confirms your token + sender work
  list-attio-attributes.js   Prints your object's real attribute slugs
  test-attio.js              Creates one real test record — confirms your key + mapping work
  build-preview.js           Regenerates preview.html/index.html from the current widget.js
preview.html       Standalone visual demo (mocked network calls) — open directly in a browser
index.html         Same file as preview.html, so opening this folder/zip previews by default
vercel.json        Rewrites /widget.js -> /public/widget.js (required — see Section 5)
.vercelignore      Keeps dev-only files (scripts/, .env.example) out of the public deployment
```

## 1. Do you need GitHub? Do you need to "deploy"?

Short answer: **yes, you need to deploy this somewhere** — but no, GitHub
isn't required to do that.

Here's why deployment isn't optional: RentCafe's HTML box can only serve
static content straight to a visitor's browser. It has no way to run the
Node.js backend that actually sends email, talks to Attio, and calls
EliseAI — that code needs to live on a server with its own address on the
internet, running all the time, which is what Vercel is for. `widget.js`
(the part that goes in RentCafe) and the `/api/*` functions (the part that
needs to stay off RentCafe) are deployed together as one Vercel project;
RentCafe ends up loading `widget.js` from Vercel's address instead of from
a file on RentCafe itself.

Two ways to get this onto Vercel — pick whichever feels easier:

**Option A — no GitHub, fastest to try today:**
1. Install Node.js if you don't have it (nodejs.org), then in a terminal:
   `npm install -g vercel`.
2. `cd` into this folder, run `vercel`, and answer its prompts (it'll ask
   you to log in — a free Vercel account is fine — and to confirm the
   project name/settings; defaults are fine for all of them).
3. That's it — it prints a live URL like `https://grove-widget-xyz.vercel.app`.

**Option B — GitHub first, then Vercel (recommended if you'll keep
updating this over time):**
1. Create a new GitHub repo and push this folder to it (GitHub's own "Add
   file → Upload files" button works fine for this if you don't want to
   use git commands directly).
2. In Vercel's dashboard, "Add New Project" → "Import" that GitHub repo.
3. Every time you (or I) push a code change to that repo, Vercel
   automatically redeploys — no manual re-upload needed. This is the
   easier path once we're iterating on this regularly, since I can hand
   you updated files to push instead of a new zip each time.

Either way you end up with the same thing: a live URL, and a project
dashboard where the next step happens.

## 2. Setting up Postmark

**Yes — you'll need your own Postmark account.** It's a separate signup
from Vercel/Attio/EliseAI, at postmarkapp.com. Postmark's free/developer
tier gives you 100 test emails total (sent only to your own verified
addresses) to confirm everything works; moving to a paid plan (billed by
volume, starting around $15/month for 10,000 emails) is what lifts that
cap so real visitor emails actually deliver — for a leasing office's
lead-form volume that entry tier is plenty of headroom. Confirm current
pricing at postmarkapp.com/pricing before committing, since plans change.

1. Sign up at postmarkapp.com and create a "Server" (Postmark's term for a
   sending environment — one is enough for this widget).
2. Get your **Server API token**: inside that server, go to **API Tokens**
   and copy the token shown there. This is the one secret this integration
   needs — treat it like a password (see "Where your keys go," below).
3. Verify a sender: **Sender Signatures** (for a single "from" address) or
   full **Domains** verification (adds SPF/DKIM DNS records, and is what
   you'll want long-term for deliverability — especially since one
   recipient here is an automated inbox, Reffie's ingestion address, that's
   more likely to filter unauthenticated mail).
4. **Before wiring this into Vercel at all**, confirm the token works with
   `scripts/test-postmark.js` (see "Example code" below) — much faster to
   debug locally than through a deployed function.
5. **Request approval before relying on this for real.** New Postmark
   accounts start in **Test mode** (you'll see that label, plus a
   "Request approval" button, in the top nav). While in Test mode, mail to
   real outside inboxes — like Reffie's automated ingestion address — can
   be held or blocked outright, even with a perfectly valid sender and
   correct code. Click **Request approval** and answer its short
   questionnaire; this is the single most likely reason a test submission
   "doesn't arrive" with everything else configured correctly.

One nuance worth understanding on sender verification: **Sender
Signatures** (verifying one specific "from" address, e.g.
`chuck@bcgk.com`) is enough to send today — it doesn't require the domain
itself to show as fully authenticated. The domain-level "DKIM Not
Verified" / "Return-Path Not Verified" flags you'll see under **Sender
Signatures → [your domain]** are a *deliverability* improvement (mail is
less likely to be marked spam, which matters more for an automated inbox
like Reffie's than for a person's inbox) — not a requirement to send.
Setting those up (the "Add a DKIM DNS record" link, or the banner's "Get
started" flow) is worth doing before fully relying on this, but it isn't
what's blocking a first test.

## 3. Configuring Attio properly

Chuck already created the custom object (`TheGroveCustomWidget`, 5
attributes) — here's how to finish connecting it:

1. **Create the API key.** In Attio: **Settings → Developers → API keys →
   Create API key**. Give it exactly two scopes — `object_configuration:read`
   and `record_permission:read-write` — rather than a full-access key,
   since that's all this widget ever needs to do.
2. **Find your object's real attribute slugs.** Attio's API identifies each
   attribute by an internal `api_slug`, which isn't always obvious from the
   UI. Run:
   ```
   ATTIO_API_KEY=your_real_key node scripts/list-attio-attributes.js
   ```
   This prints every attribute on `TheGroveCustomWidget` with its real
   slug and type. Compare that list against what this widget sends: first
   name, last name, email, phone, message, how-did-you-hear-about-us,
   bedroom preference, tour date, tour time, lead source, and property.
3. **Add any missing attributes.** With only 5 attributes on the object
   today, some of the above are probably missing — add them in Attio
   (**Settings → Objects → TheGroveCustomWidget → Attributes → + Add
   attribute**), as plain **Text** attributes unless you want something
   fancier (e.g. a **Select** attribute for "lead source" with fixed
   options like "Email an Agent" / "Book a Tour" / "Call or Text Us").
4. **Update the mapping in code.** Open `lib/config.js` and replace the
   placeholder slugs on the right-hand side of `attio.attributeMap` with
   the real `api_slug` values from step 2 — the left-hand keys (`firstName`,
   `email`, etc.) are used by the code and shouldn't change.
5. **Test it for real** with `scripts/test-attio.js` (below) before ever
   wiring it into Vercel.

One more thing already built in: the Attio code uses an "upsert" rather
than a plain "create," matching on email (or phone, for the Call/Text form
which doesn't collect email) — so if the same person emails an agent and
later books a tour, it updates one Attio record instead of creating a
duplicate.

**Important: an API key alone is not enough — the attribute slugs have to
actually match, or the whole record write fails.** This widget sends up to
eleven fields depending on the form (first name, last name, email, phone,
message, how-heard, bedroom preference, tour date, tour time, lead source,
property). If even one entry in `attio.attributeMap` points at a slug that
doesn't exist on `TheGroveCustomWidget`, Attio rejects the *entire* request
— it's not "the other 10 fields save and this one gets skipped," it's the
full record failing to write. And because each endpoint's design treats
Attio and email as independent (`Promise.allSettled`), a failed Attio write
does **not** show as an error to the person filling out the form — they
still get a normal "thanks" response, since the email notification went
through. That makes a bad slug invisible from the visitor side, so before
this goes live: run `scripts/test-attio.js`, confirm a "Test Widget" record
actually appears in Attio (not just that the script printed success), and
afterward keep an eye on Vercel's function logs for `call-text: failed to
write to Attio` / similar lines the first few days live.

Date and time need **two separate Attio attributes** (`tour_date` and
`tour_time`, or whatever you rename their slugs to) — the code doesn't
combine them into one field.

## 4. Example code: testing Postmark and Attio before deploying anything

Rather than just describing the API calls, three small scripts in
`scripts/` actually make them, so you can confirm both integrations work
*before* touching Vercel at all — much faster to fix a typo'd key or a
wrong attribute slug locally than through a deployed function's logs.

**Postmark** — sends one real test email:
```bash
POSTMARK_SERVER_TOKEN=xxxxxxxx FROM_EMAIL=you@yourdomain.com TO_EMAIL=you@yourdomain.com \
  node scripts/test-postmark.js
```
`FROM_EMAIL` must be the address (or domain) you verified in step 3 above,
or Postmark will reject the send. Success looks like `Sent!` printed to the
terminal and a real email landing in `TO_EMAIL`.

**Attio** — lists your object's real attributes:
```bash
ATTIO_API_KEY=your_real_key node scripts/list-attio-attributes.js
```

**Attio** — creates one real test record, using whatever mapping is
currently in `lib/config.js`:
```bash
ATTIO_API_KEY=your_real_key node scripts/test-attio.js
```
Success looks like a "Test Widget" record appearing in Attio under
`TheGroveCustomWidget` — delete it once you've confirmed the fields landed
correctly.

These same functions (`lib/email.js`'s `sendEmail` and `lib/attio.js`'s
`createLeadRecord`) are exactly what `/api/email-agent.js`, `/api/book-tour.js`,
and `/api/call-text.js` call in production — the test scripts aren't a
simplified example, they're calling the real code paths.

**Where your keys go — never in chat, always in Vercel.** Once
`test-postmark.js` and `test-attio.js` both succeed, the *only* other place
either value goes is your Vercel project's **Settings → Environment
Variables** (add `POSTMARK_SERVER_TOKEN` and `ATTIO_API_KEY` there, exactly
as named in `.env.example`) — never paste a real key into this chat, an
email, or a Slack message, and never commit a `.env` file with real values
to GitHub. Vercel injects them into the running `/api/*` functions at
request time; they never reach RentCafe or the visitor's browser. If you
ever do paste a key somewhere it shouldn't be, the fix is to revoke/rotate
it at the source (Postmark's API Tokens page, Attio's API keys page) and
generate a fresh one.

## 5. Embed it on the live RentCafe site

**Important — this requires `vercel.json` to be part of what you deployed.**
Vercel's zero-config "Other" preset (no framework detected, which is what
this project uses) serves every file at its literal repo path — so without
help, `public/widget.js` is only reachable at `/public/widget.js`, not the
`/widget.js` the rest of this README and RentCafe's snippet assume. The
`vercel.json` in this project adds one rewrite rule to fix that:
```json
{ "rewrites": [{ "source": "/widget.js", "destination": "/public/widget.js" }] }
```
If you deployed before this file existed, or your deploy tool/step skipped
it, `/widget.js` will 404 and nothing below will work — redeploy with
`vercel.json` included (see "Fixing an existing deployment" below if you've
already gone live once).

`widget.js` automatically figures out which backend to talk to from its own
`<script src="...">` URL — so once step 1's Vercel URL exists, there's no
separate "point it at my API" step or URL to copy into the code. The whole
snippet is one line:

```html
<script src="https://YOUR-DEPLOYMENT.vercel.app/widget.js" defer></script>
```

RentCafe's Site Editor has (at least) two different places EliseAI's code
currently lives, and they behave differently — worth telling apart before
pasting anything:

- **HTML Content Library** (the "EliseAI Widget" content item, edited via a
  modal with a rich-text/`</>`  toggle) — this one accepts literal HTML,
  including `<script>` tags, exactly as typed. **Replace its entire
  contents with the one-line snippet above.** This is the natural home for
  our widget since it's a plain `<script src>` tag, same shape as what's
  there today.
- **Custom JS** (the left-hand "Custom Content and Tools" panel, under
  Custom SCSS) — this one auto-wraps whatever you paste inside its own
  `(async () => { ... })();` function; it's meant for raw JS statements,
  not a `<script>` tag. **Delete the EliseAI code from this box and save it
  empty** (or with just a comment like `// widget now lives in the HTML
  Content Library item instead`) — if you leave it in place, EliseAI's chat
  bubble will keep loading *alongside* ours, so visitors would see two
  competing widgets.

If you're not sure which of the two is actually what's rendering the
bubble on the live page (they may both be pointed at the same
organization/building, which suggests some duplication already), the safe
order is: update the HTML Content Library item first, publish, reload the
live page, and confirm only one bubble (ours) appears; if EliseAI's still
shows up, the Custom JS box is the other place still loading it — clear
that too.

Save/publish in RentCafe, then load the live page: the widget should
auto-open (on every page load, by design — see `CONFIG.autoOpenOnLoad` in
`public/widget.js`, no "only show once" logic), and every form it submits
will call back to that same Vercel project — which is exactly where the
Postmark and Attio credentials from steps 2–3 live. That's "how it talks to
your API keys": the keys never travel to RentCafe or the browser at all;
the browser only ever talks to your Vercel backend, and the backend is the
only thing that ever sees them.

To be clear on what RentCafe's role is here versus Attio's: RentCafe is
the **website platform** — it's where the `<script>` tag below gets pasted
so the widget actually appears on the property's public site. Attio is a
separate system, the **CRM** that stores the lead records this widget
creates (name, email, phone, etc.) so your team can work leads after they
come in. They don't overlap — RentCafe never talks to Attio directly; this
widget's backend is the only thing that writes to Attio.

To confirm it's wired correctly after publishing: open your browser's dev
tools → Network tab, submit "Email an Agent" with test info, and check that
the request to `/email-agent` went to your real `*.vercel.app` domain (not
`REPLACE-ME.vercel.app`) and came back with a success response.

### Fixing an existing deployment (if you already deployed before `vercel.json` existed)

If you deployed with `vercel` (the CLI) or by uploading a zip before this
`vercel.json` was added, `/widget.js` is 404ing right now — this was caught
by loading `https://YOUR-DEPLOYMENT.vercel.app/widget.js` directly and
getting Vercel's own `404: NOT_FOUND` page instead of the script. The fix
is just to redeploy with the current folder (which now includes
`vercel.json` and `.vercelignore`):

- **If you're using the Vercel CLI:** replace your local project folder's
  contents with this updated one (same project — don't create a new Vercel
  project), then run `vercel --prod` again from inside it.
- **If you're using GitHub + Vercel's auto-deploy:** push these updated
  files to the repo; Vercel redeploys automatically.

After redeploying, re-check `https://YOUR-DEPLOYMENT.vercel.app/widget.js`
directly in a browser tab — you should see the actual JavaScript source
(starting with a comment block), not a 404 page. `/api/email-agent`,
`/api/book-tour`, and `/api/call-text` were already deploying correctly
(loading any of them directly in a browser should show
`{"error":"Method not allowed"}`, which is the expected response to a GET —
that's not a bug, it's the endpoint confirming it's alive and only accepts
POST).

One more thing worth knowing about this deployment style: because there's
no framework/build step, Vercel serves *any* file in the project at its
literal path unless it's under `api/` (which becomes a function) or listed
in `.vercelignore`. That means `lib/config.js`, `lib/eliseai.js`, etc. are
technically publicly readable at `https://YOUR-DEPLOYMENT.vercel.app/lib/config.js`
and similar — nothing in them is ever a real secret (those only ever come
from Vercel's environment variables), but it does mean things like the
internal team email addresses in `detailsEmailRecipients` and the
`EliseAI` building ID are visible to anyone who thinks to look. `.vercelignore`
already keeps `scripts/`, `.env.example`, and screenshots out of the public
deployment; fully hiding `lib/` too would need a real build step, which is
more infrastructure than this project currently has — flagging it here as
a known trade-off rather than leaving it undocumented.

## 6. Fix the remaining placeholders before fully going live

Everything below is marked `TODO(confirm)` in the code — search for that
string to find every spot:

- **`lib/config.js`**
  - `fromEmail` / `fromName` — the real, domain-verified sending address.
  - `attio.attributeMap` — replace each placeholder slug (right-hand side)
    with the real attribute slugs from Attio → Settings → Objects →
    `TheGroveCustomWidget` → Attributes. The 5 existing attributes need to
    be checked against the fields this code sends (first/last name, email,
    phone, message, how-heard, bedroom preference, tour date/time, lead
    source, property) — some may need new attributes added in Attio.
  - `legal.privacyPolicyUrl` — real URL.
- **`public/widget.js`**
  - `CONFIG.theme` — real brand hex codes / font.
  - `CONFIG.bedroomOptions` / `CONFIG.hearAboutUsOptions` — real dropdown lists.
  - `CONFIG.privacyPolicyUrl` — same URL as above.
  - `CONFIG.tourTimeSlots` — currently a static 9–5 half-hour list with no
    live conflict-checking against agents' calendars (see requirements doc).
- **`lib/cors.js`** — currently allows any origin (`*`); once you know the
  exact RentCafe domain this runs on, restrict it there.

## 7. Preview the UI right now (no deployment needed)

Open `preview.html` directly in a browser (or ask me to send it to you). It
inlines the real widget code with network calls mocked, on a stand-in page,
so you can click through the FAB, all three tiles, tab through a form to
check the focus trap, and press Escape to close — before any backend exists.
It's for visual/interaction review only — nothing submitted there sends a
real email or CRM write.

## 8. Known gaps carried over from the requirements review

- **Call/Text Us → EliseAI is fully wired up and no longer a no-op.**
  `lib/eliseai.js` posts to EliseAI's `platformApi/state/create/textMe`
  endpoint with the visitor's phone number, in the exact payload shape
  BCGK captured from their own live site. `config.eliseAI.buildingId` is
  now set to the confirmed real value (`634358`, verified against a
  screenshot of an actual request from The Grove's own Network tab — not
  just the earlier example). **This means once deployed with real
  environment variables, a real "Send Us a Text" submission will send a
  real text via EliseAI** — this is no longer inert. `preview.html` stays
  safe to click around in because its `fetch` is mocked and never reaches
  this endpoint; only a real deployment talks to EliseAI for real.
  Before considering this launch-ready: fire one real test submission
  (with a number BCGK controls) to confirm the request is accepted as-is —
  it's possible EliseAI's endpoint checks the request's Origin/Referer
  against an allowlist tied to the requesting domain, since it's built to
  be called from their own browser widget; if a deployed test gets
  rejected for that reason, matching the real RentCafe domain in the
  request headers is the likely fix.
- **No live tour-availability sync.** Time slots are a static list, not
  checked against real agent calendars.
- **Partial-failure alerting isn't wired up.** Failures are `console.error`'d
  (visible in Vercel's function logs) but nothing pages anyone yet — worth
  adding a Slack webhook or error-tracking integration before relying on
  this in production.
- **Reffie's email format is unverified.** We're sending a plain-text
  summary; confirm with Reffie whether their ingestion inbox expects a
  specific structure.
