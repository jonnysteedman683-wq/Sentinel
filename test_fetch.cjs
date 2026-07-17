const admin = require('firebase-admin');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('firebase-applet-config.json'));
admin.initializeApp({
  credential: admin.credential.cert(config.serviceAccount),
  databaseURL: config.databaseURL
});
const db = admin.firestore();
async function run() {
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    const chats = await db.collection(`users/${user.id}/chats`).orderBy('timestamp', 'asc').get();
    console.log(`User ${user.id} has ${chats.docs.length} chats.`);
    if (chats.docs.length > 0) {
      console.log(chats.docs[chats.docs.length - 1].data());
    }
  }
}
run();
