import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyCD78QGXs6h-TZCEGv9GEaA29D4md230Fg",
  authDomain:        "grocery-planner-9ffc6.firebaseapp.com",
  projectId:         "grocery-planner-9ffc6",
  storageBucket:     "grocery-planner-9ffc6.firebasestorage.app",
  messagingSenderId: "351138353045",
  appId:             "1:351138353045:web:46504dce2c798c6139309c",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
