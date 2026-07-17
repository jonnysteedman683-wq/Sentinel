import { QNetwork, Dense } from './rl-core.js';
import { SerializedDQN } from '../types.js';

export function serializeDense(layer: Dense) {
  return {
    weights: JSON.stringify(layer.W),
    biases: JSON.stringify(layer.b[0]),
  };
}

export function serializeDQN(net: QNetwork): SerializedDQN {
  return {
    layers: [
      serializeDense(net.fc1),
      serializeDense(net.fc2),
      serializeDense(net.out),
    ],
    inputSize: net.fc1.in_dim,
    outputSize: net.out.out_dim,
  };
}

export function deserializeDense(layer: Dense, serialized: { weights: string, biases: string }) {
  layer.W = JSON.parse(serialized.weights);
  layer.b = [JSON.parse(serialized.biases)];
}

export function deserializeDQN(data: SerializedDQN, lr: number = 0.001): QNetwork {
  const net = new QNetwork(data.inputSize, data.outputSize, lr);
  
  if (data.layers.length >= 3) {
    deserializeDense(net.fc1, data.layers[0]);
    deserializeDense(net.fc2, data.layers[1]);
    deserializeDense(net.out, data.layers[2]);
  }

  return net;
}
