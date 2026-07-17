const { getFirestore } = require('firebase-admin/firestore');
try {
  const db = getFirestore();
  console.log("Success");
} catch(e) {
  console.error("Error:", e.message);
}
