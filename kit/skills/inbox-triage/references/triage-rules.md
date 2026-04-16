# Inbox Triage Rules

## [EXECUTIVE_FIRST_NAME]'s 10-Label System

| Label Name | Gmail Label ID | Use Case |
|---|---|---|
| `0-Needs Attention` | `[GMAIL_LABEL_NEEDS_ATTENTION]` | Requires [EXECUTIVE_FIRST_NAME]'s personal response, decision, or voice |
| `1. [COMPANY_NAME] Marketing Emails` | `[GMAIL_LABEL_MARKETING]` | [COMPANY_NAME] marketing/promo outbound |
| `2. Follow Up` | `[GMAIL_LABEL_FOLLOW_UP]` | Needs follow-up; [EA_FIRST_NAME] can handle the response |
| `3-Delegated` | `[GMAIL_LABEL_DELEGATED]` | Routed to [EA_FIRST_NAME] to handle directly |
| `4. Read Only` | `[GMAIL_LABEL_READ_ONLY]` | FYI/newsletters/promos — no action needed |
| `5. Waiting For` | `[GMAIL_LABEL_WAITING_FOR]` | Awaiting someone else's response |
| `6. Task Management Apps` | `[GMAIL_LABEL_TASK_APPS]` | Notifications from task/project tools |
| `7. Calendar Invites` | `[GMAIL_LABEL_CALENDAR]` | Meeting invites and calendar events |
| `8. Receipts & Finances` | `[GMAIL_LABEL_RECEIPTS]` | Receipts, invoices, financial notifications |
| `9. Connecteam` | `[GMAIL_LABEL_CONNECTEAM]` | Any email from Connecteam platform |

---

## Label Detection (Already Triaged)

An email is **already triaged** if its `labelIds` contains any of these label IDs:
- `[GMAIL_LABEL_NEEDS_ATTENTION]` (0-Needs Attention)
- `[GMAIL_LABEL_MARKETING]` (1. [COMPANY_NAME] Marketing Emails)
- `[GMAIL_LABEL_FOLLOW_UP]` (2. Follow Up)
- `[GMAIL_LABEL_DELEGATED]` (3-Delegated)
- `[GMAIL_LABEL_READ_ONLY]` (4. Read Only)
- `[GMAIL_LABEL_WAITING_FOR]` (5. Waiting For)
- `[GMAIL_LABEL_TASK_APPS]` (6. Task Management Apps)
- `[GMAIL_LABEL_CALENDAR]` (7. Calendar Invites)
- `[GMAIL_LABEL_RECEIPTS]` (8. Receipts & Finances)
- `[GMAIL_LABEL_CONNECTEAM]` (9. Connecteam)

---

## Classification Rules

### Step 1: Deterministic (Pattern Match) — High Confidence

Apply these before any judgment. First match wins.

| Condition | Label |
|---|---|
| Sender domain contains `connecteam.com` | `9. Connecteam` |
| Subject/sender matches task tools: Asana, Monday, ClickUp, Notion, Trello, Jira, Linear | `6. Task Management Apps` |
| Email is a calendar invite (has `text/calendar` content-type, or subject starts with "Invitation:", "Accepted:", "Declined:", "Updated invitation:") | `7. Calendar Invites` |
| Sender is `noreply@`, `no-reply@`, `notifications@`, `billing@`, `receipts@`, `invoices@` and subject mentions receipt/invoice/payment/order | `8. Receipts & Finances` |
| Sender domain is `[COMPANY_DOMAIN]` and it's a marketing/promotional email | `1. [COMPANY_NAME] Marketing Emails` |
| Sender is `mailer-daemon@` or `postmaster@` (bounce/delivery failure) | `4. Read Only` |

### Step 2: Judgment-Based — Medium/Low Confidence

Evaluate sender, subject, and snippet together.

| When | Label | Confidence |
|---|---|---|
| From a known client, partner, investor, or strategic contact — requires [EXECUTIVE_FIRST_NAME]'s voice/decision | `0-Needs Attention` | High |
| From an unknown person asking a specific question that needs a personal reply | `0-Needs Attention` | Medium |
| Needs action/follow-up but [EA_FIRST_NAME] can own the response | `2. Follow Up` | Medium |
| Should be handled by [EA_FIRST_NAME] entirely (admin, scheduling, vendor coordination) | `3-Delegated` | Medium |
| Waiting on a reply from someone else | `5. Waiting For` | High |
| Newsletter, promotional, general FYI — no action needed | `4. Read Only` | High |

### Step 3: Re-evaluate Existing `0-Needs Attention`

For emails already labeled `0-Needs Attention`:
- Check: has this been replied to? (look for `SENT` label on thread, or `5. Waiting For` reply)
- If no longer actionable → remove `0-Needs Attention`, apply most fitting label
- If still needs [EXECUTIVE_FIRST_NAME] → keep label

---

## Confidence Levels

- **High**: Deterministic match or unambiguous judgment → auto-apply
- **Medium**: Reasonable call, could go either way → auto-apply
- **Low**: Ambiguous → route to `3-Delegated` ([EA_FIRST_NAME] reviews)

**Default when truly ambiguous:** `3-Delegated` — [EA_FIRST_NAME] will relabel or handle

**Priority contacts (always `0-Needs Attention` unless clearly automated):**
- Clients (current and prospective)
<!-- Replace with client's key people -->

- Investors or strategic partners
- Press/media inquiries

---

## Team Context

| Person | Role | Email routing |
|---|---|---|
| [EA_FIRST_NAME] | EA | `3-Delegated` or `2. Follow Up` |
| [Team Member 1] | Client Success | Can handle client comms → `3-Delegated` |
| [Team Member 2] | Ops | Ops/admin items → `3-Delegated` |
| [Team Member 3] | Sales | Sales follow-ups → `2. Follow Up` or `3-Delegated` |
| [Team Member 4] | Fractional CFO | Finance/billing → `8. Receipts & Finances` or `0-Needs Attention` |
| [Board Member] | Board Chair | Always → `0-Needs Attention` |
