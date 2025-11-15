import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCreF56JD4rVlAGPRai3YJ3XB8xDD3isaI",
  authDomain: "projeto-glauks.firebaseapp.com",
  databaseURL: "https://projeto-glauks-default-rtdb.firebaseio.com",
  projectId: "projeto-glauks",
  storageBucket: "projeto-glauks.firebasestorage.app",
  messagingSenderId: "810784881705",
  appId: "1:810784881705:web:a71832a2159cef73943038"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;