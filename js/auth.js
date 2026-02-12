import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let userRole = null;

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    const loginLink = document.getElementById('loginLink');
    const logoutLink = document.getElementById('logoutLink');
    const dashboardLink = document.getElementById('dashboardLink');
    const adminLink = document.getElementById('adminLink');

    if (user) {
        // User is logged in
        if (loginLink) loginLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'block';
        if (dashboardLink) dashboardLink.style.display = 'block';

        // Get user role
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                userRole = userDoc.data().role;
                if (adminLink && userRole === 'admin') {
                    adminLink.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error fetching user role:', error);
        }
    } else {
        // User is logged out
        if (loginLink) loginLink.style.display = 'block';
        if (logoutLink) logoutLink.style.display = 'none';
        if (dashboardLink) dashboardLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        userRole = null;
    }
});

// Logout handler
const logoutLink = document.getElementById('logoutLink');
if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    });
}

// Get current user
export function getCurrentUser() {
    return currentUser;
}

// Get user role
export function getUserRole() {
    return userRole;
}

// Check if user is authenticated
export function isAuthenticated() {
    return currentUser !== null;
}

// Check if user is admin
export function isAdmin() {
    return userRole === 'admin';
}

// Require authentication
export function requireAuth() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (!user) {
                window.location.href = '/login.html';
            } else {
                resolve(user);
            }
        });
    });
}

// Require admin role
export async function requireAdmin() {
    const user = await requireAuth();
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        alert('Access denied. Admin privileges required.');
        window.location.href = '/index.html';
        return false;
    }
    return true;
}
