# Doc Page Planning

This reference helps plan a page; it is not a form to fill in. Publish English pages under `docs/en/` and Chinese pages under `docs/zh/` with aligned technical coverage and commands.

## Start from a related guide

Read two or three pages close to the task. For algorithm documentation, useful starting points are `docs/en/guide/ppo-training.md` and `docs/en/examples/algorithms.md`, along with their Chinese counterparts. Notice how they introduce the algorithm, show a configuration, and explain the choices. Match the useful conventions, not every heading, warning, or implementation detail.

Before drafting, identify what the reader needs to understand or do. A training guide may explain the algorithm's purpose and differences, show a runnable example with its inputs, then explain the settings users are likely to change. A short feature may fit in an introduction and one usage section. Configuration, operation, limitations, and troubleshooting are content needs, not mandatory headings.

## Write explanations around examples

Give enough context to know what a command does and what inputs it expects. After the example, explain the important choices rather than paraphrasing every flag. Keep routine constraints next to the relevant settings. A destructive launch command needs a warning before execution; an ordinary unsupported mode usually needs a sentence, not another callout.

For example, the same batch setting can be explained naturally in either language:

**English:**

> The recipe generates 8 responses for each of 4 prompts, giving 32 responses per rollout. Keep the global batch size at 32 to train on that rollout in one batch.

**Chinese:**

> 示例每次采样 4 个提示词，每个生成 8 个回答，共 32 个回答。将全局批量设为 32，即可用一个训练批次处理这次采样。

These numbers describe the REINFORCE++ recipe, not universal framework defaults. Check the current source before using them elsewhere.

## Keep prose natural

Prefer concise sentences, clear actions, and consistent terminology. Aim for “80% of the way to ASD-STE100” as a clarity goal, not a rule that every sentence must be short, imperative, or isolated. Combine related ideas when it helps the reader follow the explanation.

Use numbered steps for a sequence, a table for comparable settings, and paragraphs for reasoning. Avoid building the whole page from lists. Do not repeat generic cautions, internal validation language, or definitions that add no useful context.

Read English and Chinese independently. Translate meaning, not syntax. Keep commands, variable names, defaults, and limitations aligned; code comments may be localized. Neither version should sound like a literal rendering of the other.

## Markdown conventions

- Use one H1 matching the topic, followed by headings chosen for the task. Architecture, API reference, best practices, and next steps are optional.
- Specify the language of each code block. Use real commands, imports, and signatures verified against source, not fictional placeholder APIs.
- Use relative links such as `[Configuration](./configuration.md)` and `[Algorithms](../examples/algorithms.md)`.
- Use standard Markdown tables when they make comparison easier.
- Use VitePress containers sparingly: `::: tip` for a useful shortcut, `::: warning` for a consequential risk, and `::: danger` for critical hazards.
- Use box-drawing characters for diagrams when needed. Keep diagram labels in English in both versions.

## Keep verification separate

Do not add test counts, acceptance checklists, training reports, execution logs, machine traces, or verification history to the user page. Record build, link, render, and test evidence in internal notes or the PR. A successful test or experiment is not a general feature guarantee.
