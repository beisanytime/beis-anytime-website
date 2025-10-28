// google-login.js

// This function is called when the Google Sign-In is successful
function handleCredentialResponse(response) {
    // Decode the JWT token
    const payload = decodeJwtResponse(response.credential);

    // Store user info
    const userInfo = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture
    };
    localStorage.setItem('userInfo', JSON.stringify(userInfo));

    // FIX: Store the email in the specific key expected by the admin script
    localStorage.setItem('googleUserEmail', payload.email); 

    // Update UI for all relevant elements
    updateUserUI();

    // Optional: Dispatch a custom event to immediately notify other scripts (like the admin check)
    window.dispatchEvent(new CustomEvent('googleSignIn', { detail: userInfo }));
}

function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
}

function updateUserUI() {
    const userString = localStorage.getItem('userInfo');
    const loginBtnContainers = document.querySelectorAll('.google-login-btn');
    const userInfoContainers = document.querySelectorAll('.user-info');
    const signOutBtnContainers = document.querySelectorAll('.sign-out-btn');

    if (userString) {
        // User is logged in
        const user = JSON.parse(userString);

        // FIX: Ensure the admin script's expected email key is set on session load
        localStorage.setItem('googleUserEmail', user.email); 

        loginBtnContainers.forEach(el => el.style.display = 'none');

        userInfoContainers.forEach(el => {
            el.style.display = 'flex'; // Use 'flex' for proper alignment
            el.href = 'account.html';
            // FIX: Add email to dataset for the admin script's DOM check
            el.dataset.email = user.email; 
            const avatar = el.querySelector('.user-avatar');
            const name = el.querySelector('.user-name');
            if (avatar) avatar.src = user.picture;
            if (name) name.textContent = user.name;
        });

        signOutBtnContainers.forEach(el => {
            el.style.display = 'flex';
            // Ensure there isn't a duplicate event listener
            el.onclick = (e) => {
                e.preventDefault();
                signOut();
            };
        });

    } else {
        // User is logged out
        // FIX: Clear the email key when logged out
        localStorage.removeItem('googleUserEmail'); 

        loginBtnContainers.forEach(el => el.style.display = 'block');
        userInfoContainers.forEach(el => {
            el.style.display = 'none';
            // Clear the dataset email
            delete el.dataset.email;
        });
        signOutBtnContainers.forEach(el => el.style.display = 'none');
    }
}

// This function signs the user out
function signOut() {
    // Clear the user's data from localStorage
    localStorage.removeItem('userInfo');
    // FIX: Ensure admin script key is also cleared
    localStorage.removeItem('googleUserEmail'); 

    // Disable Google's one-tap sign-in for the next page load
    // FIX: Safely check for 'google' before calling disableAutoSelect()
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }

    // Refresh the page to reflect the signed-out state
    window.location.reload();
}

/**
 * Initializes the Google Sign-In SDK, retrying if the 'google' object is not yet defined.
 */
function initGoogleLogin() {
    // FIX: The core logic to check if GSI script has loaded
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        // GSI not loaded yet, retry after a short delay
        setTimeout(initGoogleLogin, 100);
        return;
    }
    
    // Initialize Google Sign-In (now 'google' is guaranteed to be defined)
    google.accounts.id.initialize({
        client_id: '248585696121-67ecvsoqhtbpc0b2qt5f486864p0uvnq.apps.googleusercontent.com', // Your Client ID
        callback: handleCredentialResponse,
        // Recommended for persistent login experience
        auto_select: true 
    });

    google.accounts.id.renderButton(
        document.getElementById('googleLoginBtn'),
        { theme: 'outline', size: 'large', type: 'standard' }
    );
}


// Check for existing session and start initialization on page load
document.addEventListener('DOMContentLoaded', () => {
    // Always update UI based on login state (safe to run immediately as it uses only DOM/localStorage)
    updateUserUI();

    // Start the Google initialization check/retry loop
    initGoogleLogin();
});