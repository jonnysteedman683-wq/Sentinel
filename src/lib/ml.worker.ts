import { sphericalKMeans } from './clustering.js';
import { pca2D } from './pca.js';
import * as tf from '@tensorflow/tfjs';
import { initTfjsBackend } from './tf-setup.js';

self.onmessage = async (e) => {
  const { id, type, embeddings, simThreshold, currentContextVector, logsToUse } = e.data;
  
  try {
    await initTfjsBackend();

    if (type === 'analyze_graph') {
      const proj = pca2D(embeddings);
      const k = Math.min(8, Math.max(3, Math.floor(embeddings.length / 5)));
      const clusters = sphericalKMeans(embeddings, k);
      
      const tensor = tf.tensor2d(embeddings);
      const norms = tf.norm(tensor, 'euclidean', 1, true);
      const normalized = tf.div(tensor, tf.maximum(norms, 1e-9));
      
      const simMatrix = tf.matMul(normalized, normalized, false, true);
      const simData = await simMatrix.array() as number[][];
      
      tensor.dispose();
      norms.dispose();
      normalized.dispose();
      simMatrix.dispose();

      const edges: { sourceIdx: number; targetIdx: number; sim: number }[] = [];
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const sim = simData[i][j];
          if (sim >= simThreshold) {
            edges.push({ sourceIdx: i, targetIdx: j, sim });
          }
        }
      }

      self.postMessage({ id, status: 'success', data: { proj, clusters, edges } });
    } else if (type === 'predict_intent') {
      const actions = [
        'click_memory_tab',
        'click_brains_tab',
        'click_heartbeat_tab',
        'click_mind_map_tab',
        'click_brainstorm_tab',
        'click_logs_tab',
        'pin_memory'
      ];
      
      const priors: Record<string, number> = {
        'click_memory_tab': 0.25,
        'click_brains_tab': 0.15,
        'click_heartbeat_tab': 0.15,
        'click_mind_map_tab': 0.15,
        'click_brainstorm_tab': 0.15,
        'click_logs_tab': 0.10,
        'pin_memory': 0.05
      };

      if (!logsToUse || logsToUse.length === 0) {
        const responsePredictions = actions.map(act => ({
          action: act,
          probability: priors[act] || 0.1
        })).sort((a: any, b: any) => b.probability - a.probability);
        self.postMessage({ id, status: 'success', data: { predictions: responsePredictions } });
        return;
      }

      const logVectors = logsToUse.map((log: any) => log.contextVector);
      
      const tfScales = tf.tensor1d([1/24, 1/5, 1/50, 1/200, 1.0]);
      const tfCurrent = tf.tensor1d(currentContextVector);
      const tfLogs = tf.tensor2d(logVectors);
      
      const tfDiffs = tf.sub(tfLogs, tfCurrent);
      const tfScaledDiffs = tf.mul(tfDiffs, tfScales);
      const tfSqDiffs = tf.square(tfScaledDiffs);
      const tfDists = tf.sqrt(tf.sum(tfSqDiffs, 1));
      
      const distData = await tfDists.array() as number[];
      
      tfScales.dispose();
      tfCurrent.dispose();
      tfLogs.dispose();
      tfDiffs.dispose();
      tfScaledDiffs.dispose();
      tfSqDiffs.dispose();
      tfDists.dispose();

      const distances = logsToUse.map((log: any, i: number) => ({
        feature: log.feature,
        distance: distData[i]
      }));

      distances.sort((a: any, b: any) => a.distance - b.distance);

      const k = Math.min(7, distances.length);
      const neighbors = distances.slice(0, k);

      const votes: Record<string, number> = {};
      actions.forEach(act => { votes[act] = 0; });

      neighbors.forEach((n: any) => {
        const act = n.feature;
        if (votes[act] !== undefined) {
          const weight = 1 / (n.distance + 0.1);
          votes[act] += weight;
        }
      });

      const totalWeight = Object.values(votes).reduce((a, b) => a + b, 0);
      const alpha = 0.3; 
      
      const responsePredictions = actions.map(act => {
        const voteWeight = votes[act] || 0;
        const p_vote = totalWeight > 0 ? voteWeight / totalWeight : 0;
        const p_prior = priors[act] || 0.1;
        const probability = (1 - alpha) * p_vote + alpha * p_prior;
        return {
          action: act,
          probability
        };
      });

      responsePredictions.sort((a: any, b: any) => b.probability - a.probability);
      self.postMessage({ id, status: 'success', data: { predictions: responsePredictions } });
    }
  } catch (error: any) {
    self.postMessage({ id, status: 'error', error: error.message });
  }
};
