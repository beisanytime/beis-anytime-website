// google-login.js

function handleCredentialResponse(response) {
    // The response object contains the JWT ID token.
    // You can decode this token to get user information.
    // A simple (less secure) way to decode the payload for client-side use:
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const profile = JSON.parse(jsonPayload);

    // Now you can use the profile information
    console.log("ID: " + profile.sub);
    console.log('Full Name: ' + profile.name);
    console.log('Given Name: ' + profile.given_name);
    console.log('Family Name: ' + profile.family_name);
    console.log("Image URL: " + profile.picture);
    console.log("Email: " + profile.email);

    // Hide the login button and show user info, similar to your old onGoogleSignIn function
    document.querySelectorAll('.google-login-btn').forEach(btn => {
        btn.style.display = 'none';
    });
    document.querySelectorAll('.user-info').forEach(el => {
        el.textContent = `Signed in as ${profile.name}`;
        el.style.display = 'block';
    });

    // Redirect to account.html after successful login
    window.location.href = 'account.html';
}

window.onload = function () {
    google.accounts.id.initialize({
        client_id: '248585696121-67ecvsoqhtbpc0b2qt5f486864p0uvnq.apps.googleusercontent.com',
        callback: handleCredentialResponse
    });

    const googleLoginBtn = document.getElementById('googleLoginBtn');

    if (googleLoginBtn) {
       google.accounts.id.renderButton(
        googleLoginBtn,
        { theme: "outline", size: "large", type: 'standard', text: 'signin_with' } // Customize button appearance
      );
    }
    
    // Optional: Prompt for sign-in on page load
    // google.accounts.id.prompt(); 
};