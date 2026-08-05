import codecs

with codecs.open('src/lib/lsm.ts', 'r', 'utf-8') as f:
    content = f.read()

new_methods = """
  async exportWeights(): Promise<{ inputWeights: number[][], reservoirWeights: number[][], readoutWeights: number[][] }> {
    const inputData = await this.inputWeights.array() as number[][];
    const reservoirData = await this.reservoirWeights.array() as number[][];
    const readoutData = await this.readoutWeights.array() as number[][];
    return { inputWeights: inputData, reservoirWeights: reservoirData, readoutWeights: readoutData };
  }

  loadWeights(weights: { inputWeights: number[][], reservoirWeights: number[][], readoutWeights: number[][] }) {
    tf.dispose([this.inputWeights, this.reservoirWeights, this.readoutWeights]);
    this.inputWeights = tf.tensor2d(weights.inputWeights);
    this.reservoirWeights = tf.tensor2d(weights.reservoirWeights);
    this.readoutWeights = tf.variable(tf.tensor2d(weights.readoutWeights));
  }

  dispose() {"""

content = content.replace("dispose() {", new_methods)

with codecs.open('src/lib/lsm.ts', 'w', 'utf-8') as f:
    f.write(content)
