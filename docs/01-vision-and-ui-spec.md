# TeamOS — Vision & UI Specification

> Version 0.2 · 2026-11-21 · Status: open questions resolved, prototype in progress
> Next steps: (1) clickable HTML prototype based on this document → (2) architecture → (3) MVP

---

## 1. Problem

Teams agree on things **in conversations**: in meetings, chats and emails. But those agreements have to be recorded **in tools** such as Notion, Confluence, Jira or Linear. There is a gap between the two:

- After a meeting everyone remembers their own version: "I thought the deadline was Friday", "I didn't know that was on me".
- Writing agreements down by hand takes time, and nobody does it systematically.
- Knowledge is scattered: some of it in a transcript, some in a chat, some in people's heads. Onboarding a new person means hours of "this is how we do things here".
- Task trackers are built for software development, not for **commitments between people** ("you promised me X by Thursday").

**Insight:** 80% of the information already exists in digital form (transcripts, emails, calendars, documents). Instead of making people write, we should **extract it, propose it and let people confirm it**.

## 2. Vision

**TeamOS is a team's "second brain" that fills itself from your conversations.**
You drop in whatever happened (a transcript, an email, a chat excerpt, a document). It extracts commitments, status changes and knowledge, and you confirm them with one click. The team ends up with a single source of truth: who owes what to whom, what we decided and why, and which hypotheses we are working on.

**Product principles**

1. **Capture without writing.** The main input is not a form but "drop it here".
2. **Human-in-the-loop.** AI writes nothing to the shared space without a person's confirmation. AI proposes, people decide.
3. **Every fact has a source.** Every task or decision links to the quote from the transcript or email it came from.
4. **A commitment is not a ticket.** At the center are obligations between people (who → to whom → what → by when), not tickets.
5. **Private by default.** Raw sources (transcripts, emails) are visible only to the person who added them. Only confirmed items reach the team.
6. **Open-source first.** The same code runs as SaaS for us and others, or self-hosted so data never leaves the company.

**Who it is for (ICP v1)**
- Small, forming teams of 3–20 people: startups, agencies, product teams, initiative groups.
- A team lead or founder who runs many meetings and keeps all the agreements in their head.
- A team lead who runs 1:1s and wants to see "what we promised each other".
- Also personal use (a personal workspace) as your own second brain.

**What we deliberately do NOT do in v1**
- We don't replace Jira for development with sprints, story points and epics.
- We don't build our own meeting recorder (we take existing transcripts from Meet, Zoom, Omi, Fireflies and others).
- We don't build a messenger.

## 3. Core loop

```
  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────────┐    ┌──────────┐
  │ CAPTURE │ →  │ EXTRACT  │ →  │  REVIEW  │ →  │   STORE    │ →  │   USE    │
  │ Inbox   │    │ LLM      │    │ Proposals│    │ Tasks,     │    │ Dashboard│
  │         │    │ analysis │    │ approve/ │    │ Knowledge, │    │ 1:1 view │
  │transcr. │    │          │    │ edit/    │    │ Projects,  │    │ Ask      │
  │mail,doc │    │          │    │ reject   │    │ Hypotheses │    │ Onboard  │
  └─────────┘    └──────────┘    └──────────┘    └────────────┘    └──────────┘
        ↑                                                                │
        └──────────── the next meeting closes/updates commitments ───────┘
```

The key point: the loop closes. The next transcript doesn't just create new tasks, it also **proposes status updates for old ones** ("Sasha said he deployed it → close the task?").

## 4. Domain model (entities)

| Entity | What it is | Key fields |
|---|---|---|
| **User** | A person who signs in with Google | name, email(s), avatar, aliases (what transcripts call them: "Vova", "Volodymyr") |
| **Workspace (Team)** | A team. Every user automatically has a Personal workspace | name, owner, members, inbox-email |
| **Membership** | A user's role in a team | role: Owner / Admin / Member, joined_at, status (invited/active) |
| **Connected account** | A connected Google account (work or personal); there can be several | email, services: Calendar ☐ Gmail ☐ Drive ☐, selected calendars |
| **Inbox item** | Any incoming source | type (transcript / email / doc / chat / calendar event / note), raw content, uploader, team context, linked calendar event, status |
| **Proposal** | Something the AI extracted from an inbox item | kind (new commitment / status change / knowledge / new project / new hypothesis), payload, confidence, evidence (quote + position in the source), state (pending / approved / edited / rejected) |
| **Commitment (Task)** | An obligation | title, description, **owner** (who must do it), **requester** (who set it / to whom it was promised; can be an external person), creator, deadline, priority (urgent ☐ important ☐), status, project, hypothesis, source evidence, comments, history. There is no separate visibility field: a task is visible only to its participants (plus the team's Owner/Admin) |
| **Knowledge item** | An agreement, decision or fact | type (decision / agreement / fact / process / context), text, rationale, scope (private / team), project, tags, source evidence, valid_from, supersedes → |
| **Project** | A product, direction or project | name, vision, goal(s), owner, status, members |
| **Hypothesis** | What we are currently testing within a project | statement ("If… then… because…"), owner, success metric, timeframe, status (draft / testing / validated / invalidated), learnings |
| **Comment** | A comment on a task, hypothesis or knowledge item | author, text, created_at |
| **External contact** | A person outside the team (client, partner) | name, email — for commitments like "I promised the client" |

**Commitment direction** (the main axis of the UI):
- **I owe** — owner = me
- **Owed to me** — requester = me, owner = someone else (= delegated)
- **Team** — between other team members (visible only to Owner/Admin)
- **External** — I owe an external contact, or they owe me

**Commitment statuses:** `Open → In progress → Waiting/Blocked → Done | Cancelled`
Only **the person who set the task** (the requester) changes its status. The owner writes a comment ("done, here's the link"), and the AI can propose a status change from a transcript. The requester sees and confirms both personally.

## 5. Roles and permissions

### 5.1 Team roles

| Action | Owner | Admin | Member |
|---|:-:|:-:|:-:|
| Rename / delete the team, billing | ✅ | — | — |
| Transfer ownership | ✅ | — | — |
| Invite / remove members | ✅ | ✅ | — |
| Change roles (except Owner) | ✅ | ✅ | — |
| Create / edit projects, vision, hypotheses | ✅ | ✅ | 🟡 own hypotheses only |
| See all team commitments (between other people) | ✅ | ✅ | ❌ only those where they are owner or requester |
| See the team's calendar free/busy | ✅ | ✅ | ✅ (if the person allowed it) |
| Add to Inbox and create their own tasks | ✅ | ✅ | ✅ |
| Save knowledge at team level | ✅ | ✅ | ✅ (marked with the author) |

### 5.2 Permissions on a specific commitment

| Action | Requester (set it) | Owner (does it) | Team Admin/Owner | Other members |
|---|:-:|:-:|:-:|:-:|
| See | ✅ | ✅ | ✅ | ❌ |
| Comment | ✅ | ✅ | ✅ | ❌ |
| Edit title / deadline / project / priority | ✅ | ❌ | ❌ | ❌ |
| Change status (any, including Done/Cancelled) | ✅ | ❌ | ❌ | ❌ |
| Reassign | ✅ | ❌ | ❌ | ❌ |
| Transfer the requester role (edge case: the person left the team) | — | — | ✅ | ❌ |

**Rule:** a task's status and fields are changed **only by the person who set it**. The owner only comments. A self-assigned task (me = requester = owner) is fully mine.
AI status-change proposals always go to the requester: if another member added the transcript, a proposal about someone else's task is routed to the requester's Inbox.

### 5.3 Source privacy
- **The Inbox is personal only.** Everyone has their own inbox; an item is linked to a team as context for analysis.
- A raw inbox item (transcript, email) is visible **only to the person who added it**.
- Team members see **confirmed** tasks and knowledge with a supporting quote (1–3 sentences), but not the whole transcript.
- Calendar: by default the team sees only **free/busy**; event details only if the person enabled it.
- Mail: never shared with the team automatically; only what the person sends to the Inbox themselves.

## 6. Information architecture (left menu)

```
┌──────────────────────────┐
│ [▼ Linxa Team]           │  ← team switcher (+ Personal, + Create team)
│ ⌘K  Search / Ask         │
├──────────────────────────┤
│ 🏠 Dashboard             │
│ 📥 Inbox            (3)  │  ← badge = proposals waiting for review
│ ✅ Tasks                 │
│ 📅 Calendar              │
│ ✉️  Mail             (5) │  ← emails that need a reaction
│ 🧠 Knowledge             │
├──────────────────────────┤
│ TEAM SPACE               │
│ ◆ Team vision            │
│ ▸ Linxa                  │  ← projects; expand into hypotheses
│ ▸ TeamOS                 │
│ + New project            │
├──────────────────────────┤
│ 👥 Members               │
│ 🔌 Connections           │
│ ⚙️  Settings             │
│ [avatar] Volodymyr       │
└──────────────────────────┘
```

Global elements:
- **"+ Add to Inbox"** — the main button, available on every screen (hotkey `I`).
- **⌘K** — search plus "Ask TeamOS" (natural-language questions to the knowledge base, answered with links to sources).
- **Task drawer** — any task opens in a side panel on the right, not on a new page.


## 7. Screens

### 7.1 Login
- One screen: logo, tagline "Your team's second brain — built from your meetings", and a **Continue with Google** button.
- Under the button: "Open-source · Self-host available" plus a link to GitHub.
- If the person arrived through an invite link, a card above the button says: "Volodymyr invited you to the **Linxa Team** team".

### 7.2 Onboarding (first sign-in)
A stepper; every step can be skipped:

1. **Team.** "Create a team" (name), "Join" (if there are invites) or "Use personally".
2. **Invite people.** An email field plus role (Member/Admin), "Skip for now".
3. **Connect sources.** Google Calendar / Gmail / Google Drive cards with a Connect button. After connecting, you can "+ Add another Google account".
4. **First wow moment.** "Drop the transcript of your last meeting here" (or "Try with sample transcript"). → Review (7.5) opens right away.

**For an invited member** onboarding is shorter: accept the invite → connect a calendar (explaining "the team will see only free/busy") → a Dashboard with empty states ("Tasks delegated to you will appear here").

### 7.3 Dashboard
A grid of widgets. At the top: a greeting and a "state of the day" line: `3 proposals waiting for review · 2 overdue commitments · 4 meetings today`.

| Widget | Content |
|---|---|
| **My commitments** | The "I owe" list, sorted by deadline; red = overdue, yellow = today/tomorrow. A checkbox for a quick status change. Tabs: `All / To team / To external` |
| **Delegated (owed to me)** | Grouped by person: avatar + count + nearest deadline. Click → Person view (7.8) |
| **Calendar today** | Day timeline. Switch: `My calendars ▾` (calendar checkboxes) / `Team` (members' free/busy bars). Each meeting has two buttons: **Prep** (an agenda from open commitments between attendees) and **Drop transcript** (after it ends) |
| **Inbox** | "3 items need review" plus the most recently processed |
| **Recent decisions** | The last 5 team-level knowledge items |
| **Active hypotheses** | Hypotheses in testing: name, owner, days until the end of the timeframe, task progress |

### 7.4 Inbox — list
Tabs: **Needs review (3)** · **Processing (1)** · **Done** · **Ignored**

Each row:
`[type icon] Title (e.g. "Weekly sync — 20 Nov") · source · team · date · result: 5 tasks · 2 updates · 7 knowledge · [Review →]`

Item statuses: `Queued → Processing → Needs review → Partially applied → Done` (+ `Failed`, `Ignored`).

**The "Add to Inbox" modal** (button at the top):
- Tabs: **Paste text** (a transcript, a chat excerpt) · **Upload file** (txt, md, docx, pdf, vtt, srt) · **From Drive** (picker) · **From Gmail** (pick an email) · **Note** (dictate or write a thought)
- Fields: team context (detected automatically, can be changed), "Link to a meeting" (a dropdown of recent calendar events; gives the attendees and date → better people matching), title.
- A hint at the bottom: "Or forward emails to `linxa-team.k7f2@in.teamos.app`".

### 7.5 Inbox — Review (the key screen of the product)
Two columns:

**Left (40%) — Source.** The transcript or email with highlighted fragments. Hovering a proposal on the right scrolls to and highlights its quote on the left. At the top: the meeting and its participants (mapped to team members; unmapped ones can be linked: "'Sashko' → Oleksandr S.").

**Right (60%) — Proposals**, grouped into sections with counters. Each card has a checkbox (checked by default when confidence is high), a confidence badge and a supporting quote.

1. **New commitments (5)**
   Card: `☑ Prepare the pricing page for MCP`
   `Owner: [Oleksandr ▾] → Requester: [Volodymyr ▾] · Deadline: [Fri, 28 Nov ▾] · Project: [Linxa ▾] · Hypothesis: [MCP freemium ▾] · Priority: [Important ▾]`
   `"…Sasha, could you make the pricing page by Friday…" 12:41`
   Fields are edited inline. If the AI is unsure, it shows an alternative: "Maybe the TeamOS project?".

2. **Status updates (2)**
   `☑ "Deploy the Pipedrive webhooks" · In progress → **Done**`
   `"…the webhooks have been in production since Tuesday…" 08:15`
   If I didn't set the task, the proposal is not applied but **sent to the requester** for confirmation (marked "→ goes to Volodymyr for confirmation").

3. **Knowledge (7)**
   `☑ [Decision] The free MCP plan is 100 calls/month.` · Scope: `[🔒 Only me | 👥 Team]` · Project: Linxa
   If it contradicts an existing item: ⚠️ "Contradicts the decision from 12 Nov: '50 calls/month'. [Replace the old one] [Keep both]".

4. **Other (1)** — proposals for new projects and hypotheses, new people and external contacts.

**Bottom bar (sticky):** `Selected: 12 of 15 · [Reject unselected & apply] · [Save draft]`. Hotkeys: `J/K` to navigate, `Space` to toggle the checkbox, `E` to edit, `⌘Enter` to apply.

**UX goal:** process a one-hour meeting in under 3 minutes.

### 7.6 Tasks
Header: a view switcher plus filters (`Direction: I owe / Owed to me / Team`, `Person`, `Project`, `Hypothesis`, `Status`, `Deadline`) and "+ New task" (manual creation is available too).

**a) Eisenhower Matrix** — 4 quadrants:
`Do now (Urgent+Important)` · `Schedule (Important)` · `Delegate (Urgent)` · `Drop (–)`.
Urgency is calculated automatically from the deadline (≤ 2 days = urgent, configurable); importance is a flag. Dragging between quadrants changes the flags. In the "Delegate" quadrant each card has a "Delegate" button.

**b) Kanban** — columns by status: `Open · In progress · Waiting/Blocked · Done`. Optional swimlanes by person or project. Dragging is allowed only where you have permission (otherwise the card springs back with the tooltip "Only Volodymyr can close this").

**c) List** — a table: title · owner · requester · deadline · status · project · hypothesis · source. Grouping: by person / project / deadline.

**d) Delegated** — a preset: only "owed to me", grouped by delegate, with "open / overdue / new comments" counters. This is the basis for 1:1s.

**Task drawer** (opens on the right from anywhere):
- Title, status, owner → requester, deadline, priority, project, hypothesis.
- **Source**: the quote plus a link to the inbox item ("from Weekly sync 20 Nov, 12:41").
- **Activity**: the change history (who, when, from which source — "status changed to Done from the 27 Nov transcript, confirmed by Volodymyr").
- **Comments**.
- For the owner: read-only fields and a notice "Volodymyr changes the status — write a comment if you have an update". Only comments are available.

### 7.7 Calendar
- Week/day view. On the left, a list of calendars from all connected accounts (checkboxes, colors).
- A **Team availability** section: checkboxes for team members → their free/busy as grey blocks alongside.
- Clicking an event opens a panel: attendees (who is on the team), **Prep** — open commitments between attendees plus decisions on related projects from past meetings — and **Drop transcript** / "Transcript found in Drive → Process".
- Task deadlines show as small markers on the day.

### 7.8 Person view (1:1 / Meeting mode)
Opens by clicking a person (Dashboard, Members, the Tasks filter).
- Header: avatar, role, the next shared meeting.
- Two columns: **I owe them** · **They owe me**.
- **Meeting mode**: large cards one at a time with status buttons (`✅ Done · ▶ In progress · ⏸ Blocked · 📅 Move deadline · 💬 Comment`). Ideal for "walking through the statuses" in a 1:1.
- At the bottom: shared decisions and knowledge from the last month.

### 7.9 Mail
- A combined list from all connected Gmail accounts, but **only what matters**, triaged by AI into categories:
  `Needs a reply` · `Waiting for a reply (I wrote, no answer yet)` · `Contains a commitment` · `FYI`.
- Each row: sender, subject, a one-line AI summary, which account it came from (a colored label), a **→ Inbox** button (send for analysis) and **Open in Gmail**.
- A filter by account.
- TeamOS is not an email client: you reply in Gmail.

### 7.10 Knowledge
- A feed or table of knowledge items with filters: type (Decision / Agreement / Fact / Process / Context), scope (Mine / Team), project, author, period.
- Each item: text, rationale ("why"), source, date, who confirmed it, "replaces → / replaced by ←".
- **Decision log** — a preset: only decisions in chronological order, with the replacement history visible.
- Manual adding and editing are possible too.
- An **Onboarding pack** button (P1): AI assembles a "what a newcomer needs to know" document from team knowledge and the Team Space → a link for the new member.

### 7.11 Team Space
**Team vision** — a document page: mission, values, how we work (a rich-text editor; Owner and Admin can edit).

**Project page** — tabs:
- **Overview**: the project vision, goals (goal + metric + target + date), owner, members, progress (open/closed tasks).
- **Hypotheses**: hypothesis cards — `If [action], then [result], because [assumption]` · owner · success metric · timeframe · status (Draft / Testing / Validated / Invalidated) · task progress. Click → Hypothesis page.
- **Tasks**: all of the project's tasks (the same Tasks component with a preset filter).
- **Knowledge**: decisions and agreements for the project.

**Hypothesis page**: the statement, owner, metric and current value (entered manually), status, linked tasks, **Learnings** (conclusions; AI proposes them from transcripts: "the meeting said conversion is 2% → add as a learning?") and the final verdict.

Hierarchy: `Team → Project → Hypothesis → Task`. A task can exist without a project; a hypothesis always belongs to a project.

### 7.12 Members
- A table: person, email, role (dropdown), status (Active / Invited · resend), calendar available for free/busy ☐, number of open commitments.
- "Invite" — a modal: emails plus role.
- Actions: change role, remove, **Transfer ownership** (Owner only, confirmed by typing the team name).

### 7.13 Connections
- Cards for connected Google accounts: `vd@linxa.com` · `volodymyr@gmail.com`. Each has service toggles: Calendar (plus choosing specific calendars), Gmail, Drive. Sync status, "Disconnect".
- "+ Connect another Google account".
- Other sources (P2): Telegram bot, Slack, Zoom, Omi, Fireflies, Webhook/API, MCP.

### 7.14 Settings
- **Team**: name, inbox email address, analysis language, urgency rule (days before the deadline).
- **Privacy**: what the team sees from my calendar (free/busy / details / nothing), whether to share raw sources by default.
- **AI**: (for self-host) provider and key — OpenAI / Anthropic / Gemini / a local model; auto-accepting high-confidence proposals (off by default).
- **Notifications**: a daily digest (email/Telegram): newly delegated tasks, overdue items, what is waiting for review.

## 8. Key user flows

**Flow A — After a meeting (the main one)**
The meeting ends → the event on the Dashboard shows "Drop transcript" (or TeamOS found the transcript in Drive itself) → I paste it → 20–40 s of processing → Review → I fix 2 fields and uncheck 3 boxes → Apply → team members get their tasks plus notifications.

**Flow B — Delegation and follow-up**
In Review I set Owner = Oleksandr → his Dashboard shows "Assigned to me: 1" → he comments "done, here's the link" → I see the unread comment on my Dashboard → I change the status myself. Or at the next 1:1 I open Person view → Meeting mode → walk through the statuses.

**Flow C — The next meeting closes old tasks**
I drop a new transcript → in the "Status updates" section the AI found 3 open tasks that were discussed → I confirm the changes.

**Flow D — Inviting someone to the team**
Owner → Members → Invite (email, role) → an email with a link → the person signs in with a Google account (any account; the invite email and the account email may differ, because the invite is bound to the link) → a short onboarding → they see an empty Dashboard with an explanation.

**Flow E — A new member onboards**
An Admin generates an Onboarding pack → the new member reads the vision, projects, active hypotheses and key decisions with links to sources → asks questions in ⌘K Ask.

## 9. The AI analyzer: what it does

Input: an inbox item plus the team context (members and their aliases, projects, active hypotheses, open tasks, recent decisions).
Output (structured JSON):
1. **Commitments**: who → to whom → what → deadline (normalized to a date relative to the meeting date: "by Friday" → 28 Nov) → project/hypothesis (with the reason for the choice) → priority.
2. **Status updates**: matching what was said against existing open tasks.
3. **Knowledge**: decisions / agreements / facts plus conflict detection against existing items.
4. **Entities**: new people, external contacts, candidate projects and hypotheses.
5. A meeting **summary** (3–5 points), stored with the inbox item.

Every item has `confidence` plus `evidence` (a quote and its position). A proposal without evidence is not shown.

Deduplication: if two members drop a transcript of the same meeting (matched by calendar event or similarity), we show "Oleksandr already processed this meeting" and propose only what is new.

## 10. Stages (scope)

**MVP v0.1 — for our own team (2–3 weeks)**
- Google login, workspaces (team + personal), roles, invites, transfer ownership
- Inbox: paste / upload, linking to a calendar event
- AI analysis → Review (commitments, status updates, knowledge) with evidence
- Tasks: List, Kanban, Eisenhower, Delegated, Task drawer, comments, permissions (only the requester changes status)
- Projects + Hypotheses + Team vision
- Knowledge (list + decision log)
- Dashboard (mine / delegated / calendar today)
- Google Calendar (several accounts)

**v0.2**
- Gmail (several accounts) + Mail triage + "→ Inbox"
- Drive picker + automatic pickup of Meet transcripts
- Forward-to-inbox email
- Team free/busy, Person view + Meeting mode, Meeting Prep
- ⌘K Ask (RAG over knowledge and tasks with quotes)
- Daily digest

**v0.3+**
- TeamOS MCP server (so Claude and other agents can read and write the team's "brain")
- Telegram / Slack bot as a source and a notification channel
- Onboarding pack, Learnings for hypotheses
- Self-host package (Docker), BYO LLM
- Public SaaS, billing

## 11. Success metrics

| Metric | MVP target |
|---|---|
| Time to process a 1-hour meeting in Review | < 3 min |
| % of proposals accepted without edits (precision) | > 70% |
| % of real commitments from a meeting that the AI found (recall, checked manually) | > 85% |
| Transcripts per team per week | ≥ 3 |
| % of delegated tasks closed through TeamOS (rather than "lost") | > 60% |
| Weekly active members / all team members | > 70% |

## 12. Risks and notes for the architecture

- **Google OAuth scopes.** Gmail (read) and full Drive access are "restricted" scopes: a public SaaS needs Google verification with a security assessment; Calendar is "sensitive" (simpler verification). For our own team we can run in testing mode (up to 100 test users) without verification. For Drive in the MVP, `drive.file` through the Picker is better. We'll check the details at the architecture stage.
- **Self-host:** everyone who deploys creates their own Google OAuth client, so it needs good instructions.
- **Quality of people matching** (aliases, Ukrainian diminutive names) is critical for trust; it needs a convenient "link a name" UI.
- **Trust in AI**: no automatic writes without confirmation in v1; evidence is mandatory.
- **Language:** transcripts are mixed (UA/EN/RU), so the analyzer must be multilingual and the UI must be EN + UA.

## 13. Decisions made (21 Nov 2026)

1. **Task visibility:** a Member sees only tasks where they are the owner or the requester. They don't see other people's tasks. The team's Owner/Admin see all of them.
2. **Raw sources** are visible only to the person who added them. The team sees only confirmed items with a quote.
3. **Only the person who set a task changes its status.** The owner only comments.
4. **The Inbox is personal only.**
5. The section is called **Team Space**.

---

## Appendix A. Screens for the prototype

| # | Screen | Priority |
|---|---|---|
| 1 | Login (+ an invite variant) | P0 |
| 2 | Onboarding: team → invites → connections → first transcript | P0 |
| 3 | Dashboard | P0 |
| 4 | Inbox — list + the Add to Inbox modal | P0 |
| 5 | **Inbox — Review** | P0 |
| 6 | Tasks — Eisenhower | P0 |
| 7 | Tasks — Kanban | P0 |
| 8 | Tasks — List / Delegated | P0 |
| 9 | Task drawer (requester's view and owner's view) | P0 |
| 10 | Person view + Meeting mode | P1 |
| 11 | Calendar (mine + team availability + Prep) | P1 |
| 12 | Mail | P1 |
| 13 | Knowledge + Decision log | P0 |
| 14 | Team vision | P1 |
| 15 | Project page (Overview / Hypotheses / Tasks / Knowledge) | P0 |
| 16 | Hypothesis page | P1 |
| 17 | Members (+ invite, transfer ownership) | P0 |
| 18 | Connections | P0 |
| 19 | Settings | P2 |

Prototype: a flat clickable HTML page (desktop) with realistic demo data (a team of 4 people, 2 projects, 3 hypotheses, 1 meeting transcript in Ukrainian).
