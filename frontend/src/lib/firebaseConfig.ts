import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
apiKey: "AIzaSyDVMyUGspuZLwjckqv1sb9CpBg3xXkQ56g",
  authDomain: "file-sharing-app-c63a0.firebaseapp.com",
  databaseURL: "https://file-sharing-app-c63a0-default-rtdb.firebaseio.com",
  projectId: "file-sharing-app-c63a0",
  storageBucket: "file-sharing-app-c63a0.appspot.com",
  messagingSenderId: "616447313925",
  appId: "1:616447313925:web:db692a9c95ae28f17df46c",
  measurementId: "G-F5G183J837"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };