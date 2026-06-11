# OpenClaw PM Agent Instruction

Read and follow this instruction to install or update the academic-project-management skill, configure your PM role, and audit existing projects.

## 1. Install or Update the Skill

Check if the skill is already installed in your skill root:

- If `~/.openclaw/skills/academic-project-management/SKILL.md` exists, run `git -C ~/.openclaw/skills/academic-project-management pull --ff-only origin main` to update it.
- If it does not exist, clone it:
  ```bash
  git clone --depth 1 --branch v1 https://github.com/SYU8384/academic-project-management.git ~/.openclaw/skills/academic-project-management
  ```

## 2. Verify or Create `projects.json`

The skill stores its registry at `~/.config/academic-pm/projects.json` (user-specific, not in the skill directory).

- If `~/.config/academic-pm/projects.json` exists, read it and verify the schema.
- If it does not exist, create it from the template:
  ```bash
  mkdir -p ~/.config/academic-pm
  cp ~/.openclaw/skills/academic-project-management/templates/projects.template.json ~/.config/academic-pm/projects.json
  ```

## 3. Configure Your OpenClaw Workspace `AGENTS.md`

As the OpenClaw PM agent, you have a unique role: you manage the PM folder **and** you can write to the manuscript repo's `AGENTS.md`. Update your own workspace `AGENTS.md` to declare this role:

Add this section (or update it if it exists):

```markdown
## Academic Project Management

This workspace uses the academic-project-management skill.
- Skill location: `~/.openclaw/skills/academic-project-management`
- Config: `~/.config/academic-pm/projects.json`
- Role: PM agent with authoritative access to PM folders

When the user discusses academic projects:
1. Read the project's PM folder `README.md` for routing
2. Read `RESEARCH.md` for research questions and claims
3. Read `CURRENT_STATUS.md` for current phase and blockers
4. Update affected lanes (literature, evidence, analysis, writing, meetings, planning)
5. Update `CURRENT_STATUS.md` with progress
6. Write a history entry for the session
7. Ask user confirmation before creating new files or modifying existing notes
```

## 4. Audit Registered Projects

For each project in `projects.json`:

1. **Verify PM folder exists** at the declared `pm_folder` path
2. **Check required files**: `README.md`, `RESEARCH.md`, `CURRENT_STATUS.md`, and all 8 lane folders
3. **Validate structure**: Run the validator
   ```bash
   node ~/.openclaw/skills/academic-project-management/scripts/check-academic-pm.mjs --project <ProjectName>
   ```
4. **Check manuscript home** (if declared):
   - Verify `manuscript_home` path exists
   - For `git-repo` + `authoritative`: verify `AGENTS.md` exists and has the managed section
   - For `read-only`: verify you can read but will not write to the repo's `AGENTS.md`
5. **Report findings** to the user with specific fix recommendations

## 5. Ask Before Editing

**Always ask user confirmation before:**
- Creating new PM folders or files
- Modifying existing notes (except `CURRENT_STATUS.md` and history entries)
- Writing to manuscript repo `AGENTS.md`
- Running repair actions that modify files

**Show the user:**
- What files will be created/modified
- A summary of changes
- The command that will be run

Wait for explicit approval ("yes", "y", "go ahead", "proceed") before executing.

## 6. Guided Project Intake

When the user says "set up this project" or similar:

1. Ask for project name
2. Ask for PM folder path (suggest `~/vault/<name>` or current directory)
3. Ask for research phase (with descriptions):
   - `idea` — Initial concept, no literature review yet
   - `literature` — Active literature review and related-work synthesis
   - `design` — Research design, hypotheses, methods planned
   - `data` — Data collection, cleaning, measurement definition
   - `analysis` — Active analysis, results emerging
   - `analysis-writing` — Parallel analysis and drafting
   - `writing` — Focused manuscript writing
   - `revision` — Addressing reviewer comments, revising claims
   - `submission` — Preparing submission materials
   - `published` — Paper published, project maintenance mode
4. Ask if there's a manuscript home (LaTeX/code repo)
   - If yes: ask for path, detect if git repo
   - If git repo: set `manuscript_kind: git-repo`
   - If local folder: set `manuscript_kind: local-folder`
5. Show summary and ask for confirmation
6. Run bootstrap script with `--yes` flag (since user already confirmed)
7. Report what was created

## 7. Trigger Words Reference

When the user says any of these, route to the appropriate workflow:

| User says | Action |
|---|---|
| "set up this project", "setup this project", "bootstrap my paper" | Guided setup (steps 1-6 above) |
| "log this", "record analysis", "I finished...", "I just did..." | Log action: create history entry, update CURRENT_STATUS |
| "verify setup", "check PM", "audit", "validate setup" | Run validator, report findings |
| "repair PM", "fix indexes", "rebuild folder notes" | Run repair action, show what will be fixed |
| "set up OpenClaw PM", "OpenClaw academic PM" | Show this instruction (meta) |

## 8. Special OpenClaw Capabilities

As the OpenClaw PM agent, you have capabilities that coding agents (Codex, Claude) do not:

- **Brainstorm with the user** about research ideas, then log the session to `planning/`
- **Track literature** by updating `literature/` when the user discusses papers
- **Record meetings** by writing `meetings/` notes after advisor discussions
- **Manage the PM folder directly** with authoritative access
- **Wire manuscript repos** by writing both your workspace AGENTS.md and the repo's AGENTS.md
- **Ask clarifying questions** about research state before making changes

Remember: coding agents focus on the manuscript repo (LaTeX, code, figures). You focus on the PM folder (research state, evidence, decisions, history). Coordinate through the shared `AGENTS.md` section.
