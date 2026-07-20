# RL Training Architecture — TF.js Implementation

## Overview

Sentinel uses a **CuriousAgent** powered by an Intrinsic Curiosity Module (ICM) and a Deep Q-Network (DQN). The entire RL pipeline runs in-browser using TensorFlow.js for GPU-accelerated training.

## Components

### 1. TFQNetwork (`src/lib/tf-rl-core.ts`)

The main DQN that selects actions and learns from experience.

```
Architecture: state_dim → 64 (ReLU) → 64 (ReLU) → n_actions (linear)
Optimizer:    Adam (lr=0.001)
Loss:         Mean Squared Error
```

- **Online network** — used for action selection and training
- **Target network** — used for computing stable target Q-values during training, synced periodically via `syncTarget()`
- **train_step()** — Builds a target Q-matrix (predicted Q-values with the taken action's Q replaced by the TD target), then calls `model.fit()` for one epoch

### 2. TFEncoder (`src/lib/tf-rl-core.ts`)

Maps raw state vectors into a 32-dimensional feature encoding.

```
Architecture: state_dim → 32 (ReLU)
Optimizer:    Adam (lr=0.001)
Loss:         Mean Squared Error
```

The encoder learns to produce representations that are useful for both the inverse model (predicting actions) and the forward model (predicting next states). This is the "feature network" of the ICM.

### 3. TFInverseModel (`src/lib/tf-rl-core.ts`)

Predicts which action was taken, given the current and next state encodings. Trains the encoder to be *informative*.

```
Input:  [enc_s (32), enc_s_next (32)] = 64-dim
Hidden: 64 (ReLU)
Output: n_actions (softmax)
Loss:    Categorical Crossentropy
```

### 4. TFForwardModel (`src/lib/tf-rl-core.ts`)

Predicts the next state encoding given the current encoding and action. The **prediction error** is the intrinsic curiosity reward — the agent is rewarded for visiting states it can't predict well.

```
Input:  [enc_s (32), action_onehot (n_actions)]
Hidden: 64 (ReLU)
Output: 32 (linear)
Loss:    Mean Squared Error
```

### 5. CuriousAgent (`src/lib/rl-agent.ts`)

The main agent class that ties everything together.

## Training Loop

The `train()` method runs the following steps when the replay buffer has ≥64 experiences:

```
1. Sample 32 experiences from the replay buffer
2. Encode states → enc_s, enc_s_next (via TFEncoder)
3. Train inverse model: (enc_s, enc_s_next) → action  [categorical crossentropy]
4. Train forward model: (enc_s, action) → enc_s_next   [MSE]
   → prediction error = intrinsic curiosity reward
5. Train encoder to minimize forward prediction error
6. Compute target Q-values:
   target = reward + intrinsic_reward + γ * max(Q_target(next_state))
7. Train DQN: model.fit(states, target_q)  [MSE with Adam]
8. Decay ε (exploration rate): ε = max(0.1, ε * 0.995)
```

## State Space

The state vector has 4 dimensions:
- `state[0]` — message count (normalized)
- `state[1]` — memory count (normalized)
- `state[2]` — cognition depth (0=Fast, 1=Balanced, 2=Deep)
- `state[3]` — user activity/idle indicator

## Action Space

7 discrete actions:

| Action | ID | Description |
|--------|-----|-------------|
| IDLE | 0 | No operation (wait) |
| CHANGE_DEPTH | 1 | Switch cognition depth |
| CONSOLIDATE | 2 | Trigger memory consolidation |
| NUDGE | 3 | Proactive memory nudge |
| CONSOLIDATE_CHATS | 4 | Consolidate chat history |
| INSIGHT | 5 | Generate insight from memories |
| HYBRID_SYNC_RAG | 6 | Sync with RAG system |

## Hierarchical RL (Options)

The agent also supports **options** (macro-actions) via the HRL framework:

- **IdleExplorerOption** — Activates when user is idle, takes nudge/insight actions
- **DeepConsolidatorOption** — Activates when memory count is high, consolidates
- **HybridSyncRAGOption** — Syncs with the RAG system
- **SystemSelfRepairOption** — Runs diagnostics when system load is high

Each option has its own `TFQNetwork` policy that learns independently.

## Reward Structure

Rewards come from user interactions:

| Signal | Reward |
|--------|--------|
| User accepts nudge | +1.0 |
| User ignores nudge | -0.1 |
| User rejects nudge | -0.5 |
| Successful consolidation | +1.5 |
| Failed consolidation | -1.0 |
| Insight generated | +0.2 |
| Hybrid sync | +0.5 |

Plus the **intrinsic curiosity reward** from the forward model's prediction error.

## Weight Persistence

Weights are saved to Firestore in the `tfjs-v2` format:
- Each model's weights are serialized via `model.getWeights()` → `arraySync()`
- On load, weights are deserialized via `tf.tensor()` → `model.setWeights()`
- Legacy format (hand-rolled weight arrays) is detected and gracefully skipped

## Q-Value Convergence Chart

The Policy Convergence Chart on the Heartbeat tab shows **real Q-values** from the DQN:
- `agent.getMeanQValue()` returns the mean Q-value across all actions for a zero state
- Updated every 5 seconds and logged to the telemetry system
- As the agent trains, Q-values should stabilize — indicating policy convergence

## Migration from Hand-Rolled to TF.js

The original implementation in `rl-core.ts` used:
- Manual matrix multiplication (`matmul`)
- Manual backpropagation through Dense layers
- Manual ReLU and gradient computation
- SGD without momentum

The TF.js implementation in `tf-rl-core.ts` provides:
- GPU acceleration via WebGL backend
- Adam optimizer with adaptive learning rates
- Automatic gradient computation
- Proper weight initialization (Glorot uniform)

The old `rl-core.ts` is preserved for reference but no longer imported by the agent.
