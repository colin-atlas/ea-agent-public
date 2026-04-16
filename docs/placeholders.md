# Placeholder Tokens

Every `[TOKEN]` in the kit's template files is listed here. During installation, the bootstrap skill interviews you for some of these values. Others are filled organically through conversations with your agent over time.

---

## Core (always asked during bootstrap)

These tokens are required by `identity/workspace` and `cron/schedule` — present in every bundle.

| Token | Description | Example |
|---|---|---|
| `AGENT_NAME` | What your agent calls itself | Kai |
| `AGENT_EMOJI` | Agent's emoji identifier | 🤖 |
| `EXECUTIVE_NAME` | Your full name | Jane Doe |
| `EXECUTIVE_FIRST_NAME` | Your first name (used in greetings) | Jane |
| `EXECUTIVE_ROLE` | Your title | CEO |
| `COMPANY_NAME` | Company name | Example Co |
| `EXECUTIVE_TIMEZONE` | IANA timezone string | America/Denver |
| `EXECUTIVE_CHANNEL_ID` | Your Slack/Discord user ID | U01ABCDEF |
| `PRIMARY_CHANNEL` | Main communication channel ID | C01ABCDEF |

---

## Company details (asked if required by selected bundle)

Required by `identity/workspace` and `brain/knowledge-vault`.

| Token | Description | Example |
|---|---|---|
| `COMPANY_DESCRIPTION` | One-sentence company description | AI-powered executive assistants |
| `COMPANY_WEBSITE` | Company website URL | https://example.com |
| `COMPANY_MISSION` | Company mission statement | To free executives from administrative burden |

---

## Location

| Token | Description | Example |
|---|---|---|
| `EXECUTIVE_LOCATION` | Where you're based | Denver, CO |

---

## Vendor / support (asked if required by selected bundle)

Required by `brain/knowledge-vault`. Leave blank if not using a vendor support contact.

| Token | Description | Example |
|---|---|---|
| `VENDOR_NAME` | Agent support vendor name | Atlas Assistants |
| `VENDOR_SUPPORT_EMAIL` | Vendor support email address | support@example.com |
| `VENDOR_DOCS_URL` | Vendor documentation URL | https://docs.example.com |
| `VENDOR_PORTAL_URL` | Vendor portal URL | https://portal.example.com |

---

## Interview-driven (filled over time, not during bootstrap)

These tokens appear in templates but are filled through natural conversations with your agent — during onboarding, goal-setting sessions, or as your context evolves. The bootstrap skill leaves them as `[TOKEN]` placeholders; your agent replaces them when you discuss these topics.

### Goals and strategy

| Token | Description |
|---|---|
| `GOAL_1_TITLE`, `GOAL_2_TITLE`, `GOAL_3_TITLE` | Big Three quarterly goal titles |
| `GOAL_1_DESCRIPTION`, `GOAL_2_DESCRIPTION`, `GOAL_3_DESCRIPTION` | Goal descriptions |
| `GOAL_1_WHY`, `GOAL_2_WHY`, `GOAL_3_WHY` | Why each goal matters |
| `CHALLENGE_1`, `CHALLENGE_2`, `CHALLENGE_3` | Current top challenges |
| `VISION_1_YEAR`, `VISION_3_YEAR`, `VISION_5_YEAR` | Company vision at 1/3/5 years |
| `VALUE_1_NAME`, `VALUE_2_NAME`, `VALUE_3_NAME` | Company values |
| `VALUE_1_DESCRIPTION`, `VALUE_2_DESCRIPTION`, `VALUE_3_DESCRIPTION` | Value descriptions |
| `METRIC_1`, `METRIC_2` | Key performance metrics |

### Projects

| Token | Description |
|---|---|
| `PROJECT_1`, `PROJECT_2`, `PROJECT_3` | Active project names |
| `PROJECT_1_DESCRIPTION`, `PROJECT_2_DESCRIPTION`, `PROJECT_3_DESCRIPTION` | Project descriptions |

### Team

| Token | Description |
|---|---|
| `TEAM_ORG_CHART` | Organizational chart / team structure |
| `REPORT_1_NAME` | Direct report's name |
| `REPORT_1_ROLE` | Direct report's role |
| `REPORT_1_1ON1` | 1-on-1 schedule for this report |
| `ADVISOR_1_NAME` | Advisor/board member name |
| `ADVISOR_1_ROLE` | Advisor's role |
| `ADVISOR_1_SCHEDULE` | Cadence for advisor meetings |
| `EXECUTIVE_TITLE` | Full formal title (when distinct from EXECUTIVE_ROLE) |

### EA / human assistant (if applicable)

| Token | Description |
|---|---|
| `EA_NAME` | Human EA's full name |
| `EA_FIRST_NAME` | Human EA's first name |
| `EA_CHANNEL_ID` | Human EA's Slack/Discord user ID |
| `EA_TIMEZONE` | Human EA's timezone |
| `EA_WORKING_HOURS` | EA's working hours |
| `EA_1ON1_DAY` | Day of EA 1-on-1 |
| `EA_1ON1_SCHEDULE` | EA 1-on-1 schedule details |
| `ADDITIONAL_EA_RESPONSIBILITIES` | Extra responsibilities for the EA |
| `GROUP_DM_CHANNEL_ID` | Group DM channel including EA |

### Permissions and preferences

| Token | Description |
|---|---|
| `EXECUTIVE_PERMISSION_TIER` | Permission level for the executive user |
| `EA_PERMISSION_TIER` | Permission level for the EA user |
| `DECISION_STYLE` | How you prefer decisions surfaced |
| `PREFERENCE_1`, `PREFERENCE_2`, `PREFERENCE_3` | Working preferences |
| `SECURITY_PREFERENCE` | Security posture preference |
| `UPDATE_PREFERENCE` | How you prefer status updates |
| `OTHER_PREFERENCES` | Catch-all for additional preferences |

### Gmail labels (configured during onboarding)

These tokens appear in inbox-triage skill configuration and are set during your email setup conversation.

| Token | Description |
|---|---|
| `GMAIL_LABEL_NEEDS_ATTENTION` | Label ID for emails needing attention |
| `GMAIL_LABEL_DELEGATED` | Label ID for delegated emails |
| `GMAIL_LABEL_FOLLOW_UP` | Label ID for follow-up emails |
| `GMAIL_LABEL_WAITING_FOR` | Label ID for waiting-on emails |
| `GMAIL_LABEL_READ_ONLY` | Label ID for read-only/FYI emails |
| `GMAIL_LABEL_CALENDAR` | Label ID for calendar-related emails |
| `GMAIL_LABEL_TASK_APPS` | Label ID for task app notifications |
| `GMAIL_LABEL_CONNECTEAM` | Label ID for Connecteam notifications |
| `GMAIL_LABEL_MARKETING` | Label ID for marketing emails |
| `GMAIL_LABEL_RECEIPTS` | Label ID for receipts |

### Other runtime tokens

These appear inside skill template examples and operational docs — not installation tokens.

| Token | Context |
|---|---|
| `ACCOUNT_EMAIL` | Google account email (runtime config) |
| `CLIENT_TIMEZONE`, `CLIENT_TZ_ABBREV` | Runtime timezone fields in skill output |
| `ATLAS_SUPPORT_USER_ID`, `ATLAS_SLACK_CHANNEL_ID` | Support channel IDs (set during onboarding) |

---

## Environment variables (not template tokens)

These are NOT `[TOKEN]` placeholders — they're runtime env vars that components list in `requires.env`. Set them on your VPS, not through the interview.

| Variable | Description | Required by |
|---|---|---|
| `GOOGLE_REFRESH_TOKEN` | Google OAuth refresh token | scripts/google-api, skills/inbox-triage |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | scripts/google-reauth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | scripts/google-reauth |
| `FATHOM_API_KEY` | Fathom API key | scripts/fathom-api, skills/meeting-debrief |
