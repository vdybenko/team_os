# TeamOS v0.1

A team's second brain that fills itself from meetings. Specification: [docs/01-vision-and-ui-spec.md](docs/01-vision-and-ui-spec.md); clickable prototype: [prototype/index.html](prototype/index.html).

## What's in v0.1

- **Sign-in with a one-time email link.** A personal workspace is created automatically.
- **Teams**: create a team, invite people with a link, Owner / Admin / Member roles, transfer ownership.
- **Inbox**: paste a transcript or note, or upload `.txt .md .vtt .srt`. AI extracts tasks, status updates, knowledge chunks, new projects and hypotheses, each with a quote. Items reach the knowledge base only after you confirm them in **Review**.
- **Tasks** (commitments): Eisenhower matrix, kanban, list, "delegated"; a side panel with comments and history. **Only the requester** changes the status and fields; the owner comments. An AI proposal to change the status of someone else's task goes to the requester's inbox.
- **Projects** (status: active / paused / done / archived, vision) and **hypotheses** ("If… then… because…", status: draft / testing / validated / invalidated, metric, learnings, verdict).
- **Goals (OKR)**: one Goal entity (objective + key results) on every level — annual and quarterly team goals, project goals and member goals. A goal contributes to a key result one level higher, a hypothesis moves a key result of its project, and a task moves a goal through its hypothesis or directly (`task.kr`). The Goals page has an OKR list, an alignment tree with risks ("no hypotheses", "one bet", not aligned) and a weekly check-in (value, confidence, comment). Alignment score = the share of tasks closed this quarter that lead to a team key result.
- **Hypothesis prioritization**: Impact × Confidence × Speed ÷ Cost (team time and money), 1–10 sliders with anchors, a suggestion for Impact from the expected contribution, cards / 2×2 matrix / ranking views, a WIP limit of 3 hypotheses in testing, success and stop criteria. The estimates are fixed as a forecast when testing starts.
- **Organizations** group teams (v1). The first team creates an organization with its name; later teams pick an organization or create a new one. Org Owner/Admin see the org's teams but not their content.
- **Knowledge** (decisions, agreements, facts, processes, context; private or team-wide; a new decision can replace an old one) and **Team vision**.
- **Processes** ([specification](docs/02-processes-and-agreements-vision.md)): versioned documents of how the team works, on the hypothesis, project, team or organization level. A process can be one sentence or have sections (purpose, trigger, roles, inputs, steps, result, metric, exceptions, review). Anyone who sees it proposes changes (add / extend / replace / remove); the owner of the level accepts one or several changes as a new version, edits and accepts, or rejects with a reason. A process created by someone else is a draft until the owner approves it. Organization processes have their own visibility (Owner only / Owner and Admin / everyone). Knowledge entries of type “process” can be collected into a process.
- **Agreements**: documents that every party has explicitly accepted — partnership agreements, roles, team rules, a contractor. Only the parties see them. A new version comes into force only when every party has accepted that exact text; until then the previous version stays in force, with no time-out. Any change resets the consents, and the author accepts it as a separate step too. Each clause can be changed or removed on its own. A new agreement can be dictated or filled in from the PDF of an existing one. A party can accept, reject with a reason or propose their own version. When a party leaves the team, the agreement needs a full review by those who remain. External parties are listed by name; a member party records how they confirmed.
- **TeamOS Advocate**: a checklist of what a process or agreement is missing (by agreement type), and — with AI configured — risks, 2–3 alternatives and concrete suggestions. It runs on demand and automatically on each new version. A piece of advice becomes a change only when a person proposes it; advice can be dismissed for the version. The inbox analyzer proposes process changes, new processes, agreement changes and new agreements with a quote: the uploader confirms them in Review (step 1), the process owner or every party decides (step 2).
- **Assistant**: ask about tasks, knowledge, goals and hypotheses, or ask a question about a document. Answers can cite the original PDF page. Your personal assistant can read documents awaiting review in your own inbox. Team members can use a shared source once you apply it in Review.
- **Interface in English and Ukrainian**: switch the language in Profile or on the sign-in screen.
- **MCP server with OAuth**: connect your knowledge base to Claude, Codex or any MCP client — search and read it, add tasks, knowledge, projects, goals and hypotheses, add to the inbox, create teams and manage members. See [Connecting Claude and Codex (MCP)](#connecting-claude-and-codex-mcp).

Not done yet (see §10 of the specification): calendar, Gmail/Drive, Meeting mode, daily digest, sending invite emails.

## Getting started

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

Open http://localhost:3000. Until SendGrid is configured, a development sign-in is available on localhost.

### Sign-in with a one-time link

1. Give the server a `SENDGRID_API_KEY` with the Mail Send permission and a verified sender address in `SENDGRID_FROM_EMAIL`.
2. Set a public HTTPS URL in `BASE_URL`. Behind a local reverse proxy that forwards the client's original IP address, set `TRUST_LOCAL_PROXY=1`.
3. Request a link on the sign-in screen, open the email and confirm the sign-in. The link is valid for 15 minutes and works once.

### AI analysis

For Amazon Bedrock, set `AI_PROVIDER=bedrock` and pass `AWS_BEARER_TOKEN_BEDROCK` through the server environment. The values in `.env.example` use the Bedrock endpoint in Ireland (`eu-west-1`) and the European Amazon Nova 2 Lite profile. TeamOS validates the response format and checks quotes against the source. Each confirmed knowledge chunk is stored in its own Markdown file with its source and quote.

For the Claude API directly, set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`. Anthropic's server-side fallback works in this mode.

For OpenAI, set `AI_PROVIDER=openai`, `OPENAI_API_KEY` and, if needed, `OPENAI_MODEL` (default `gpt-4.1-mini`). TeamOS sends the text and team context to the Responses API with `store: false`. Without a configured provider, items can be processed manually in Review.

Ordinary assistant lookups use one call. Set `OPENAI_LOOKUP_MODEL` to choose their model. By default they reuse a configured mini or nano model, or use `gpt-4.1-mini`. Document questions about decisions, assignments, progress, targets and next steps get a focused reading of the relevant evidence using `OPENAI_MODEL`.

## How data is stored

Leave `S3_BUCKET` empty to use local storage. The default is `storage/` in the project root, which is ignored by Git. Set `DATA_DIR` to use a different directory. On first use, TeamOS copies an existing default `data/` store into `storage/`, preserving IDs and the session signing key. An explicitly configured directory with the previous layout remains readable.

Local files and S3 objects use the same structure:

```text
settings/
  users/<userId>.json
  auth/session-secret
  auth/signin-links/<sha256>.json
records/primary/
  orgs/<orgId>/org.json          # organization: name, owners, admins
  orgs/<orgId>/processes/<id>.json  # processes of the organization level
  teams/<teamId>/
    team.json                    # orgId points to the organization
    vision.md
    projects/<id>.json
    goals/<id>.json              # goals (OKR) on every level; older project.goals move here on first read
    processes/<id>.json          # processes of the hypothesis / project / team level with versions and changes
    agreements/<id>.json         # agreements with versions and consents (visible to their parties only)
    hypotheses/<id>.json
    tasks/<id>.json              # shared tasks
    knowledge/<id>.md            # shared knowledge
  users/<userId>/teams/<teamId>/
    tasks/<id>.json              # private tasks
    knowledge/<id>.md            # private knowledge with a teamId reference
    inbox/<id>.json
    inbox/<id>.md
    assistant/<id>.json
```

Local mode also generates navigable `index.md` files. Private records stay in the owner's folder and retain their team context. Changing a knowledge item's visibility moves it between the owner and team folders. Email sign-in links expire after 15 minutes and can be used once.

### Amazon S3 as the primary store

Set `S3_BUCKET`, `S3_REGION` and `S3_OWNER_ACCOUNT`, and pass credentials through the AWS SDK environment. All application state is read and written directly in S3. A replacement instance needs access to the same bucket and the deployment configuration for email and AI. If `SESSION_SECRET` is set explicitly, provide the same value on the new instance.

Pause application writes while running a migration.

- `node --env-file-if-exists=.env server/migrate-to-s3.js files` copies a local file store into S3.
- `node --env-file-if-exists=.env server/migrate-to-s3.js split` upgrades a deployment that already keeps tasks and knowledge in S3 and the rest on disk.

The migration verifies copied records and stops if a destination contains different data. It can be repeated while writes are paused.

## Connecting Claude and Codex (MCP)

TeamOS is a remote MCP server (Streamable HTTP) at `<BASE_URL>/mcp`, protected with OAuth 2.1. The app opens a TeamOS page in the browser; you sign in with your usual account and choose:

- **Access**: *Read only*, *Read and write*, or *Full, including team management*.
- **Workspaces**: all of yours (including teams you join later), or a single team.

The app then sees and changes only what you can in the UI: only the requester changes a task's status, private knowledge and the inbox stay personal, and team management needs the Owner or Admin role. See and disconnect apps at `<BASE_URL>/oauth/connections` (also linked from Profile).

claude.ai and Claude Desktop need a public HTTPS `BASE_URL`; Claude Code and Codex also work with `http://localhost:3000`.

- **claude.ai / Claude Desktop**: Settings → Connectors → Add custom connector → URL `https://sb.uselinxa.com/mcp`.
- **Claude Code**:

```bash
claude mcp add --transport http teamos https://sb.uselinxa.com/mcp
```

  then run `/mcp` in Claude Code and choose *Authenticate*.
- **Codex CLI**:

```bash
codex mcp add teamos --url https://sb.uselinxa.com/mcp
```

```bash
codex mcp login teamos
```

**Tools** (shown according to the access level):

| Access | Tools |
| --- | --- |
| Read | `list_workspaces`, `get_workspace_overview` (with this quarter's OKRs), `search`, `list_tasks` (*i owe* / *owed to me*), `get_task`, `list_knowledge`, `list_projects`, `list_goals`, `list_hypotheses`, `list_members`, `list_inbox`, `get_inbox_item`, `list_processes`, `get_process`, `list_agreements`, `get_agreement` |
| Write | `add_to_inbox`, `create_task`, `update_task`, `comment_on_task`, `delete_task`, `add_knowledge` (can replace an older decision), `update_knowledge`, `delete_knowledge`, `create_project`, `update_project`, `save_goal` / `remove_goal` (a simple project goal with one key result), `checkin_key_result`, `create_hypothesis`, `update_hypothesis`, `set_hypothesis_priority`, `add_hypothesis_learning`, `update_team_vision`, `propose_process_change`, `decide_process_change` (for whoever approves the process), `propose_agreement_change`, `respond_to_agreement` (your own consent as a party), `review_with_advocate` |
| Manage | `create_team`, `invite_member` (returns a join link), `revoke_invite`, `change_member_role`, `remove_member` |

Each team's vision is also available as an MCP resource (`teamos://teams/<id>/vision`). Text added with `add_to_inbox` is analyzed like any other inbox item and waits for your confirmation in Review.

Under the hood: dynamic client registration (RFC 7591), authorization code with PKCE S256, protected resource and authorization server metadata (RFC 9728, RFC 8414), one-hour access tokens, rotating 90-day refresh tokens and token revocation (RFC 7009). Clients, connections and one-time codes are stored under `settings/oauth/` in the same storage backend (files or S3), with only hashes of secrets.

## Code structure

- [server/index.js](server/index.js) — HTTP API routes.
- [server/domain.js](server/domain.js) — access rules and operations on tasks, knowledge, projects, goals, hypotheses, teams and the inbox, shared by the HTTP API and MCP.
- [server/processes.js](server/processes.js) — processes, agreements and TeamOS Advocate: levels and approvers, versions, consents, checklists.
- [server/oauth.js](server/oauth.js) — OAuth 2.1 authorization server for MCP clients: consent page, tokens, connected apps.
- [server/mcp.js](server/mcp.js) — the MCP server (Streamable HTTP) and its tools.
- [server/store.js](server/store.js) — file storage and `index.md` generation.
- [server/auth.js](server/auth.js) — one-time email link sign-in and the signed session cookie.
- [server/ai.js](server/ai.js) — the inbox analyzer via Bedrock, the Claude API or OpenAI with structured JSON.
- [server/i18n.js](server/i18n.js) — Ukrainian translations of server messages.
- [public/](public/) — the client without a build step (vanilla JS), styles from the prototype.
- [public/i18n.js](public/i18n.js) — Ukrainian translations of the interface (English is the source language).

## Updates

What's new in TeamOS, newest first.

### 2026-11-24 — Process drafts from a source or the knowledge base

- AI fills in the missing summary, sections and steps of a process from a chosen shared source or from the shared knowledge base.
- The result arrives as pending changes, each with a quote or a link to its knowledge entry, so the owner of the level still decides. The Changes tab gets **Accept all**.
- Available on the process page and in the new-process dialog.

### 2026-11-24 — Processes, agreements and TeamOS Advocate

- **Processes**: versioned documents of how the team works, on the hypothesis, project, team or organization level. Anyone who sees a process proposes changes; the owner of the level accepts them as a new version or rejects them with a reason.
- **Agreements**: documents that every party has explicitly accepted. A new version comes into force only when every party has accepted that exact text; until then the previous version stays in force.
- **TeamOS Advocate**: a checklist of what a process or agreement is missing and, with AI configured, risks, alternatives and concrete suggestions. It runs on demand and on each new version.
- The inbox analyzer proposes process and agreement changes with a quote; existing knowledge entries of type “process” can be collected into draft processes.
- New MCP tools: `list_processes`, `get_process`, `list_agreements`, `get_agreement`, `propose_process_change`, `decide_process_change`, `propose_agreement_change`, `respond_to_agreement`, `review_with_advocate`.

### 2026-11-23 — Goals (OKR), organizations and hypothesis prioritization

- **Goals (OKR)** on every level: annual and quarterly team goals, project goals and member goals. Goals contribute to key results one level higher; hypotheses and tasks move key results.
- The Goals page: an OKR list, an alignment tree with risks ("no hypotheses", "one bet", not aligned), a weekly check-in and an alignment score.
- **Hypothesis prioritization**: Impact × Confidence × Speed ÷ Cost, cards / 2×2 matrix / ranking views, a WIP limit of 3 hypotheses in testing, success and stop criteria.
- **Organizations** group teams; org Owner/Admin see the org's teams but not their content.
- MCP: `list_goals`, `save_goal` / `remove_goal`, `checkin_key_result`, `create_hypothesis`, `update_hypothesis`, `set_hypothesis_priority`, `add_hypothesis_learning`; the workspace overview includes this quarter's OKRs.

### 2026-11-22 — Second Brain via MCP

- The remote MCP server with OAuth 2.1: connect Claude, Codex or any MCP client to your knowledge base (setup: the “Connecting Claude and Codex (MCP)” section of README.md).
- Access to all of my workspaces or one team, read / write / manage levels, and the same permissions as the UI.
- Connected apps can be seen and disconnected from Profile.

## Roadmap

What's left for a full implementation of the [specification](docs/01-vision-and-ui-spec.md). The order within a stage is a rough priority.

### v0.2 — sources and daily work

- **Google Calendar** (several accounts): week/day, choosing calendars, linking an inbox item to a meeting (attendees and date → better people matching).
- **Team availability**: members' free/busy, privacy settings (free/busy / event titles / nothing).
- **Meeting Prep**: on an event, open commitments between attendees and decisions on related projects; a "Drop transcript" button.
- **Gmail** (several accounts): AI triage "Needs a reply / Waiting for a reply / Contains a commitment / FYI", a "→ Inbox" button.
- **Google Drive**: Picker (`drive.file`) and automatic discovery of Meet transcripts in Meet Recordings.
- **Forward-to-inbox**: a dedicated team email address whose messages land in the inbox.
- **File uploads** for `.docx` and `.pdf` (only text formats for now).
- **Person view + Meeting mode** for 1:1s: one card at a time, quick status buttons, moving the deadline, a comment.
- **⌘K Ask**: natural-language questions to tasks and knowledge (RAG) with an answer and links to sources.
- **Daily digest** (email): newly delegated tasks, overdue items, what is waiting for review, new comments.
- **In-app notifications**: a new task for me, a comment on my task, a status proposal from the owner.
- **Invite emails**: sending the invite by email instead of copying the link by hand.

### v0.3 — Second Brain via MCP

The remote MCP server with OAuth is done (see Updates). Still to do:

- **Meeting prep tool**: open commitments between the attendees and recent decisions on related projects.
- **Proposals instead of direct writes** as an option per connection: an agent's changes go to the inbox for review (human-in-the-loop).
- **Resources**: the user's and teams' `index.md` files as entry points — the agent follows links to the JSON and Markdown it needs, like a person in Obsidian.
- **Client ID Metadata Documents** as an alternative to dynamic client registration.
- **Local mode**: since the data is files with `index.md`, a self-hosted install can simply give Claude Code or Codex read-only access to the `data/` folder.
- Also an MCP client in the other direction: pulling transcripts from Omi, Fireflies, Zoom.

### v0.3+ — other channels and trust in AI

- **Telegram and Slack bots**: as an inbox source and a notification channel.
- **Onboarding pack**: AI assembles a "what a newcomer needs to know" document from the Team Space and team knowledge.
- **Learnings from transcripts**: AI proposes conclusions for hypotheses ("the meeting said conversion is 2% → add as a learning?") and metric updates.
- **Review UX**: J/K/Space/E hotkeys, a name-linking UI ("'Sashko' → Oleksandr S.") that saves to aliases automatically, alternatives when the AI is unsure ("Maybe the TeamOS project?").
- **Meeting deduplication**: if two people drop a transcript of the same meeting — "Oleksandr already processed this meeting" — propose only what is new.
- **External contacts** as a separate entity (name, email, company) instead of free text.
- **Transferring the requester role** when someone leaves the team (Admin/Owner).
- **Auto-accepting** high-confidence proposals (off by default).
- **More interface languages** beyond English and Ukrainian.

### Self-host and SaaS

- **Docker package** and self-host instructions.
- **BYO LLM**: choosing the provider and key in settings (Anthropic / OpenAI / Gemini / a local model).
- **Settings section** in the UI: analysis language, urgency rule, privacy, AI, notifications.
- **Public SaaS**: Google OAuth verification for sensitive/restricted scopes (Calendar, Gmail, Drive), billing.

### Technical debt

- Automated tests for the API and access rules.
- Write locking or a database for many people working in parallel (currently one Node process and files).
- A queue for AI analysis with retries (currently in process memory).
- Mobile layout for key screens.
- Success metrics from the specification: time to process a meeting, precision and recall of proposals, active members.

## Release checks

Run `npm test` before release. The S3 startup integration test uses a simulated S3 service and checks authenticated loading and migration of an existing team and project goal. It cannot verify the production IAM policy.

From a clean checkout of the exact remote `main` commit, run `scripts/release.sh`. It runs the tests and invokes the production deploy over SSH. The production server also runs the tests before activating each new build.

For releases that change storage permissions or data layout, verify access for the production service before switching releases. If an isolated HTTPS staging environment has matching permissions, the release script can also check authenticated profile and workspace loading there. Seed staging with a legacy team and project goal, then provide `TEAMOS_STAGING_URL`, `TEAMOS_STAGING_COOKIE`, `TEAMOS_STAGING_TEAM`, and `TEAMOS_STAGING_GOAL`. Use a staging account and reset the fixture before each migration check.

### Preparing existing workspaces for the processes & agreements release

The release adds new folders (`teams/<id>/processes/`, `teams/<id>/agreements/`, `orgs/<id>/processes/`); existing records keep their format and nothing has to move. On S3, the service needs read, write and delete access under `records/primary/orgs/` as well as under `records/primary/teams/` (until now only `org.json` was written there). Check the IAM policy before switching releases.

The migration collects knowledge entries of type “process” into **draft** process documents: one per team, project and hypothesis they are placed in (up to 40 steps each). Each step links to its knowledge entry and quote, and the entries themselves stay unchanged. A draft takes effect only when whoever owns its level approves it. Knowledge entries of type “agreement” are counted but not converted: an agreement needs every party’s explicit consent. Members can also collect entries later from the Processes page.

As for the OKR release, verify a backup, pause application writes and run the new release’s code with the intended storage configuration:

```bash
node --env-file-if-exists=.env server/migrate-processes.js
```

```bash
node --env-file-if-exists=.env server/migrate-processes.js --apply
```

```bash
node --env-file-if-exists=.env server/migrate-processes.js
```

The dry run reports `processDraftsToCreate`, `processKnowledgeToCollect` and `agreementKnowledgeLeftAsIs`. The final dry run should show `processDraftsToCreate: 0`. Drafts get stable ids, so the migration can be repeated after a failure. Entries added to a placement after it was migrated are reported as `processKnowledgeAddedSinceMigration` and can be collected from the UI. With AI configured, the advocate checks a document automatically on each new version; set `TEAMOS_ADVOCATE_AUTO=0` to only run it on demand.

### Preparing existing workspaces for the OKR release

The new version also migrates legacy organizations and project goals on first read. For a controlled migration, first verify a backup, pause application writes, and run the new release's code with the intended storage configuration and credentials:

```bash
node --env-file-if-exists=.env server/migrate-okr.js
node --env-file-if-exists=.env server/migrate-okr.js --apply
node --env-file-if-exists=.env server/migrate-okr.js
```

The first command is read-only and reports counts. Apply only after reviewing the plan and verifying S3 access; the final dry run should show no remaining organizations or legacy goals. The migration can be repeated after a failure while writes remain paused. A dry run reads existing data but does not prove write permissions. Test the migration against an isolated copy with production-equivalent permissions before running it on production. The deployment SSH account only supports `deploy` and `status`; running this migration on the production host requires an authorized operational access path.
