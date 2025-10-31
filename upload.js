// Function to show/hide upload section and handle file uploads
function showUploadSection(event) {
    event.preventDefault();
    const uploadSection = document.getElementById('uploadSection');
    const mainContent = document.querySelector('.main-content');
    
    // Toggle visibility
    Array.from(mainContent.children).forEach(child => {
        if (child.id !== 'uploadSection') {
            child.style.display = 'none';
        }
    });
    uploadSection.style.display = 'block';

    // Initialize upload functionality if not already done
    initializeUpload();
}

function initializeUpload() {
    // Initialize only once
    if (window.uploadInitialized) return;
    window.uploadInitialized = true;

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileName');
    const dateInput = document.getElementById('date');
    const uploaderNameInput = document.getElementById('uploaderName');
    const uploadBtn = document.getElementById('uploadBtn');

    // Set default date
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];

    // Try to get uploader name from local storage
    const savedUploaderName = localStorage.getItem('uploaderName');
    if (savedUploaderName) {
        uploaderNameInput.value = savedUploaderName;
    }

    // File Drop Zone functionality
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Upload button click handler
    uploadBtn.addEventListener('click', handleUpload);
}

function handleFileDrop(e) {
    e.preventDefault();
    const dropZone = document.getElementById('dropZone');
    dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length) {
        handleFiles(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length) {
        handleFiles(files[0]);
    }
}

function handleFiles(file) {
    const fileNameDisplay = document.getElementById('fileName');
    fileNameDisplay.textContent = file.name;
    window.selectedFile = file;
}

async function handleUpload() {
    if (!window.selectedFile) {
        alert('Please select a file to upload');
        return;
    }

    const title = document.getElementById('title').value.trim();
    if (!title) {
        alert('Please enter a title for the shiur');
        return;
    }

    const description = document.getElementById('description').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const date = document.getElementById('date').value;
    const uploaderName = document.getElementById('uploaderName').value.trim();

    if (!uploaderName) {
        alert('Please enter your name');
        return;
    }

    // Save uploader name for future use
    localStorage.setItem('uploaderName', uploaderName);

    // Create FormData object
    const formData = new FormData();
    formData.append('file', window.selectedFile);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('notes', notes);
    formData.append('date', date);
    formData.append('uploader', uploaderName);

    try {
        const uploadBtn = document.getElementById('uploadBtn');
        const originalText = uploadBtn.textContent;
        uploadBtn.textContent = 'Uploading...';
        uploadBtn.disabled = true;

        // Send to worker
        const response = await fetch('https://beis-anytime-api.beisanytime.workers.dev/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed: ' + response.statusText);
        }

        const result = await response.json();
        
        // Clear form
        document.getElementById('title').value = '';
        document.getElementById('description').value = '';
        document.getElementById('notes').value = '';
        document.getElementById('fileName').textContent = '';
        window.selectedFile = null;

        alert('Upload successful!');
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
    } finally {
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
    }
}