import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

try {
  const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  console.log("Config loaded:", firebaseConfig);
  const app = initializeApp({ projectId: firebaseConfig.projectId });
  console.log("App initialized successfully.");
  
  const dbDefault = getFirestore(app);
  console.log("Testing default database...");
  dbDefault.collection("system_logs").limit(1).get()
    .then((snap: any) => {
      console.log("Default DB: Successfully connected. Snap empty?", snap.empty);
    })
    .catch((e: any) => {
      console.error("Default DB connectivity error:", e.message);
    });

  if (firebaseConfig.firestoreDatabaseId) {
    const dbCustom = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log("Testing custom database:", firebaseConfig.firestoreDatabaseId);
    dbCustom.collection("system_logs").limit(1).get()
      .then((snap: any) => {
        console.log("Custom DB: Successfully connected. Snap empty?", snap.empty);
      })
      .catch((e: any) => {
        console.error("Custom DB connectivity error:", e.message);
      });
  }
} catch (e: any) {
  console.error("Initialization error:", e);
}
