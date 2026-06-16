# Saturday rundown — canonical query

Run this every Saturday morning to pull the open friend-bug queue from `HyreAgent-ai/webapp`.

```bash
gh issue list --repo HyreAgent-ai/webapp --label friend-bug --state open \
  --json number,title,labels,createdAt \
  --jq '[.[] | {number, title, severity: (.labels[] | select(.name|startswith("severity:")) | .name)}]'
```

Output is a JSON array of `{number, title, severity}`. Empty array means inbox zero.

Pair this with `docs/operate/triage-rubric.md` (severity definitions) and `docs/operate/saturday-checklist.md` (the full playbook).
