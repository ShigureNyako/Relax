# 使用 REINFORCE++ 训练

REINFORCE++ 不训练 Critic 模型。Relax 提供两个变体。两者都使用带裁剪的策略损失，并在同步训练批次的有效回答 token 上归一化优势值（advantage）。优势值告诉策略应强化哪些生成 token。

## 选择变体

| 变体 | 训练信号 | 参考策略惩罚 | 适用场景 |
|---|---|---|---|
| `reinforce_plus_plus` | 最终奖励加上累积的 token 惩罚 | 在奖励中加入 k1 KL 惩罚 | 希望 token 级参考策略惩罚影响回报值（return）时使用。 |
| `reinforce_plus_plus_baseline` | 每个奖励减去同一提示词的平均奖励 | 独立的 k2 KL 损失 | 希望比较同一提示词的多个回答，并让参考策略惩罚不进入优势值时使用。 |

baseline 的均值包含当前回答，不是排除当前回答的均值。与 GRPO 默认的奖励处理不同，该变体不除以组内标准差。其他选择请参见[算法参考](../examples/algorithms.md)。

两种变体都不保证比 GRPO 获得更高奖励。请在你的模型和数据上评估效果。

::: warning 支持的训练模式
使用 Megatron 后端和同步 colocate 训练（`--colocate`），让训练和生成共享 GPU。设置 `--context-parallel-size 1`。不要启用 `--fully-async`、`--hybrid` 或 `--calculate-per-token-loss`。参数校验会拒绝这些组合。
:::

## 运行单 GPU 示例

[Qwen3-0.6B 示例脚本](../../../examples/algorithms/run-qwen3-0.6B-1xgpu-reinforce-plus-plus.sh)已设置模型、资源和算法参数。请从仓库根目录运行。

### 1. 准备环境和输入

先完成[安装](./installation.md)。示例需要 CUDA GPU，以及 Megatron、Megatron Bridge、SGLang 和 Ray 依赖。请选择支持你的 GPU 的镜像。单 GPU 是脚本的资源设置，不代表任意显存容量都能运行。

准备以下本地输入。脚本不会下载模型，也不会处理数据集标签：

- Hugging Face 格式的 Qwen3-0.6B checkpoint，包含 tokenizer。脚本也将该 checkpoint 用作参考策略。
- 包含 `question` 和 `answer` 列的训练 Parquet 文件。`question` 是提示词。`answer` 是 `math` 奖励函数所需的最终答案，不是完整解题过程。例如，保存 `42`，而不是 `reasoning ... #### 42`。
- 可写的输出目录。新训练使用新目录。脚本用其 `actor` 子目录加载和保存 checkpoint。

将下面的路径替换为你的路径。确保 Ray worker 能访问模型、数据和输出文件。如果使用容器，请将输出目录挂载到持久存储。

```bash
export MODEL_PATH=/path/to/Qwen3-0.6B
export PROMPT_DATA=/path/to/gsm8k/main/train_clean.parquet
export OUTPUT_DIR=/path/to/runs/reinforce-plus-plus
```

### 2. 启动专用 Ray 运行环境

::: danger 使用专用环境
启动脚本会清理之前的训练 worker、作业、Ray Serve 应用和 placement group。直接运行示例时，本地启动流程还可能停止 Ray 并终止 Python 进程。不要在有其他工作负载的共享主机或集群上运行这些脚本。
:::

在专用训练容器内启动单节点 Ray，分配一张可见 GPU：

```bash
ray start --head --num-gpus=1 --dashboard-host=127.0.0.1 --dashboard-port=8265
```

如果启动器已准备好专用 Ray 环境，跳过此命令。下一步假设 Jobs API 地址是 `http://127.0.0.1:8265`。地址不同时，将 `RAY_ADDRESS` 设置为你的 Jobs API 地址。

### 3. 提交训练

用 [Ray 作业启动脚本](../../../scripts/entrypoint/ray-job.sh)设置 worker 环境并提交示例：

```bash
ADVANTAGE_ESTIMATOR=reinforce_plus_plus \
bash scripts/entrypoint/ray-job.sh \
  examples/algorithms/run-qwen3-0.6B-1xgpu-reinforce-plus-plus.sh
```

运行 baseline 变体时，使用另一个输出目录：

```bash
OUTPUT_DIR=/path/to/runs/reinforce-plus-plus-baseline \
ADVANTAGE_ESTIMATOR=reinforce_plus_plus_baseline \
bash scripts/entrypoint/ray-job.sh \
  examples/algorithms/run-qwen3-0.6B-1xgpu-reinforce-plus-plus.sh
```

脚本提交 `python3 -m relax.entrypoints.train`。它选择同步 colocate 模式，让 Actor 和 Rollout 使用一张 GPU，并将上下文并行度设为 1。脚本启用指标服务，将提交日志写入 `OUTPUT_DIR/logs`。

## 调整示例设置

在运行命令前设置环境变量。下表默认值来自示例脚本，不是命令行参数解析器的默认值。

| 环境变量 | 示例默认值 | 用途 |
|---|---|---|
| `ADVANTAGE_ESTIMATOR` | `reinforce_plus_plus` | 选择 `reinforce_plus_plus`、`reinforce_plus_plus_baseline` 或 `grpo`。 |
| `NUM_ROLLOUT` | `50` | 设置 rollout 迭代次数。 |
| `ROLLOUT_BATCH_SIZE` | `4` | 设置每次 rollout 的提示词数。 |
| `N_SAMPLES_PER_PROMPT` | `8` | 设置每个提示词的回答数。baseline 要求大于 1。 |
| `GLOBAL_BATCH_SIZE` | `32` | 设置每个训练批次的回答数。默认将 `4 × 8` 个回答放入一个批次。 |
| `ROLLOUT_MAX_RESPONSE_LEN` | `1024` | 设置训练和可选评测的回答 token 上限。 |
| `MAX_TOKENS_PER_GPU` | `4096` | 设置每张 GPU 的动态训练 token 预算。 |
| `LOG_PROBS_MAX_TOKENS_PER_GPU` | `4096` | 设置每张 GPU 计算 log probability 的前向 token 预算。 |
| `SGLANG_MEM_FRACTION_STATIC` | `0.45` | 设置 SGLang 的静态显存比例。 |
| `LR` | `1e-6` | 设置学习率。 |
| `SEED` | `42` | 设置随机种子。不保证生成结果完全一致。 |
| `KL_COEF` | `0.01` | 设置 REINFORCE++ 的奖励惩罚系数，必须为正。baseline 忽略此变量，使用 `--kl-coef 0`。 |
| `KL_LOSS_COEF` | `0.01` | 设置 baseline 的独立 KL 损失系数，必须为正。REINFORCE++ 不使用此变量。 |
| `REWARD_NUM_WORKERS` / `REWARD_MAX_CONCURRENCY` | `4` / `16` | 设置奖励 worker 数和请求并发数。按可用 CPU 资源调整。 |
| `USE_HEALTH_CHECK` | `1` | 启用健康检查。可用值为 `1`、`0`、`true`、`false`。 |
| `SAVE_INTERVAL` | `50` | 设置 checkpoint 保存间隔，单位是 rollout 迭代。 |

修改提示词数或回答数时，保持 `GLOBAL_BATCH_SIZE = ROLLOUT_BATCH_SIZE × N_SAMPLES_PER_PROMPT`，即可沿用本示例每次 rollout 对应一个训练批次的设置。其他批次设置须保留完整提示词组，并满足训练小批次校验。

默认不评测。将 `EVAL_DATA` 设置为评测 Parquet 文件后才启用评测。该文件须使用相同列名和最终答案标签。启用后，`EVAL_INTERVAL` 默认为 `10`，`N_SAMPLES_PER_EVAL_PROMPT` 默认为 `4`。脚本跳过训练前评测。

## 在自己的训练脚本中使用

保留你的模型、数据集、资源和启动参数。选择下面**一组**算法参数。两组都需要 `--colocate --context-parallel-size 1`，并通过 `--ref-load` 指定参考 checkpoint。

### REINFORCE++ 参数

```text
--advantage-estimator reinforce_plus_plus
--normalize-advantages
--gamma 1.0
--kl-coef 0.01
--kl-loss-type k1
--kl-loss-coef 0
```

不要添加 `--use-kl-loss`。参数校验要求 `--kl-coef` 为正、使用 k1，且不启用独立 KL 损失。

### REINFORCE++-baseline 参数

```text
--advantage-estimator reinforce_plus_plus_baseline
--normalize-advantages
--n-samples-per-prompt 8
--kl-coef 0
--use-kl-loss
--kl-loss-type k2
--kl-loss-coef 0.01
```

保留每个提示词的完整回答组。baseline 不允许使用 `--disable-rewards-normalization`、`--custom-reward-post-process-path`、`--agentic-custom-advantage-path` 或 `--use-unbiased-kl`。参数校验会拒绝这些选项。

解析器默认使用 `--advantage-estimator grpo`，关闭优势值归一化，每个提示词生成 1 个回答，`--gamma 1.0`，`--kl-coef 0`，`--kl-loss-type k1`，`--kl-loss-coef 0`，关闭独立 KL 损失。只选择 estimator 不会自动补齐所需设置。完整参数列表请参见[配置说明](./configuration.md)。

## 理解训练信号

REINFORCE++ 为每个有效回答 token 添加惩罚：`-kl_coef × (log_prob_old - log_prob_ref)`。Relax 将最终奖励加到最后一个有效回答 token，然后从后向前累积奖励，得到回报值。示例使用 `gamma=1.0`，不对后续奖励打折。

baseline 从每个回答的奖励中减去同一提示词的平均奖励，再将该值复制到有效回答 token。KL 不进入此优势值。独立 k2 损失使用 `0.5 × (log_prob_current - log_prob_ref)²`。

两个变体都在跨数据并行 rank 的有效回答 token 上归一化原始优势值。Relax 先减去全局 token 均值，再除以 `sqrt(max(population_variance, 1e-8))`。提示词 token、padding 和被 mask 的回答 token 不参与统计。较长回答包含更多 token，因此在归一化统计中的权重更大。

原始优势值全部相同时，归一化结果为零。全局批次没有有效 token 时会报错。策略损失和 baseline 的 KL 损失先在每个回答内求均值，再跨回答求均值。因此不能启用 `--calculate-per-token-loss`。

## 监控与排障

除非设置 `TENSORBOARD_DIR`，示例的 TensorBoard event 写入 `OUTPUT_DIR/actor/tensorboard_log`。提交日志写入 `OUTPUT_DIR/logs`。

| 症状或指标 | 检查或操作 |
|---|---|
| 启动时配置被拒绝 | 检查上文的模式和变体参数。不要同时使用奖励中的 KL 惩罚和独立 KL 损失。 |
| baseline 报告奖励组不完整 | 检查每个提示词是否保留恰好 `N_SAMPLES_PER_PROMPT` 个回答，且使用相同的组标识。不要在组内奖励处理前丢弃单个回答。 |
| baseline 优势值为零 | 检查每组的原始奖励。奖励相同时，没有相对训练信号。先检查标签和奖励计算，不要直接修改归一化。 |
| 奖励始终为零 | 检查生成回答是否包含 `\boxed{...}` 格式的最终答案。`math` 奖励函数无法提取答案时返回零。标签使用最终答案，不要使用 GSM8K 的完整解题过程。 |
| Ray actor 一直等待调度 | 用 `ray status` 检查可用 GPU 和 CPU 资源。示例需要一张可见 GPU，以及足够运行服务和奖励 worker 的 CPU 资源。 |
| GPU 显存不足 | 降低训练或 log probability 计算的 token 预算。如果原因是推理侧分配，调整 SGLang 显存比例。参见 [OOM 排查](./oom-troubleshooting.md)。 |
| 回答经常达到 token 上限 | 检查 `rollout/response_len/mean` 和 `rollout/truncated_ratio`。只有显存预算允许时，才增大 `ROLLOUT_MAX_RESPONSE_LEN`。 |
| `train/ppo_kl` 为零 | 此指标比较旧策略与当前策略，不衡量参考策略惩罚。 |
| 检查 REINFORCE++ 的参考策略惩罚 | 比较同一步的 `rollout/returns` 和 `rollout/raw_reward` 汇总。k1 惩罚已进入回报值，没有独立的 `train/kl_loss`。 |
| 检查 baseline 的参考策略惩罚 | 查看 `train/kl_loss`。Relax 将该 k2 惩罚乘以 `--kl-loss-coef` 后加入总损失。 |

`rollout/reinforce_pp_advantage_raw_std`、`rollout/reinforce_pp_advantage_normalized_std`、`rollout/reinforce_pp_valid_token_count` 和 `rollout/reinforce_pp_zero_variance` 可帮助排查归一化统计。不要用单个损失或 KL 值判断模型质量，还应查看评测奖励。

## 下一步

- [数据集设计](./dataset-design.md)：准备提示词和标签。
- [自定义训练](./customize-training.md)：调整训练脚本。
- [Metrics 服务](./metrics-service-detailed.md)：配置指标输出。
