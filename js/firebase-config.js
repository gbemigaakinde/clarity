// Firebase Configuration Template
// Replace these values with your Firebase project credentials

const firebaseConfig = {
    apiKey: "AIzaSyBRc4xefCeCv1mGlPfEqzYFILIFuXcW_aw",
    authDomain: "clarity-academy-b8d82.firebaseapp.com",
    projectId: "clarity-academy-b8d82",
    storageBucket: "clarity-academy-b8d82.firebasestorage.app",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "360424313451",
    appId: "1:360424313451:web:3931df68f4d3dd161c972e",
    measurementId: "G-MPNTHSSMJQ"
};

// Import Firebase SDKs
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
