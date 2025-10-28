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
            // Check if the user element is within the header dropdown for proper display control
            const isDropdownElement = el.closest('#headerDropdown');
            el.style.display = isDropdownElement ? 'flex' : ''; // Use 'flex' for dropdown items
            el.href = 'account.html';
            // FIX: Add email to dataset for the admin script's DOM check
            el.dataset.email = user.email; 
            const avatar = el.querySelector('.user-avatar');
            const name = el.querySelector('.user-name');
            if (avatar) avatar.src = user.picture;
            if (name) name.textContent = user.name;
        });

        signOutBtnContainers.forEach(el => {
            const isDropdownElement = el.closest('#headerDropdown');
            el.style.display = isDropdownElement ? 'flex' : '';
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
        
        // Only show the Google Login Button when logged out
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
    if (window.google && google.accounts && google.accounts.id) {
        // This clears Google's session/cookie for this client_id
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
    
    // Check if the user is already logged in via localStorage
    const userString = localStorage.getItem('userInfo');
    
    // Initialize Google Sign-In (now 'google' is guaranteed to be defined)
    google.accounts.id.initialize({
        client_id: '248585696121-67ecvsoqhtbpc0b2qt5f486864p0uvnq.apps.googleusercontent.com', // Your Client ID
        callback: handleCredentialResponse,
        // Recommended for persistent login experience
        auto_select: true 
    });

    // We only want to RENDER the button if the user is not locally logged in
    // GSI will handle the "one-tap" display automatically if auto_select is true
    if (!userString) {
        const loginBtn = document.getElementById('googleLoginBtn');
        if (loginBtn) {
            google.accounts.id.renderButton(
                loginBtn,
                { theme: 'outline', size: 'large', type: 'standard' }
            );
        }
    } else {
         // If locally logged in, make sure the login container is hidden
        document.querySelectorAll('.google-login-btn').forEach(el => el.style.display = 'none');
    }

    // Since the user is not logging in on every page load, 
    // we need to ask GSI to check for a valid session using prompt()
    // This will trigger one-tap or auto_select, which calls handleCredentialResponse if successful
    google.accounts.id.prompt();
}


// Check for existing session and start initialization on page load
document.addEventListener('DOMContentLoaded', () => {
    // Always update UI based on login state (safe to run immediately as it uses only DOM/localStorage)
    // This initial call will show the UI if 'userInfo' is in localStorage.
    updateUserUI();

    // Start the Google initialization check/retry loop
    initGoogleLogin();
});