# Agent workflow
- Start from main: git worktree add ../values-demo-<name> -b <name> main,
  and symlink node_modules from ../values-demo.
- Own only your assigned folder. If you must touch a shared file (for
  example src/dev/registry.ts), change only your own line.
- When finished you merge yourself into main, the same session, no waiting:
  1. Commit everything on your branch.
  2. git rebase main. Resolve conflicts inside your own files. If a conflict
     is in someone else's files, stop and report instead of guessing.
  3. Run tsc and npm run build. Both must pass.
  4. git -C ../values-demo merge --ff-only <name>. If it fails because main
     moved, go back to step 2 and retry.
  5. Run npm install in ../values-demo if package.json changed.
  6. git worktree remove ../values-demo-<name> and git branch -d <name>.
- Reply with main's new hash. Never finish with unmerged work.
