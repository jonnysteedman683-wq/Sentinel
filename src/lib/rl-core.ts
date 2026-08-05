export function zeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0.0));
}

export function randn(rows: number, cols: number): number[][] {
  const gaussian = () => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };
  return Array.from({ length: rows }, () => 
    Array.from({ length: cols }, gaussian)
  );
}

export function matmul(A: number[][], B: number[][]): number[][] {
  if (!A || !A.length) return [];
  if (!B || !B.length) return [];
  const m = A.length;
  const n = A[0] ? A[0].length : 0;
  const p = B[0] ? B[0].length : 0;
  if (n === 0 || p === 0) return [];
  const C = zeros(m, p);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < p; j++) {
        C[i][j] += (A[i][k] || 0) * (B[k][j] || 0);
      }
    }
  }
  return C;
}

export function add(A: number[][], B: number[][]): number[][] {
  if (!A || !A.length) return [];
  const rows = A.length, cols = A[0] ? A[0].length : 0;
  const C = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = (A[i][j] || 0) + (B[i]?.[j] || 0);
    }
  }
  return C;
}

export function sub(A: number[][], B: number[][]): number[][] {
  if (!A || !A.length) return [];
  const rows = A.length, cols = A[0] ? A[0].length : 0;
  const C = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = (A[i][j] || 0) - (B[i]?.[j] || 0);
    }
  }
  return C;
}

export function mul_scalar(A: number[][], s: number): number[][] {
  if (!A || !A.length) return [];
  const rows = A.length, cols = A[0] ? A[0].length : 0;
  const C = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = (A[i][j] || 0) * s;
    }
  }
  return C;
}

export function transpose(A: number[][]): number[][] {
  if (!A || !A.length) return [];
  const rows = A.length, cols = A[0] ? A[0].length : 0;
  const C = zeros(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (C[j]) C[j][i] = A[i][j] || 0;
    }
  }
  return C;
}

export function hadamard(A: number[][], B: number[][]): number[][] {
  if (!A || !A.length) return [];
  const rows = A.length, cols = A[0] ? A[0].length : 0;
  const C = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = (A[i][j] || 0) * (B[i]?.[j] || 0);
    }
  }
  return C;
}

export function mean_along_axis1(A: number[][]): number[][] {
  if (!A || !A.length) return [];
  const m = A.length, n = A[0] ? A[0].length : 0;
  if (n === 0) return zeros(m, 1);
  const res = zeros(m, 1);
  for (let i = 0; i < m; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) {
      s += (A[i][j] || 0);
    }
    res[i][0] = s / n;
  }
  return res;
}

export function sum_along_axis0(A: number[][]): number[][] {
  if (!A || !A.length) return [];
  const rows = A.length, cols = A[0] ? A[0].length : 0;
  const res = Array(cols).fill(0.0);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      res[j] += (A[i][j] || 0);
    }
  }
  return [res];
}

export function relu(x: number[][]): { out: number[][], mask: number[][] } {
  const m = x.length, n = x[0].length;
  const out = zeros(m, n);
  const mask = zeros(m, n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (x[i][j] > 0) {
        out[i][j] = x[i][j];
        mask[i][j] = 1.0;
      }
    }
  }
  return { out, mask };
}

export class Dense {
  lr: number;
  W: number[][];
  b: number[][];
  in_dim: number;
  out_dim: number;
  x: number[][] = [];

  constructor(in_dim: number, out_dim: number, lr: number = 0.001) {
    this.lr = lr;
    this.W = randn(in_dim, out_dim);
    this.b = [Array(out_dim).fill(0.0)];
    this.in_dim = in_dim;
    this.out_dim = out_dim;
  }

  forward(x: number[][]): number[][] {
    this.x = x;
    const y = matmul(x, this.W);
    const out = zeros(y.length, this.out_dim);
    for (let i = 0; i < y.length; i++) {
      for (let j = 0; j < this.out_dim; j++) {
        out[i][j] = y[i][j] + (this.b[0][j] || 0);
      }
    }
    return out;
  }

  backward(grad_y: number[][]): number[][] {
    const grad_W = matmul(transpose(this.x), grad_y);
    const grad_b = sum_along_axis0(grad_y);
    const grad_x = matmul(grad_y, transpose(this.W));

    for (let i = 0; i < this.in_dim; i++) {
      for (let j = 0; j < this.out_dim; j++) {
        this.W[i][j] -= this.lr * (grad_W[i][j] || 0);
      }
    }
    for (let j = 0; j < this.out_dim; j++) {
      this.b[0][j] -= this.lr * (grad_b[0][j] || 0);
    }
    return grad_x;
  }
}

export class Encoder {
  dense: Dense;
  enc_dim: number;
  s: number[][] = [];
  z: number[][] = [];
  mask: number[][] = [];

  constructor(input_dim: number, enc_dim: number, lr: number = 0.001) {
    this.dense = new Dense(input_dim, enc_dim, lr);
    this.enc_dim = enc_dim;
  }

  forward(s: number[][]): number[][] {
    this.s = s;
    const z = this.dense.forward(s);
    const reluRes = relu(z);
    this.z = reluRes.out;
    this.mask = reluRes.mask;
    return this.z;
  }

  backward(grad_enc: number[][]): number[][] {
    const grad_z = hadamard(grad_enc, this.mask);
    return this.dense.backward(grad_z);
  }
}

export class InverseModel {
  fc1: Dense;
  fc2: Dense;
  n_actions: number;
  input: number[][] = [];
  h: number[][] = [];
  h_mask: number[][] = [];

  constructor(enc_dim: number, n_actions: number, lr: number = 0.001) {
    this.fc1 = new Dense(2 * enc_dim, 64, lr);
    this.fc2 = new Dense(64, n_actions, lr);
    this.n_actions = n_actions;
  }

  forward(enc_s: number[][], enc_s_next: number[][]): number[][] {
    if (!enc_s || !enc_s.length || !enc_s_next || !enc_s_next.length) return [];
    const batch = enc_s.length;
    const concat = zeros(batch, (enc_s[0] ? enc_s[0].length : 0) + (enc_s_next[0] ? enc_s_next[0].length : 0));
    for (let i = 0; i < batch; i++) {
      concat[i] = [...(enc_s[i] || []), ...(enc_s_next[i] || [])];
    }
    this.input = concat;
    const h_raw = this.fc1.forward(concat);
    const reluRes = relu(h_raw);
    this.h = reluRes.out;
    this.h_mask = reluRes.mask;
    return this.fc2.forward(this.h);
  }

  backward(grad_logits: number[][]): { grad_enc_s: number[][], grad_enc_s_next: number[][] } {
    let grad_h = this.fc2.backward(grad_logits);
    grad_h = hadamard(grad_h, this.h_mask);
    const grad_concat = this.fc1.backward(grad_h);
    const enc_dim = grad_concat[0] ? Math.floor(grad_concat[0].length / 2) : 0;
    
    const grad_enc_s = grad_concat.map(row => row.slice(0, enc_dim));
    const grad_enc_s_next = grad_concat.map(row => row.slice(enc_dim));
    
    return { grad_enc_s, grad_enc_s_next };
  }
}

export class ForwardModel {
  fc1: Dense;
  fc2: Dense;
  input: number[][] = [];
  h: number[][] = [];
  h_mask: number[][] = [];

  constructor(enc_dim: number, n_actions: number, lr: number = 0.001) {
    this.fc1 = new Dense(enc_dim + n_actions, 64, lr);
    this.fc2 = new Dense(64, enc_dim, lr);
  }

  forward(enc_s: number[][], a_onehot: number[][]): number[][] {
    if (!enc_s || !enc_s.length || !a_onehot || !a_onehot.length) return [];
    const batch = enc_s.length;
    const concat = zeros(batch, (enc_s[0] ? enc_s[0].length : 0) + (a_onehot[0] ? a_onehot[0].length : 0));
    for (let i = 0; i < batch; i++) {
      concat[i] = [...(enc_s[i] || []), ...(a_onehot[i] || [])];
    }
    this.input = concat;
    const h_raw = this.fc1.forward(concat);
    const reluRes = relu(h_raw);
    this.h = reluRes.out;
    this.h_mask = reluRes.mask;
    return this.fc2.forward(this.h);
  }

  backward(grad_pred: number[][]): void {
    let grad_h = this.fc2.backward(grad_pred);
    grad_h = hadamard(grad_h, this.h_mask);
    this.fc1.backward(grad_h);
  }
}

export class QNetwork {
  fc1: Dense;
  fc2: Dense;
  out: Dense;
  n_actions: number;
  mask1: number[][] = [];
  mask2: number[][] = [];
  cqlAlpha: number = 0.1;

  constructor(state_dim: number, n_actions: number, lr: number = 0.001) {
    this.fc1 = new Dense(state_dim, 64, lr);
    this.fc2 = new Dense(64, 64, lr);
    this.out = new Dense(64, n_actions, lr);
    this.n_actions = n_actions;
  }

  forward(s: number[][]): number[][] {
    let h = this.fc1.forward(s);
    let reluRes = relu(h);
    h = reluRes.out;
    this.mask1 = reluRes.mask;
    
    h = this.fc2.forward(h);
    reluRes = relu(h);
    h = reluRes.out;
    this.mask2 = reluRes.mask;
    
    return this.out.forward(h);
  }

  train_step(s: number[][], actions: number[], target_q: number[], isOffline: boolean = false): number {
    const batch = s.length;
    const q = this.forward(s);
    const grad_q = zeros(batch, this.n_actions);
    
    let tdLoss = 0;
    for (let i = 0; i < batch; i++) {
      const a = actions[i];
      const diff = q[i][a] - target_q[i];
      grad_q[i][a] = diff / batch;
      tdLoss += (diff * diff) / (2 * batch);
    }
    
    let totalLoss = tdLoss;

    if (isOffline) {
      // CQL Penalty: logSumExp(q) - mean(q)
      for (let i = 0; i < batch; i++) {
        const row = q[i];
        const maxQ = Math.max(...row);
        let sumExp = 0;
        for (const val of row) {
          sumExp += Math.exp(val - maxQ);
        }
        const logSumExp = maxQ + Math.log(sumExp);
        const meanQ = row.reduce((a, b) => a + b, 0) / this.n_actions;
        
        const cqlPenalty = this.cqlAlpha * (logSumExp - meanQ);
        totalLoss += cqlPenalty / batch;

        for (let a = 0; a < this.n_actions; a++) {
          const softmax = Math.exp(row[a] - maxQ) / sumExp;
          grad_q[i][a] += this.cqlAlpha * (softmax - 1.0 / this.n_actions) / batch;
        }
      }
    }
    
    let grad_h = this.out.backward(grad_q);
    grad_h = hadamard(grad_h, this.mask2);
    grad_h = this.fc2.backward(grad_h);
    grad_h = hadamard(grad_h, this.mask1);
    this.fc1.backward(grad_h);

    return totalLoss;
  }
}
