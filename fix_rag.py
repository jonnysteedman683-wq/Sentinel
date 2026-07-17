import re

with open('server.ts', 'r') as f:
    content = f.read()

# Replace global knowledgeBase with a cache map
content = re.sub(
    r'let knowledgeBase: KnowledgeDocument\[\] = \[\];',
    'let userKnowledgeBase: Record<string, KnowledgeDocument[]> = {};',
    content
)

# Update syncKnowledgeBase
sync_func_old = r'''async function syncKnowledgeBase\(\) \{
  if \(!db\) return;
  try \{
    const querySnapshot = await db\.collection\("knowledge_base"\)\.get\(\);
    const docs: KnowledgeDocument\[\] = \[\];
    querySnapshot\.forEach\(\(doc: any\) => \{
      const data = doc\.data\(\);
      if \(data\.text && data\.embedding\) \{
        docs\.push\(\{
          id: doc\.id,
          text: data\.text,
          embedding: data\.embedding
        \}\);
      \}
    \}\);
    knowledgeBase = docs;
    console\.log\(`\[RAG\] Synced \$\{knowledgeBase\.length\} knowledge base documents from Firestore\.`\);
  \} catch \(error: any\) \{
    if \(error\.message\?\.includes\("PERMISSION_DENIED"\)\) \{
      console\.warn\("\[RAG\] Skipping knowledge base sync due to permissions\. Disabling DB logging\."\);
    \} else \{
      console\.error\("\[RAG\] Error syncing knowledge base:", error\);
    \}
  \}
\}'''

sync_func_new = '''async function syncKnowledgeBase(uid: string) {
  if (!db) return;
  try {
    const querySnapshot = await db.collection(`users/${uid}/knowledge_base`).get();
    const docs: KnowledgeDocument[] = [];
    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.text && data.embedding) {
        docs.push({
          id: doc.id,
          text: data.text,
          embedding: data.embedding
        });
      }
    });
    userKnowledgeBase[uid] = docs;
    console.log(`[RAG][${uid}] Synced ${docs.length} KB docs from Firestore.`);
  } catch (error: any) {
    if (error.message?.includes("PERMISSION_DENIED")) {
      console.warn(`[RAG][${uid}] Skipping sync due to permissions.`);
    } else {
      console.error(`[RAG][${uid}] Error syncing:`, error);
    }
  }
}'''

content = re.sub(sync_func_old, sync_func_new, content)

with open('server.ts', 'w') as f:
    f.write(content)
