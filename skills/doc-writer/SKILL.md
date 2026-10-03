---
name: doc-writer
description: Write and maintain bilingual (English + Chinese) documentation for
  the Relax project. Use when user asks to create, update, or translate
  documentation pages. Ensures format correctness (VitePress, sidebar config,
  bilingual parity) and content correctness (matches actual codebase, no
  fabricated features).
---

# Documentation Writer

Write bilingual VitePress documentation for the Relax project, ensuring both **format correctness** and **content correctness**.

## Inviolable Rules

1. **Bilingual requirement** — create or update both English (`docs/en/guide/`) and Chinese (`docs/zh/guide/`) pages together. Both versions must have identical structure and technical coverage.
2. **Format correctness** — use the actual `docs/en/` and `docs/zh/` layout, register published pages in `docs/.vitepress/config.mts`, and follow the established Markdown conventions.
3. **Content correctness** — verify every API, config option, CLI flag, default, and limitation against current source code. Never invent features, describe removed APIs, or turn a successful test or training experiment into a feature guarantee.
4. **User-facing purpose** — help users understand, configure, and operate the feature. Never publish test or training acceptance reports as user documentation. Keep test counts, acceptance checklists, execution logs, machine traces, and verification history in internal notes or the PR's validation evidence, not in guide content or navigation.

## Clear, task-based writing

Aim for **“80% of the way to ASD-STE100”**, not strict compliance or certification. Apply the same clarity principles to English and Chinese:

- Use short sentences. Name the actor and action. Give one instruction at a time.
- Use numbered steps for a procedure. State prerequisites, required inputs, and expected outputs.
- Use one term for each concept. Define necessary technical terms at first use; avoid unnecessary jargon and vague feature lists.
- Start with what the feature does and when to use it. Provide the smallest runnable configuration and commands, then necessary parameters, defaults, limitations, and troubleshooting.
- Separate example-script defaults from parser defaults. Mark user-supplied paths clearly. Verify commands and configuration against the code that consumes them.
- Explain stable user-facing causes and remedies instead of copying historical incidents or validation logs. State the conditions of supported behavior; do not promise universal quality, performance, or reliability from a test result.

For a cleanup task, read the actual affected pages (including live pages when supplied), source, navigation, and related code before editing. Preserve useful operating instructions in the guide. Remove report pages, their navigation, dangling links, and assets used only by those reports. Keep both languages synchronized and avoid unrelated site-wide changes.

______________________________________________________________________

## Workflow

### Step 0: Check if this is a draft document

**IMPORTANT**: If the user is working on a document in `docs/draft/`, this skill should **NOT** be invoked unless the user explicitly says they want to "publish" or "release" the draft.

- Documents in `docs/draft/` are temporary/work-in-progress documents
- Users can freely create, edit, and iterate on drafts without triggering this skill's strict bilingual and verification requirements
- Only when the user explicitly requests to publish/release a draft (e.g., "publish this draft", "move this to the official docs", "release the draft documentation") should you proceed with the full workflow below

If the current task involves a draft document and the user has NOT requested publication, politely decline and suggest they can continue working on the draft freely, or ask if they want to publish it.

### Step 1: Determine scope

Ask (or infer from user request):

- **Topic**: which module or feature to document (e.g., "checkpoint engine", "notification system")
- **Category**: where it belongs in the sidebar (`Getting Started`, `Core Concepts`, `Advanced`, `Development`, or `Examples`)
- **Filename**: kebab-case, e.g., `checkpoint-engine.md`

### Step 2: Verify content against source code

Before writing a single line of documentation, **read the actual source code** for the feature being documented. Required steps:

1. **Identify relevant source files** — search `relax/`, `transfer_queue/`, `examples/` for the module.
2. **Read public APIs** — list all classes, functions, and their actual signatures (parameter names, types, defaults).
3. **Read config/arguments** — check `relax/utils/arguments.py` or the relevant argument parser for CLI flags.
4. **Check imports** — verify that import paths shown in code examples are correct (e.g., `from relax.metrics import MetricsClient`).
5. **Check existing docs** — read any related existing docs to avoid contradictions.

**Critical**: If the source code differs from what the user describes, trust the source code and note the discrepancy.

### Step 3: Write BOTH English and Chinese docs

**CRITICAL**: You MUST create BOTH language versions in the same session. Never create only one version.
**CRITICAL**: ASCII art diagrams (box-drawing characters ┌┐└┘ forming rectangular boxes) must ALWAYS use English text, even in Chinese docs. Never translate text inside box-drawing diagrams to Chinese.

#### Step 3a: Write English doc

Create `docs/en/guide/<filename>.md` (or `docs/en/examples/<filename>.md`, `docs/en/api/<filename>.md` depending on category).

Use `references/doc-template.md` as a task-based outline, not a mandatory list of sections. Keep verification evidence separate from the page.

Key rules:
- Title is an H1 (`#`) matching the feature name
- Prefer: Purpose / when to use → Prerequisites → Steps → Configuration → Limitations → Troubleshooting → Next Steps
- Add architecture or API detail only when users need it for the task. Omit irrelevant sections; do not pad the page with generic descriptions.
- Code examples must use real import paths and real function signatures from Step 2
- Architecture diagrams use ASCII art (box drawing characters: `┌ ─ ┐ │ └ ┘ ▼ ▲ ► ◄`)
- Use VitePress containers: `::: tip`, `::: warning`, `::: danger`
- Cross-reference other docs with relative links: `[Architecture](./architecture.md)`
- End with "Next Steps" linking to 2-3 related docs

#### Step 3b: Write Chinese doc (MANDATORY)

**Immediately after** creating the English doc, create the Chinese counterpart at `docs/zh/guide/<filename>.md` (or corresponding `zh/` path).

Translation rules:
- Translate ALL prose text to Chinese
- Keep code blocks, CLI commands, variable names, class names **unchanged**
- Translate code comments inside code blocks to Chinese
- Keep technical terms that are widely used in English as-is (e.g., "Ray Serve", "TensorBoard", "checkpoint") — no forced translation
- Section headers must be natural Chinese (e.g., "Overview" → "概述", "Quick Start" → "快速开始", "Configuration" → "配置", "Best Practices" → "最佳实践", "Troubleshooting" → "故障排除", "Next Steps" → "下一步")
- Chinese doc must cover the exact same sections and content as the English doc — no missing sections, no extra sections

**Verification**: Before proceeding to Step 4, confirm that BOTH `docs/en/guide/<filename>.md` AND `docs/zh/guide/<filename>.md` have been created.

### Step 4: Register in VitePress config

Edit `docs/.vitepress/config.mts`:

1. Add to the English sidebar under the correct group
2. Add to the Chinese sidebar under the corresponding Chinese group
3. Both entries must use correct `link` paths (`/en/guide/<filename>` and `/zh/guide/<filename>`)

English sidebar group mapping:
| Category | Sidebar group text |
|---|---|
| Getting Started | `Getting Started` |
| Core Concepts | `Core Concepts` |
| Advanced | `Advanced` |
| Development | `Development` |
| Examples | (separate `/en/examples/` sidebar) |
| API | (separate `/en/api/` sidebar) |

Chinese sidebar group mapping:
| Category | Sidebar group text |
|---|---|
| Getting Started | `快速开始` |
| Core Concepts | `核心概念` |
| Advanced | `进阶指南` |
| Development | `开发指南` |
| Examples | (separate `/zh/examples/` sidebar) |
| API | (separate `/zh/api/` sidebar) |

### Step 5: Verify

After creating both docs and updating config:

1. **Verify both language versions exist** — confirm BOTH `docs/en/guide/<filename>.md` AND `docs/zh/guide/<filename>.md` have been created. If only one exists, immediately create the missing version.
2. **Cross-check code examples** — re-read the source files and confirm every import path, class name, and function signature in the doc matches the code.
3. **Check bilingual parity** — confirm both docs have the same sections in the same order, with identical content coverage.
4. **Check sidebar config** — confirm both English and Chinese entries are added to `config.mts`.
5. **Check internal links** — any `[text](./other-doc.md)` references must point to docs that actually exist.
6. **Check repository paths** — scan the doc for every file/directory path that references the repo (e.g., `relax/utils/health_system.py`, `scripts/models/qwen3-4B.sh`). For each path, verify the file or directory actually exists. Remove or correct any stale/wrong paths.
7. **Check user-facing content** — remove test reports, acceptance evidence, and unsupported guarantees from the page. Keep necessary operating instructions and troubleshooting.
8. **Build and inspect** — run the docs build, check emitted links and rendered pages, and run applicable project checks. A passing build alone does not prove links are valid. Report results and unavailable hardware checks in the PR, not in the guide.

______________________________________________________________________

## Content Verification Checklist

When writing docs, verify each of these against the source code:

- [ ] **Bilingual completeness** — BOTH English (`docs/en/guide/`) AND Chinese (`docs/zh/guide/`) versions exist with identical structure
- [ ] **Import paths** — `from relax.xxx import YYY` must match actual `__init__.py` exports
- [ ] **Class names** — must match actual class definitions
- [ ] **Function signatures** — parameter names, types, and defaults must match source
- [ ] **CLI arguments** — `--flag-name` must exist in the argument parser
- [ ] **Config keys** — YAML config keys must match what the code actually reads
- [ ] **Default values** — stated defaults must match source code defaults
- [ ] **Architecture claims** — "uses Ray Serve", "deployed as actor" etc. must be true
- [ ] **Feature claims** — don't say "supports X" if X is not implemented
- [ ] **Repository paths** — every file or directory path mentioned in the doc (e.g., `relax/utils/metrics/client.py`, `configs/env.yaml`, `scripts/training/basic/run-qwen3-4B-8xgpu.sh`) must actually exist in the repo. Run `ls` or `read_file` to confirm before including any path. This includes paths in prose text, code block comments, tables, and architecture diagrams

If you cannot verify something (e.g., the code is ambiguous or the feature is partially implemented), explicitly mark it in the doc with a `::: warning` block.

______________________________________________________________________

## Project Structure Reference

```
docs/
├── .vitepress/
│   └── config.mts              # Sidebar & nav config (MUST update for new pages)
├── en/guide/                   # English guides
├── zh/guide/                   # Chinese guides (mirror of en/guide/)
├── en/api/                     # English API docs
├── zh/api/                     # Chinese API docs
├── en/examples/                # English example docs
├── zh/examples/                # Chinese example docs
└── index.md / en/index.md / zh/index.md  # Home pages
```

Source code locations for verification:
```
relax/                          # Core framework
├── core/                       # Controller & service base classes
├── components/                 # Ray Serve deployments (actor, critic, rollout, genrm)
├── engine/                     # Rollout, rewards, filters, router
├── backends/                   # Megatron, SGLang, FSDP backends
├── distributed/                # Ray actor utilities, checkpoint service
├── entrypoints/                # Training entry scripts (train.py)
└── utils/                      # Utilities (arguments, metrics, logging, etc.)

transfer_queue/                 # Data transfer queue system
examples/                       # User-level examples (deepeyes, OPD, etc.)
scripts/                        # Launch scripts
configs/                        # Runtime env config (env.yaml)
```

## Section Header Translation Reference

| English | Chinese |
|---|---|
| Overview | 概述 |
| Architecture | 架构 |
| Features | 功能特性 |
| Quick Start | 快速开始 |
| Configuration | 配置 |
| API Reference | API 参考 |
| Usage / Usage Examples | 使用方法 / 使用示例 |
| Best Practices | 最佳实践 |
| Troubleshooting | 故障排除 |
| Next Steps | 下一步 |
| Installation | 安装 |
| Components | 组件 |
| Monitoring | 监控 |
| Examples | 示例 |
| Design Goals | 设计目标 |
| State Management | 状态管理 |
| Recovery Strategies | 恢复策略 |

## References

- `references/doc-template.md` — Standard doc page template (English + Chinese)
- `references/content-verification-guide.md` — Detailed guide on verifying doc content against source code
