# Doc Page Template

Use this outline to plan a user task, not to fill every heading. Create English pages under `docs/en/` and Chinese pages under `docs/zh/`, with matching technical coverage.

Start with purpose and when to use the feature. Give prerequisites and the smallest runnable steps. Then cover required settings, verified defaults, limitations, troubleshooting, and relevant next steps. Architecture, feature lists, API details, advanced examples, and best practices are optional; include them only when they help users complete the task.

Write short sentences with a clear actor and action. Use consistent terms and numbered instructions in both languages. Aim for “80% of the way to ASD-STE100”; do not claim strict compliance. The placeholders below are not real Relax APIs or executable examples. Replace them with source-verified commands and configuration before publishing.

Do not add test counts, acceptance checklists, training reports, execution logs, or machine traces to the user page. Keep validation evidence in internal notes or the PR. A test result is not a general feature guarantee.

## English Template

```markdown
# Feature Name

Brief one-line description of the feature.

## Overview

Briefly explain what the feature does and when the user should use it. State the supported scope without promising results from past experiments.

## Architecture

(Optional — include when the feature has meaningful internal structure)

Use ASCII art diagrams:

\```
┌─────────────────┐         ┌─────────────────┐
│   Component A   │ ──────> │   Component B   │
└─────────────────┘         └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │   Component C   │
                            └─────────────────┘
\```

### Component Responsibilities

| Component | Responsibility | Implementation |
|---|---|---|
| **ComponentA** | What it does | How it's implemented |
| **ComponentB** | What it does | How it's implemented |

## Features (optional)

Include only capabilities that the user needs for this task.

1. **Feature A**: Description
2. **Feature B**: Description
3. **Feature C**: Description

## Quick Start

State the environment, input files, permissions, and resources needed before the first command. Warn about destructive launch behavior before users execute it.

### 1. Setup / Deploy

\```python
from relax.module import ClassName

# Minimal working example
instance = ClassName(required_param="value")
instance.start()
\```

### 2. Basic Usage

\```python
# Show the most common usage pattern
result = instance.do_something(input_data)
\```

## Configuration

\```yaml
feature_name:
  enabled: true
  param_a: "value"
  param_b: 100
\```

Or via CLI arguments:

\```bash
python train.py --param-a value --param-b 100
\```

## Limitations

State unsupported modes, required parameter combinations, and relevant resource constraints verified against the current code.

## API Reference (optional)

### ClassName

#### method_name

\```python
instance.method_name(
    param_a: str,
    param_b: int = 10,
    param_c: Optional[float] = None
) -> ReturnType
\```

Description of what the method does.

**Parameters:**
- `param_a` — description
- `param_b` — description (default: 10)
- `param_c` — description (default: None)

**Returns:** Description of return value.

## Usage Examples (optional)

### Example 1: Common Scenario

\```python
# Realistic example with context
\```

### Example 2: Advanced Scenario

\```python
# More complex usage
\```

## Best Practices (optional)

1. **Practice A**: Explanation
2. **Practice B**: Explanation
3. **Practice C**: Explanation

## Troubleshooting

### Problem A

Check:
1. First thing to verify
2. Second thing to verify
3. Third thing to verify

### Problem B

If symptom occurs:
- Cause and fix

## Next Steps

- [Related Feature A](./related-a.md) — Brief description
- [Related Feature B](./related-b.md) — Brief description
- [Configuration](./configuration.md) — How to configure this feature
```

## Chinese Template

The Chinese version mirrors the sections selected for the English page. Keep commands and configuration identical; translate explanations and comments. Apply the same short-sentence, clear-action rules.

```markdown
# 功能名称

功能的简短一行描述。

## 概述

简短说明功能做什么、何时使用。说明支持范围，不把历史实验结果写成效果保证。

## 架构

(可选 — 当功能有有意义的内部结构时包含)

\```
┌─────────────────┐         ┌─────────────────┐
│   Component A   │ ──────> │   Component B   │
└─────────────────┘         └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │   Component C   │
                            └─────────────────┘
\```

## 功能特性（可选）

只列出完成当前任务所需的能力。

1. **功能 A**：描述
2. **功能 B**：描述

## 快速开始

先说明所需环境、输入文件、权限和资源。执行命令前说明启动过程中的破坏性操作。

### 1. 部署 / 安装

\```python
from relax.module import ClassName

# 最小可运行示例
instance = ClassName(required_param="value")
instance.start()
\```

## 配置

(同英文版，代码块保持不变，注释翻译为中文)

## 限制

按当前源码说明不支持的模式、必需的参数组合和相关资源限制。

## API 参考（可选）

(同英文版，签名保持不变，描述翻译为中文)

## 使用示例（可选）

(同英文版，代码保持不变，注释和说明翻译为中文)

## 最佳实践（可选）

1. **实践 A**：说明
2. **实践 B**：说明

## 故障排除

### 问题 A

检查：
1. 第一个要验证的事项
2. 第二个要验证的事项

## 下一步

- [相关功能 A](./related-a.md) — 简短描述
- [相关功能 B](./related-b.md) — 简短描述
```

## Conventions

### Code Blocks

- Always specify language: ` ```python `, ` ```bash `, ` ```yaml `, ` ```typescript `
- Code must use **real** import paths and function signatures from the codebase
- Comments in English docs are in English; comments in Chinese docs are in Chinese

### VitePress Containers

```markdown
::: tip Tip Title
Helpful tip content
:::

::: warning Warning Title
Warning content
:::

::: danger Danger Title
Dangerous/critical content
:::
```

Chinese equivalents:
```markdown
::: tip 提示
提示内容
:::

::: warning 警告
警告内容
:::

::: danger 危险
危险/关键内容
:::
```

### Internal Links

- Use relative paths: `[Architecture](./architecture.md)`
- For cross-category links: `[API Overview](../api/overview.md)`
- Never use absolute URLs for internal docs

### Tables

Use standard Markdown tables with alignment:
```markdown
| Column A | Column B | Column C |
|---|---|---|
| value | value | value |
```

### ASCII Diagrams

Use box-drawing characters for architecture diagrams:
- Corners: `┌ ┐ └ ┘`
- Lines: `─ │`
- Arrows: `▼ ▲ ► ◄ ──>`
- Intersections: `┬ ┴ ├ ┤ ┼`
