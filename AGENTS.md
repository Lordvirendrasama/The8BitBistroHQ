# Autonomous Agent Guidelines & Workflow Policies

## 1. Autonomous Execution

- Operate autonomously. Do not ask for approval or confirmation for normal development tasks.
- Inspect the relevant code, determine the appropriate solution, and implement it directly.
- Only request confirmation before genuinely destructive or irreversible actions, such as dropping a production database, deleting important user data, or overwriting critical files.
- Do not stop merely to explain what you intend to do when you can safely perform the work yourself.

## 2. Fast Iterative Development

- Optimize for rapid iteration and short feedback loops.
- For small changes, follow:
  1. Inspect relevant code.
  2. Make the change.
  3. Test the affected functionality.
  4. Fix any resulting issue.
  5. Continue with the next task.
- Do not perform unnecessary project-wide checks after every small edit.
- UI-only changes should generally be tested through the normal development environment rather than triggering full-project validation.

## 3. File Inspection and Editing

- Prefer native file tools for inspecting and modifying the codebase.
- Use file search, file viewing, grep/search, and directory inspection tools instead of shell commands whenever possible.
- Do not use ad-hoc `node -e`, temporary shell scripts, or scratch commands simply to inspect or test small pieces of code.
- Make targeted edits rather than rewriting unrelated portions of files.
- Preserve existing functionality and conventions unless the task requires changing them.

## 4. Terminal Usage

Use terminal commands only when they provide meaningful value that cannot be obtained more directly through native tools or the application's normal development environment.

### Do NOT routinely run:

- `git status`
- `npx tsc --noEmit`
- ad-hoc `node -e` commands
- unrelated diagnostic commands

Terminal commands can trigger IDE permission prompts, so avoid unnecessary commands that interrupt the development workflow.

## 5. Git

- Do not run `git status` after every edit.
- Git status is only necessary when:
  - preparing to commit;
  - determining what files changed;
  - investigating unexpected modifications;
  - checking repository state before a major operation.
- Do not use Git commands merely as a routine step after making a small change.
- Never reset, revert, checkout, or discard user changes without explicit permission.

## 6. TypeScript Checking

- Do NOT run `npx tsc --noEmit` after every edit.
- During rapid development, rely on the development server, compiler feedback, and targeted testing.
- Run `npx tsc --noEmit` when:
  - a substantial TypeScript refactor is complete;
  - a TypeScript/type-related problem is suspected;
  - the user explicitly requests a type check;
  - the project is being prepared for a build, commit, or deployment.
- If TypeScript reports an error, investigate and fix the underlying issue rather than simply ignoring or suppressing it.

## 7. Testing Strategy

- Test the smallest relevant scope first.
- After a small UI change, verify the affected page/component rather than running every project-wide check.
- For larger features, test the complete affected workflow.
- Before considering a substantial feature complete, perform appropriate broader validation.
- Do not repeatedly run the same check if it provides no new information.

## 8. Build and Deployment Validation

Before a production build or deployment:

1. Verify the affected functionality.
2. Run the appropriate TypeScript/type check if applicable.
3. Run the production build.
4. Fix any errors.
5. Inspect Git state if necessary.
6. Report any remaining issues.

## 9. Permission Prompts

- Avoid commands that unnecessarily trigger IDE permission dialogs.
- Prefer native non-prompting tools whenever they can accomplish the same task.
- When a safe development command genuinely needs to be executed, run it rather than asking the user to perform it manually.
- Do not repeatedly request permission for routine file inspection or editing.

## 10. General Principle

Prioritize:

**Inspect → Edit → Test → Fix → Continue**

Do not turn every small change into:

**Edit → git status → full TypeScript check → unrelated diagnostics → permission prompt → wait for approval.**

Use deeper validation strategically when the scope of the change justifies it.