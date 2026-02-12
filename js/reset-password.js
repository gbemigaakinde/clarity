import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const resetForm = document.getElementById('resetForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const resetBtn = document.getElementById('resetBtn');

    // Clear previous messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    resetBtn.disabled = true;
    resetBtn.textContent = 'Sending...';

    try {
        await sendPasswordResetEmail(auth, email);
        
        successMessage.textContent = 'Password reset email sent! Check your inbox.';
        successMessage.style.display = 'block';
        resetForm.reset();
    } catch (error) {
        console.error('Password reset error:', error);
        
        let message = 'Failed to send reset email. Please try again.';
        
        switch (error.code) {
            case 'auth/invalid-email':
                message = 'Invalid email address.';
                break;
            case 'auth/user-not-found':
                message = 'No account found with this email.';
                break;
        }

        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Send Reset Link';
    }
});
