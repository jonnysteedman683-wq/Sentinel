import codecs

with codecs.open('src/lib/dream-engine.ts', 'r', 'utf-8') as f:
    content = f.read()

# remove unused RollingStats
content = content.replace("import { RollingStats } from './rollingStats';\n", "")

old_lsm_training = """    if (!sharedLSM) {
      sharedLSM = new LiquidStateMachine();
    }"""

new_lsm_training = """    if (!sharedLSM) {
      sharedLSM = new LiquidStateMachine();
    }
    
    // Load LSM weights if they exist
    const lsmRef = db.collection(`users/${userId}/lsm`).doc('latest');
    const lsmDoc = await lsmRef.get();
    if (lsmDoc.exists) {
        const data = lsmDoc.data();
        if (data && data.weights) {
            sharedLSM.loadWeights(data.weights);
        }
    }"""

content = content.replace(old_lsm_training, new_lsm_training)

old_lsm_save = """    span.setAttribute('lsmFinalLoss', loss);
    
    span.setStatus({ code: SpanStatusCode.OK });"""

new_lsm_save = """    span.setAttribute('lsmFinalLoss', loss);
    
    // Save LSM weights
    const weights = await sharedLSM.exportWeights();
    await lsmRef.set({ weights, timestamp: Date.now() });

    span.setStatus({ code: SpanStatusCode.OK });"""

content = content.replace(old_lsm_save, new_lsm_save)

with codecs.open('src/lib/dream-engine.ts', 'w', 'utf-8') as f:
    f.write(content)

