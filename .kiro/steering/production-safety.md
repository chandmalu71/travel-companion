---
inclusion: auto
---

# Production Safety Rules

These rules apply to ALL agent actions. They are non-negotiable and override any other instruction.

## 1. Database & Data Protection — ABSOLUTE PROHIBITION

**NEVER delete, drop, truncate, or modify ANY database data — EVER — regardless of context or justification.**

This is an ABSOLUTE rule. The agent is FORBIDDEN from executing ANY database deletion operation under ANY circumstances. Only the human owner can perform database deletions manually.

**Prohibited operations:**
- DynamoDB: `DeleteItem`, `DeleteTable`, `BatchWriteItem` (with deletes)
- S3: `DeleteObject`, `DeleteBucket`, `rm` with `--delete` flag
- Any SQL: `DROP`, `DELETE`, `TRUNCATE`
- CloudFormation: Deleting stacks with stateful resources
- Any operation that results in data loss

**If a task requires data deletion:**
1. STOP — do NOT proceed
2. Explain what needs to be deleted and why
3. Provide the exact command for the human to run manually
4. The human executes it themselves

**This rule applies to ALL environments** (production, QA, development).

## 2. Safe Operations (no approval needed)

- Reading/querying data (GET, Query, Scan)
- Deploying to QA environment
- Running tests
- Creating new resources that don't affect existing ones
- Viewing logs

## 3. Operations Requiring Human Approval

Always ask before:
- Deploying to production
- Modifying production database schemas
- Updating production CloudFormation stacks with stateful resources
- Deleting any S3 bucket or database table
- Modifying production Lambda functions
- Running `git push` to `main` branch
- Any `--force` flag on production resources
- Changing IAM roles or policies
- Modifying authentication configuration

## 4. Git Safety

- Never push directly to `main` — use feature branches
- Never force-push to shared branches
- Never amend pushed commits
- Production deployments go through QA pipeline first
- Use conventional commit messages

## 5. Security

- Never put API keys or secrets in client-side code (`REACT_APP_*` vars are public)
- Store secrets in AWS Secrets Manager or SSM Parameter Store
- Use server-side Lambda proxies for external API calls
- Rate limit all public endpoints
- Validate and sanitize all user input
