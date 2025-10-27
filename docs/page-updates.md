# HTML Page Update Instructions

To update each HTML page with common header and sidebar:

1. Add to `<head>` section:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

2. Replace body content with:
```html
<body>
    <div class="site-wrapper">
        <!-- Main content will be injected here by common-template.js -->
        <div class="main-content">
            <div class="page-content">
                <!-- Original page content goes here -->
            </div>
        </div>
    </div>

    <script src="theme-toggle.js"></script>
    <script src="google-login.js"></script>
    <script src="assets/common-template.js"></script>
    <script src="notification-service-worker.js"></script>
</body>
```

For rabbi pages in subdirectories, use `../` prefix for script paths:
```html
    <script src="../theme-toggle.js"></script>
    <script src="../google-login.js"></script>
    <script src="../assets/common-template.js"></script>
    <script src="../notification-service-worker.js"></script>
```

Files to update:
- [x] index.html (already has correct structure)
- [x] recent.html
- [x] trending.html
- [x] speakers.html
- [x] admin.html (already has correct structure)
- [x] view_shiur.html
- [x] rabbi-buckman/index.html
- [ ] rabbi-chissik/index.html
- [ ] rabbi-gerber/index.html
- [ ] rabbi-golker/index.html
- [ ] rabbi-hartman/index.html
- [ ] rabbi-konik/index.html
- [ ] rabbi-rosenfeld/index.html
- [ ] rabbi-rowe/index.html
- [ ] special/index.html
- [ ] account.html
- [ ] new_shiur.html

Note: Some rabbi pages already have `rabbi-template.js` which handles similar functionality. Consider merging templates or keeping separate for rabbi pages if additional rabbi-specific features are needed.