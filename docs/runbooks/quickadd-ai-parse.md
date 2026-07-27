# Turning on the AI quick-add (design direction 3b)

> **Read this first.** Since ADR 0014 the quick-add field suggests from a static catalog of ~200
> common chores, prefilling name, category and a default rhythm with no model involved. That covers
> the chores households share, which is most of what gets added. What is left for 3b is the odd
> sentence the catalog can't know — *"co drugą sobotę miesiąca"*, *"od pierwszego"* — so the payoff
> below is now smaller than it was when this file was written. Everything else here still holds.

The quick-add field at the bottom of the dashboard is built and working, but in its **fallback**
mode: you type a name, press Enter, and the task sheet opens with that name filled in so you can
confirm the rhythm. Direction 3b in `Home Dashboard.dc.html` turns the same field into a
one-sentence input — *"podlewać fikusa raz w tygodniu, w niedziele"* → name, category, rhythm and
anchor, shown as editable chips.

That needs a model running inside the Worker, which needs a key, a spending decision and a request
cap. This file is what to do when you want it. Nothing here is urgent — the app is complete and
deployable without it.

**Estimated effort:** ~30 min of your time for steps 1–2, then a normal PR for step 3.
**Estimated cost:** roughly $0.0002 per parse with Haiku 4.5. Two people adding a few chores a week
is cents per year; the request cap exists to bound a bug, not the bill.

---

## Step 1 — Decide whether you want it at all

Worth knowing before you spend anything:

- The fallback already covers the common case. Most household chores are added with a name and a
  rhythm you pick in two taps.
- The value is concentrated in the *rhythm*, not the name — "co drugą sobotę miesiąca" is genuinely
  faster to say than to click. If you find yourself mostly adding simple weekly things, this earns
  little.
- It adds an outbound dependency to a household app that currently has none beyond Google and
  Resend. When Anthropic is down, quick-add degrades back to what it does today — but it does
  degrade.

If you'd rather not, nothing needs doing. Close this file.

## Step 2 — Create the key and set it as a secret

1. Go to <https://console.anthropic.com/settings/keys> and sign in.
2. **Create Key**. Name it `home-dashboard-worker`. Copy the value — the console shows it once.
3. Set a spend limit while you're there: **Settings → Limits**, monthly limit `$5`. This app cannot
   plausibly spend that; the limit is there so a runaway loop can't either.
4. In a terminal in this repo:

   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

   Paste the key at the prompt. It goes to Cloudflare, never into `wrangler.jsonc` — ADR 0005.

5. For local development, add the same line to `.dev.vars` (gitignored):

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

   and add a commented placeholder to `.dev.vars.example` so the next person knows it exists.

6. Confirm it landed:

   ```bash
   npx wrangler secret list
   ```

   `ANTHROPIC_API_KEY` should appear alongside `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY`.

## Step 3 — What to build (hand back to Claude Code)

Once the secret exists, this part is ordinary code and can be a normal PR. The shape the design
asks for:

- **`POST /api/tasks/parse`** in `worker/index.js`, inside the `requireUser` gate — it costs money,
  so it is not anonymous. Body `{ text }`, response
  `{ name, category, interval, chips: [{ label, field }] }`.
- **The model never writes.** It returns a draft; the user confirms it in `RhythmEditor`; the save
  goes through the existing `POST /api/tasks`. This is what keeps a hallucinated rhythm from
  silently becoming a recurring chore.
- **Return `501` when `env.ANTHROPIC_API_KEY` is unset**, and have `QuickAdd` fall back to today's
  behaviour on any non-200. That keeps local development working without a key and makes the
  degraded path the tested default rather than an afterthought.
- **Cap requests** using Better Auth's existing `rateLimit` storage (already `'database'`, see
  `worker/authOptions.js`) or a small D1 counter — a few dozen parses per user per day is generous.
- **Voice** uses the Web Speech API on the device. Don't add `POST /api/tasks/transcribe`; audio
  upload is a much bigger surface for no benefit here, and Chrome and Safari both support dictation
  natively.
- Use **Haiku 4.5** (`claude-haiku-4-5-20251001`) — this is short structured extraction, not
  reasoning. Give it today's date, since the anchor ("od dziś", "od pierwszego") is relative.

Design reference: option `3b` in `Home Dashboard.dc.html`, and `QuickAdd.jsx` in the design
project's `code/` folder, which has the chips-and-listening-sheet markup already written.

## Rolling it back

Remove the secret and the endpoint 501s; the field silently returns to the fallback. No data
migration, no user-visible breakage:

```bash
npx wrangler secret delete ANTHROPIC_API_KEY
```
