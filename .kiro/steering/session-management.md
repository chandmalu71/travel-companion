---
inclusion: auto
---

# Session Management

## End of Session Protocol

When the user indicates the session is ending (says "let's wrap up", "goodnight", "end session", "that's it for now", or asks to create a session summary), automatically:

1. **Create a session summary file** at `.kiro/sessions/YYYY-MM-DD-<topic>.md` with:
   - Date and duration description
   - What was accomplished (grouped by category)
   - Key decisions made
   - Pending items for next session (with checkboxes)
   - Technical context (accounts, URLs, credentials refs, branch info)

2. **Update tasks.md** — mark any completed tasks with [x]

3. **Commit and push** the session file

## Session Summary Template

```markdown
# Session: <Short Title>

**Date:** <date>
**Focus:** <1-line description>

---

## Accomplished
- Category 1
  - item
- Category 2
  - item

## Decisions Made
1. Decision and reasoning

## Pending for Next Session
- [ ] Critical items
- [ ] Important items
- [ ] Nice-to-have items

## Technical Context
- Branch: develop
- AWS: profile neyya, account 008582147209, eu-west-1
- QA: qa.neyya.ai / api-qa.neyya.ai / admin-qa.neyya.ai
- Deploy: git push origin develop
- Last commit: <sha> <message>
```

## Start of Session Protocol

When starting a new session, the user should reference the latest session file in `.kiro/sessions/` for context. The agent should:

1. Read `.kiro/sessions/` to find the most recent file
2. Check `tasks.md` for pending items
3. Ask: "I've read the last session summary. Want to continue from where we left off, or work on something new?"
