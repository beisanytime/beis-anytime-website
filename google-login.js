// google-login.js

// This function is called when the Google Sign-In is successful
function handleCredentialResponse(response) {
    // Decode the JWT to get user profile information
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const profile = JSON.parse(jsonPayload);

    // Create a user object with the data we need
    const user = {
        name: profile.name,
        email: profile.email,
        picture: profile.picture
    };

    // **IMPORTANT**: Save the user's data in localStorage
    localStorage.setItem('loggedInUser', JSON.stringify(user));

    // Redirect to the account page after saving the data
    window.location.href = 'account.html';
}

// This function signs the user out
function signOut() {
    // Clear the user's data from localStorage
    localStorage.removeItem('loggedInUser');

    // Disable Google's one-tap sign-in for the next page load
    google.accounts.id.disableAutoSelect();

    // Refresh the page to reflect the signed-out state
    window.location.reload();
}

// This function updates the UI based on login state
function updateUserUI() {
    const userString = localStorage.getItem('loggedInUser');
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


// This code runs when the page is loaded
window.onload = function () {
    // Initialize Google Identity Services
    google.accounts.id.initialize({
        client_id: '248585696121-67ecvsoqhtbpc0b2qt5f486864p0uvnq.apps.googleusercontent.com', // Your Client ID
        callback: handleCredentialResponse
    });

    // Render the Google Sign-In button in any container with the ID 'googleLoginBtn'
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn && !localStorage.getItem('loggedInUser')) {
        google.accounts.id.renderButton(
            googleLoginBtn,
            { theme: "outline", size: "large", type: 'standard', text: 'signin_with', width: '200' }
        );
    }

    // Update the UI immediately based on whether the user is already logged in
    updateUserUI();
};