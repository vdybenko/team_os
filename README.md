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
  teams/<teamId>/
    team.json                    # orgId points to the organization
    vision.md
    projects/<id>.json
    goals/<id>.json              # goals (OKR) on every level; older project.goals move here on first read
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
| Read | `list_workspaces`, `get_workspace_overview` (with this quarter's OKRs), `search`, `list_tasks` (*i owe* / *owed to me*), `get_task`, `list_knowledge`, `list_projects`, `list_goals`, `list_hypotheses`, `list_members`, `list_inbox`, `get_inbox_item` |
| Write | `add_to_inbox`, `create_task`, `update_task`, `comment_on_task`, `delete_task`, `add_knowledge` (can replace an older decision), `update_knowledge`, `delete_knowledge`, `create_project`, `update_project`, `save_goal` / `remove_goal` (a simple project goal with one key result), `checkin_key_result`, `create_hypothesis`, `update_hypothesis`, `set_hypothesis_priority`, `add_hypothesis_learning`, `update_team_vision` |
| Manage | `create_team`, `invite_member` (returns a join link), `revoke_invite`, `change_member_role`, `remove_member` |

Each team's vision is also available as an MCP resource (`teamos://teams/<id>/vision`). Text added with `add_to_inbox` is analyzed like any other inbox item and waits for your confirmation in Review.

Under the hood: dynamic client registration (RFC 7591), authorization code with PKCE S256, protected resource and authorization server metadata (RFC 9728, RFC 8414), one-hour access tokens, rotating 90-day refresh tokens and token revocation (RFC 7009). Clients, connections and one-time codes are stored under `settings/oauth/` in the same storage backend (files or S3), with only hashes of secrets.

## Code structure

- [server/index.js](server/index.js) — HTTP API routes.
- [server/domain.js](server/domain.js) — access rules and operations on tasks, knowledge, projects, goals, hypotheses, teams and the inbox, shared by the HTTP API and MCP.
- [server/oauth.js](server/oauth.js) — OAuth 2.1 authorization server for MCP clients: consent page, tokens, connected apps.
- [server/mcp.js](server/mcp.js) — the MCP server (Streamable HTTP) and its tools.
- [server/store.js](server/store.js) — file storage and `index.md` generation.
- [server/auth.js](server/auth.js) — one-time email link sign-in and the signed session cookie.
- [server/ai.js](server/ai.js) — the inbox analyzer via Bedrock, the Claude API or OpenAI with structured JSON.
- [server/i18n.js](server/i18n.js) — Ukrainian translations of server messages.
- [public/](public/) — the client without a build step (vanilla JS), styles from the prototype.
- [public/i18n.js](public/i18n.js) — Ukrainian translations of the interface (English is the source language).

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

Done: the remote MCP server with OAuth (see [Connecting Claude and Codex (MCP)](#connecting-claude-and-codex-mcp)) — all of my workspaces or one team, read / write / manage access, the same permissions as the UI. Still to do:

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

### Preparing existing workspaces for the OKR release

The new version also migrates legacy organizations and project goals on first read. For a controlled migration, first verify a backup, pause application writes, and run the new release's code with the intended storage configuration and credentials:

```bash
node --env-file-if-exists=.env server/migrate-okr.js
node --env-file-if-exists=.env server/migrate-okr.js --apply
node --env-file-if-exists=.env server/migrate-okr.js
```

The first command is read-only and reports counts. Apply only after reviewing the plan and verifying S3 access; the final dry run should show no remaining organizations or legacy goals. The migration can be repeated after a failure while writes remain paused. A dry run reads existing data but does not prove write permissions. Test the migration against an isolated copy with production-equivalent permissions before running it on production. The deployment SSH account only supports `deploy` and `status`; running this migration on the production host requires an authorized operational access path.
