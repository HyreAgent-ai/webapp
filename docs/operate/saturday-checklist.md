# Saturday-morning rundown checklist

Copy-paste-runnable. No inferred context. A fresh Claude Code session should be able to walk this without asking questions.

---

## 1. Pull the open queue

```bash
gh issue list --repo HyreAgent-ai/webapp --label friend-bug --state open \
  --json number,title,labels,createdAt \
  --jq '[.[] | {number, title, severity: (.labels[] | select(.name|startswith("severity:")) | .name)}]'
```

If the array is empty → inbox zero. Skip to step 6 (update HANDOFF).

## 2. Triage each issue

For every issue returned, confirm or apply a `severity:*` label per `docs/operate/triage-rubric.md`.

```bash
gh issue edit <NUMBER> --repo HyreAgent-ai/webapp --add-label severity:high --remove-label severity:medium
```

## 3. Cut a rundown branch

Batch all `severity:critical` + `severity:high` into one branch off `main`:

```bash
cd /Users/sid/Documents/Upskill/Projects/webapp
git checkout main && git pull
git checkout -b "fixes/$(date +%Y-%m-%d)-saturday-rundown"
```

Fix the issues. Reference each issue number in commit messages: `fix(resume): handle empty PDF (#42)`.

## 4. Owner smoke test on Vercel preview

Push the branch — Vercel auto-creates a preview URL. Walk the happy path on the preview before merging:
- Sign in
- Upload resume
- Run JD analysis
- Create application

```bash
git push -u origin "fixes/$(date +%Y-%m-%d)-saturday-rundown"
gh pr create --fill --base main
```

## 5. Merge + close

```bash
gh pr merge --squash --delete-branch
# Then for each fixed issue:
gh issue close <NUMBER> --repo HyreAgent-ai/webapp --comment "Fixed in <COMMIT_SHA>."
```

## 6. Update HANDOFF.md

In the monorepo (`Siddardth7/job-pipeline`), update `HANDOFF.md` "Last session":
- Count of issues fixed this rundown
- Count carried over (with reason)
- Next rundown date

```bash
cd /Users/sid/Documents/Upskill/Projects/job-pipeline
$EDITOR HANDOFF.md
```

## 7. Commit + push HANDOFF before ending session

```bash
git add HANDOFF.md
git commit -m "chore(handoff): saturday rundown $(date +%Y-%m-%d) — N fixed, M carried"
git push
```

Done. Next rundown: next Saturday.
