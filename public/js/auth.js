document.addEventListener('DOMContentLoaded', async function() {
    var token=getToken();
    const deleteProfileForm = document.getElementById('deleteProfileForm');
    if (deleteProfileForm) {
        deleteProfileForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            
            // Show confirmation toast
            const confirmMessage = `
                <div class="text-center mb-3">
                    <i class="fa fa-exclamation-triangle fa-3x mb-3" style="color: #ffc107;"></i>
                    <h4 class="mb-3">⚠️ Delete Profile Confirmation</h4>
                </div>
                <div class="text-center mb-4">
                    <p class="mb-2"><strong>This action will permanently delete ALL your data including:</strong></p>
                    <ul class="list-unstyled mb-3">
                        <li><i class="fa fa-university me-2"></i>Bank accounts & financial data</li>
                        <li><i class="fa fa-money me-2"></i>Budgeting information</li>
                        <li><i class="fa fa-umbrella me-2"></i>Retirement plans</li>
                        <li><i class="fa fa-home me-2"></i>Real estate portfolios</li>
                        <li><i class="fa fa-chart-line me-2"></i>All financial tracking data</li>
                    </ul>
                    <div class="alert alert-danger">
                        <i class="fa fa-exclamation-circle me-2"></i>
                        <strong>This action is NOT reversible!</strong>
                    </div>
                </div>
                <div class="d-flex justify-content-center gap-3">
                    <button type="button" class="btn btn-danger px-4" onclick="confirmDeleteProfile()">
                        <i class="fa fa-trash me-2"></i>Delete Profile
                    </button>
                    <button type="button" class="btn btn-secondary px-4" onclick="dismissDeleteConfirmation()">
                        <i class="fa fa-times me-2"></i>Cancel
                    </button>
                </div>
            `;
            
            showToast(confirmMessage, 'warning');
        });
    }

    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('token');
            window.location.href = '/logout';
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', result.token);
                    window.location.href = '/dashboard.html';
                } else {
                    alert(result.message);
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('An error occurred. Please try again.');
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            if (data.password !== data.confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            try {
                const response = await fetch('/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Registration successful! Please log in.');
                    window.location.href = '/login.html';
                } else {
                    alert(result.message);
                }
            } catch (error) {
                console.error('Registration error:', error);
                alert('An error occurred during registration.');
            }
        });
    }
});

async function register(username, password) {
    const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });
    if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        window.location.href = '/';
    } else {
        const errorMessage = await response.text();
        alert(`Registration failed: ${errorMessage}`);
    }
}

// Function for handling login
async function login(email, password) {
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = '/dashboard';
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during login');
    }
}

// Function for Google Sign-In handling
function handleCredentialResponse(response) {
    const id_token = response.credential;

    const base64Url = id_token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const userInfo = JSON.parse(jsonPayload);
    const username = userInfo.email.split('@')[0];

    fetch('/auth/google', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: id_token, username: username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('token', data.token);
            window.location.href = '/dashboard';
        } else {
            alert('Google Sign-In failed: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error during Google Sign-In:', error);
    });
}

// Function for logout
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

// Function to get token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Function to redirect to login page
function redirectToLogin() {
    window.location.href = '/login.html';
}

// Function to confirm profile deletion
async function confirmDeleteProfile() {
    // Dismiss the confirmation modal first
    if (window.currentModalToast) {
        hideModalToast(window.currentModalToast.element, window.currentModalToast.backdrop);
    }
    
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/auth/deleteAccount', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            showToast('Profile deleted successfully. Redirecting to login page...', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            const data = await response.json();
            showToast(data.message || 'Error deleting profile', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while deleting the profile', 'danger');
    }
}

// Function to dismiss delete confirmation
function dismissDeleteConfirmation() {
    // Use the manual dismissal function for modal toasts
    if (window.currentModalToast) {
        hideModalToast(window.currentModalToast.element, window.currentModalToast.backdrop);
    }
}