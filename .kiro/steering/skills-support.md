---
inclusion: always
---

# Skills Support

This workspace uses Skills - modular packages that extend your capabilities with specialized knowledge, workflows, and tools.

## Discovering Available Skills

Skills are located in `.kiro/skills/*/SKILL.md`. Each SKILL.md file contains:

- **YAML frontmatter** with `name` and `description` fields
- **Markdown body** with detailed instructions (loaded only when skill is used)

## When to Use Skills

**Proactively scan for skills** when the user's request matches common patterns:

- Testing, running tests, verifying code → Check for test-related skills
- Creating new capabilities, scaffolding → Check for creator/generator skills
- Domain-specific tasks → Check for domain-specific skills

## How to Use Skills

1. **Discover**: Read the frontmatter (name + description) from `.kiro/skills/*/SKILL.md` files to understand available capabilities
2. **Match**: Compare user request against skill descriptions
3. **Load**: When a skill matches, read the full SKILL.md body for detailed instructions
4. **Execute**: Follow the skill's guidance, using bundled resources as needed

## Skill Structure

```
.kiro/skills/<skill-name>/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/          - Executable code
    ├── references/       - Documentation to load as needed
    └── assets/           - Files for output (templates, etc.)
```

## Reading Skills Efficiently

- **Always read frontmatter first** to understand what skills are available
- **Load full SKILL.md** only when the skill matches the user's request
- **Load references/** files only when SKILL.md indicates they're needed
- **Execute scripts/** without loading into context when possible

## Example Workflow

```bash
# 1. User asks: "Run the tests"
# 2. Scan available skills:
ls .kiro/skills/*/SKILL.md

# 3. Read frontmatter to find test-related skills
# 4. Load matching skill's full content
# 5. Follow skill instructions
```

## Key Principles

- Skills share the context window - load only what's needed
- Frontmatter descriptions are the primary trigger mechanism
- Progressive disclosure: metadata → SKILL.md → references → scripts
- Trust the skill's guidance - it contains specialized knowledge
