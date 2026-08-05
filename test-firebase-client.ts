import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import fs from "fs";

try {
  const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  console.log("Config loaded:", firebaseConfig);
  
  const app = initializeApp(firebaseConfig);
  console.log("App initialized successfully.");
  
  const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
  console.log("Firestore db instance created with databaseId:", firebaseConfig.firestoreDatabaseId);
  
  console.log("Testing collection read...");
  const q = query(collection(db, "system_health"), limit(1));
  getDocs(q)
    .then((snap) => {
      console.log("SUCCESS! Connected using Client SDK with custom database ID. Snap empty?", snap.empty);
      if (!snap.empty) {
        console.log("First doc data:", snap.docs[0].data());
      }
      process.exit(0);
    })
    .catch((e) => {
      console.error("Client SDK connectivity error:", e.message || e);
      process.exit(1);
    });
} catch (e: any) {
  console.error("Initialization error:", e);
  process.exit(1);
}
