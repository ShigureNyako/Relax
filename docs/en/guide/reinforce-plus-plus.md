# Train with REINFORCE++

REINFORCE++ trains a policy without a Critic model. Relax provides two variants. Both use a clipped policy loss and normalize advantages across valid response tokens in the synchronous training batch. An advantage is the signal that tells the policy which generated tokens to reinforce.

## Choose a variant

| Variant | Training signal | Reference-policy penalty | When to use it |
|---|---|---|---|
| `reinforce_plus_plus` | The final reward plus accumulated token penalties | k1 KL penalty inside the reward | Use it when you want token-level reference penalties to affect the return. |
| `reinforce_plus_plus_baseline` | Each reward minus the mean reward for the same prompt | Separate k2 KL loss | Use it when you want to compare responses to the same prompt and keep the reference penalty out of the advantage. |

The baseline mean includes the current response. It is not a leave-one-out mean. Unlike GRPO's default reward processing, this variant does not divide by the group standard deviation. See [Algorithms](../examples/algorithms.md) to compare other choices.

Neither variant guarantees better rewards than GRPO. Evaluate the choice on your model and data.

::: warning Supported training mode
Use the Megatron backend with synchronous colocate training (`--colocate`), where training and generation share GPUs. Set `--context-parallel-size 1`. Do not enable `--fully-async`, `--hybrid`, or `--calculate-per-token-loss`. The argument validator rejects these combinations.
:::

## Run the one-GPU example

The [Qwen3-0.6B recipe](../../../examples/algorithms/run-qwen3-0.6B-1xgpu-reinforce-plus-plus.sh) sets the model, resource, and algorithm arguments. Run it from the repository root.

### 1. Prepare the environment and inputs

Complete [Installation](./installation.md). The example requires a CUDA GPU and the Megatron, Megatron Bridge, SGLang, and Ray dependencies. Choose an image that supports your GPU. One GPU is the recipe's resource setting, not a memory-capacity guarantee.

Prepare these local inputs. The recipe does not download the model or prepare dataset labels:

- A Hugging Face Qwen3-0.6B checkpoint, including its tokenizer. The recipe also uses this checkpoint as the reference policy.
- A training Parquet file with `question` and `answer` columns. `question` contains the prompt. `answer` contains the final answer expected by the `math` reward, not the full solution rationale. For example, store `42`, not `reasoning ... #### 42`.
- A writable output directory. Use a new directory for a new run. The recipe uses its `actor` subdirectory for both checkpoint loading and saving.

Replace the paths below with your paths. Keep model, data, and output files visible to the Ray workers. If you use a container, mount the output directory on persistent storage.

```bash
export MODEL_PATH=/path/to/Qwen3-0.6B
export PROMPT_DATA=/path/to/gsm8k/main/train_clean.parquet
export OUTPUT_DIR=/path/to/runs/reinforce-plus-plus
```

### 2. Start a dedicated Ray runtime

::: danger Use a dedicated environment
The launch helpers clean up previous training workers, jobs, Ray Serve applications, and placement groups. The recipe's direct local launch can also stop Ray and kill Python processes. Do not run these helpers on a shared host or cluster that has other workloads.
:::

Expose only the GPU assigned to this run in a dedicated training container. `--num-gpus=1` declares Ray capacity; it does not hide other GPUs. Start a single-node Ray runtime:

```bash
ray start --head --num-gpus=1 --dashboard-host=127.0.0.1 --dashboard-port=8265
```

If your launcher has already started a dedicated Ray runtime, skip this command. The following command assumes that its Jobs API is reachable at `http://127.0.0.1:8265`. Set `RAY_ADDRESS` to your Jobs API address if it differs.

### 3. Submit training

Use the [Ray job helper](../../../scripts/entrypoint/ray-job.sh) to set the worker environment and submit the recipe:

```bash
ADVANTAGE_ESTIMATOR=reinforce_plus_plus \
bash scripts/entrypoint/ray-job.sh \
  examples/algorithms/run-qwen3-0.6B-1xgpu-reinforce-plus-plus.sh
```

To run the baseline variant, use a separate output directory:

```bash
OUTPUT_DIR=/path/to/runs/reinforce-plus-plus-baseline \
ADVANTAGE_ESTIMATOR=reinforce_plus_plus_baseline \
bash scripts/entrypoint/ray-job.sh \
  examples/algorithms/run-qwen3-0.6B-1xgpu-reinforce-plus-plus.sh
```

The recipe submits `python3 -m relax.entrypoints.train`. It selects synchronous colocate mode, uses one GPU for the Actor and Rollout, and sets context parallelism to 1. It enables the metrics service and writes the submission log under `OUTPUT_DIR/logs`.

## Change the recipe settings

Set environment variables before the recipe command. These defaults belong to the example script. They are not the command-line parser defaults.

| Environment variable | Recipe default | Action |
|---|---|---|
| `ADVANTAGE_ESTIMATOR` | `reinforce_plus_plus` | Select `reinforce_plus_plus`, `reinforce_plus_plus_baseline`, or `grpo`. |
| `NUM_ROLLOUT` | `50` | Set the number of rollout iterations. |
| `ROLLOUT_BATCH_SIZE` | `4` | Set the number of prompts per rollout. |
| `N_SAMPLES_PER_PROMPT` | `8` | Set responses per prompt. The baseline requires more than 1. |
| `GLOBAL_BATCH_SIZE` | `32` | Set responses per training batch. The default uses all `4 × 8` responses in one batch. |
| `ROLLOUT_MAX_RESPONSE_LEN` | `1024` | Set the response-token limit for training and optional evaluation. |
| `MAX_TOKENS_PER_GPU` | `4096` | Set the dynamic training token budget per GPU. |
| `LOG_PROBS_MAX_TOKENS_PER_GPU` | `4096` | Set the log-probability forward-pass token budget per GPU. |
| `SGLANG_MEM_FRACTION_STATIC` | `0.45` | Set SGLang's static GPU-memory fraction. |
| `LR` | `1e-6` | Set the learning rate. |
| `SEED` | `42` | Set the random seed. It does not guarantee identical generations. |
| `KL_COEF` | `0.01` | Set the REINFORCE++ reward penalty. Must be positive. The baseline ignores this variable and sets `--kl-coef 0`. |
| `KL_LOSS_COEF` | `0.01` | Set the baseline's separate KL-loss coefficient. Must be positive. REINFORCE++ does not use this variable. |
| `REWARD_NUM_WORKERS` / `REWARD_MAX_CONCURRENCY` | `4` / `16` | Set reward-worker count and request concurrency. Match them to available CPU resources. |
| `USE_HEALTH_CHECK` | `1` | Enable health checks. Accepts `1`, `0`, `true`, or `false`. |
| `SAVE_INTERVAL` | `50` | Set checkpoint-save frequency in rollout iterations. |

When you change prompt or sample counts, keep `GLOBAL_BATCH_SIZE = ROLLOUT_BATCH_SIZE × N_SAMPLES_PER_PROMPT` to retain one training batch per rollout in this example. Other batch layouts must keep prompt groups complete and satisfy the training minibatch checks.

Evaluation is off unless you set `EVAL_DATA` to an evaluation Parquet file with the same columns and final-answer labels. When enabled, `EVAL_INTERVAL` defaults to `10` and `N_SAMPLES_PER_EVAL_PROMPT` defaults to `4`. The recipe skips evaluation before training.

## Use the variants in your own training script

Keep your model, dataset, resource, and launch arguments. Add **one** of the following sets of algorithm arguments. Both require `--colocate --context-parallel-size 1` and a reference checkpoint supplied by `--ref-load`.

### REINFORCE++ arguments

```text
--advantage-estimator reinforce_plus_plus
--normalize-advantages
--gamma 1.0
--kl-coef 0.01
--kl-loss-type k1
--kl-loss-coef 0
```

Do not add `--use-kl-loss`. The validator requires a positive `--kl-coef`, k1, and no separate KL loss.

### REINFORCE++-baseline arguments

```text
--advantage-estimator reinforce_plus_plus_baseline
--normalize-advantages
--n-samples-per-prompt 8
--kl-coef 0
--use-kl-loss
--kl-loss-type k2
--kl-loss-coef 0.01
```

Keep complete response groups for each prompt. Do not use `--disable-rewards-normalization`, `--custom-reward-post-process-path`, `--agentic-custom-advantage-path`, or `--use-unbiased-kl` with the baseline. The validator rejects these options.

The parser defaults are `--advantage-estimator grpo`, normalization off, `--n-samples-per-prompt 1`, `--gamma 1.0`, `--kl-coef 0`, `--kl-loss-type k1`, `--kl-loss-coef 0`, and separate KL loss off. Selecting an estimator alone does not supply its required settings. See [Configuration](./configuration.md) for the full argument list.

## Understand the training signal

For REINFORCE++, each valid response token receives the penalty
`-kl_coef × (log_prob_old - log_prob_ref)`. Relax adds the final reward to the last valid response token. It then accumulates rewards backwards to form the return. The example uses `gamma=1.0`, so it does not discount later rewards.

For the baseline, Relax subtracts the same-prompt mean reward from each response reward. It copies this value to the valid response tokens. KL does not enter this advantage. The separate k2 loss uses `0.5 × (log_prob_current - log_prob_ref)²`.

Both variants normalize raw advantages over valid response tokens across data-parallel ranks. Relax subtracts the global token mean and divides by `sqrt(max(population_variance, 1e-8))`. Prompt tokens, padding, and masked response tokens do not enter these statistics. Longer responses have more weight in the normalization because they contain more tokens.

A constant raw advantage population becomes zero after normalization. An entirely masked global batch is an error. For the policy loss and the baseline's KL loss, Relax averages within each response and then across responses. This is why `--calculate-per-token-loss` is not supported.

## Monitor and troubleshoot

The recipe's TensorBoard events use `OUTPUT_DIR/actor/tensorboard_log` unless you override `TENSORBOARD_DIR`. Submission logs use `OUTPUT_DIR/logs`.

| Symptom or metric | What to check or do |
|---|---|
| Startup rejects the configuration | Check the mode and variant-specific arguments above. Do not combine reward-side KL and a separate KL loss. |
| Baseline reports an incomplete reward group | Check that each prompt retains exactly `N_SAMPLES_PER_PROMPT` responses with the same group identifier. Do not drop individual responses before group reward processing. |
| Baseline advantages are zero | Check the raw rewards within each prompt group. Equal rewards give no relative training signal. Check labels and reward calculation before changing normalization. |
| Reward is always zero | Check that the generated response contains a final answer in `\boxed{...}`. The `math` reward returns zero if it cannot extract the answer. Use final-answer labels, not full GSM8K solution rationales. |
| Ray actors stay pending | Use `ray status` to check available GPU and CPU resources. The recipe needs one visible GPU and CPU capacity for its services and reward workers. |
| GPU runs out of memory | Reduce the training or log-probability token budget. Adjust the SGLang memory fraction if inference allocation is the cause. See [OOM Troubleshooting](./oom-troubleshooting.md). |
| Responses often reach the token limit | Check `rollout/response_len/mean` and `rollout/truncated_ratio`. Increase `ROLLOUT_MAX_RESPONSE_LEN` only if your memory budget permits. |
| `train/ppo_kl` is zero | This metric compares the old and current policies. It does not measure reference-policy regularization. |
| Need to inspect REINFORCE++ regularization | Compare same-step `rollout/returns` and `rollout/raw_reward` summaries as a diagnostic, not a direct reference-KL estimate. The k1 penalty is included in returns, not a separate `train/kl_loss`. |
| Need to inspect baseline regularization | Read `train/kl_loss`. Relax adds this k2 penalty to total loss after multiplying by `--kl-loss-coef`. |

The `rollout/reinforce_pp_advantage_raw_std`, `rollout/reinforce_pp_advantage_normalized_std`, `rollout/reinforce_pp_valid_token_count`, and `rollout/reinforce_pp_zero_variance` metrics help diagnose the normalization population. Do not treat a single loss or KL value as a model-quality score. Use evaluation rewards as well.

## Next steps

- [Dataset Design](./dataset-design.md): prepare prompts and labels.
- [Customize Training](./customize-training.md): adapt the training script.
- [Metrics Service](./metrics-service-detailed.md): configure metric outputs.
