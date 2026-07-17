import re

with open('server.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
in_sync = False
for line in lines:
    if line.startswith('let knowledgeBase: KnowledgeDocument[] = [];'):
        new_lines.append('let userKnowledgeBase: Record<string, KnowledgeDocument[]> = {};\n')
        continue
    
    if line.startswith('async function syncKnowledgeBase() {'):
        in_sync = True
        new_lines.append('''async function syncKnowledgeBase(uid: string) {
  if (!db || !uid) return;
  try {
    const querySnapshot = await db.collection(`users/${uid}/knowledge_base`).get();
    const docs: KnowledgeDocument[] = [];
    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.text && data.embedding) {
        docs.push({ id: doc.id, text: data.text, embedding: data.embedding });
      }
    });
    userKnowledgeBase[uid] = docs;
    console.log(`[RAG][${uid}] Synced ${docs.length} docs.`);
  } catch (error: any) {
    console.warn(`[RAG][${uid}] Sync failed:`, error.message);
  }
}
''')
        continue
        
    if in_sync:
        if line.startswith('}'):
            in_sync = False
        continue
        
    # Replacements for usage
    # In chat handler
    if 'knowledgeBase.length' in line:
        line = line.replace('knowledgeBase.length', '(userKnowledgeBase[uid] || []).length')
    if 'knowledgeBase.map' in line:
        line = line.replace('knowledgeBase.map', '(userKnowledgeBase[uid] || []).map')
    if 'knowledgeBase.push' in line:
        line = line.replace('knowledgeBase.push(docItem)', 'if (!userKnowledgeBase[uid]) userKnowledgeBase[uid] = []; userKnowledgeBase[uid].push(docItem)')
    
    if 'await syncKnowledgeBase();' in line:
        line = line.replace('await syncKnowledgeBase();', 'await syncKnowledgeBase(uid);')
        
    # The interval
    if 'setInterval(syncKnowledgeBase' in line:
        line = '// ' + line

    if 'db.collection("knowledge_base")' in line:
        line = line.replace('db.collection("knowledge_base")', 'db.collection(`users/${uid}/knowledge_base`)')
    
    new_lines.append(line)

with open('server.ts', 'w') as f:
    f.writelines(new_lines)

