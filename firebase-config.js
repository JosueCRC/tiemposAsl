import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyCjxOwEW0k4arHU1w-1w209uFTe7lPQGL0",
    authDomain: "tiemposasl-eb35d.firebaseapp.com",
    projectId: "tiemposasl-eb35d",
    storageBucket: "tiemposasl-eb35d.firebasestorage.app",
    messagingSenderId: "905146086573",
    appId: "1:905146086573:web:dd311a57834d3fae44c224",
    measurementId: "G-9E7ERMVZLC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

export { auth, onAuthStateChanged, signOut, db, doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, functions, httpsCallable };