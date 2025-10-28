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

    // Update UI for all relevant elements
    updateUserUI();
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

        loginBtnContainers.forEach(el => el.style.display = 'none');

        userInfoContainers.forEach(el => {
            el.style.display = 'flex'; // Use 'flex' for proper alignment
            el.href = 'account.html';
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
        loginBtnContainers.forEach(el => el.style.display = 'block');
        userInfoContainers.forEach(el => el.style.display = 'none');
        signOutBtnContainers.forEach(el => el.style.display = 'none');
    }
}

// This function signs the user out
function signOut() {
    // Clear the user's data from localStorage
    localStorage.removeItem('userInfo');

    // Disable Google's one-tap sign-in for the next page load
    google.accounts.id.disableAutoSelect();

    // Refresh the page to reflect the signed-out state
    window.location.reload();
}

function handleSignOut(e) {
    e.preventDefault();
    localStorage.removeItem('userInfo');

    const loginBtn = document.getElementById('googleLoginBtn');
    const userInfoEl = document.querySelector('.user-info');
    const signOutBtn = document.querySelector('.sign-out-btn');

    if (loginBtn) loginBtn.style.display = 'block';
    if (userInfoEl) userInfoEl.style.display = 'none';
    if (signOutBtn) signOutBtn.style.display = 'none';

    // Clear Google session
    google.accounts.id.disableAutoSelect();
}

// Check for existing session on page load
document.addEventListener('DOMContentLoaded', () => {
    // Always update UI based on login state
    updateUserUI();

    // Initialize Google Sign-In
    google.accounts.id.initialize({
        client_id: '248585696121-67ecvsoqhtbpc0b2qt5f486864p0uvnq.apps.googleusercontent.com', // Your Client ID
        callback: handleCredentialResponse
    });

    google.accounts.id.renderButton(
        document.getElementById('googleLoginBtn'),
        { theme: 'outline', size: 'large', type: 'standard' }
    );
});