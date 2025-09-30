// Google OAuth integration
function onGoogleSignIn(googleUser) {
    var profile = googleUser.getBasicProfile();
    // You can send profile info to your backend here
    document.querySelectorAll('.google-login-btn').forEach(btn => {
        btn.style.display = 'none';
    });
    document.querySelectorAll('.user-info').forEach(el => {
        el.textContent = `Signed in as ${profile.getName()}`;
        el.style.display = 'block';
    });
}

function renderGoogleButton() {
    document.querySelectorAll('.google-login-btn').forEach(btn => {
        if (window.gapi && window.gapi.signin2) {
            window.gapi.signin2.render(btn.id, {
                'scope': 'profile email',
                'width': 200,
                'height': 40,
                'longtitle': true,
                'theme': 'dark',
                'onsuccess': onGoogleSignIn
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    if (window.gapi) {
        renderGoogleButton();
    } else {
        var script = document.createElement('script');
        script.src = 'https://apis.google.com/js/platform.js';
        script.onload = renderGoogleButton;
        document.body.appendChild(script);
    }
});
