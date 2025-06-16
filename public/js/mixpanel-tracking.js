// public/js/mixpanel-tracking.js

mixpanel.init("883554c993442ff0049a280607fd6324", {
    debug: true,
    track_pageview: true,
    persistence: 'localStorage'
});

// Function to get the user ID from the token
async function getUserId() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
        const response = await fetch('/auth/api/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return null;
        const user = await response.json();
        return user._id;
    } catch (error) {
        console.error('Error fetching user ID for tracking:', error);
        return null;
    }
}

// Identify user for Mixpanel tracking
async function identifyUserForTracking() {
    const userId = await getUserId();
    if (userId) {
        mixpanel.identify(userId);
        console.log(`Mixpanel user identified: ${userId}`);
    }
}


// Generic function to track an event
function trackEvent(eventName, properties = {}) {
    mixpanel.track(eventName, properties);
}

// --- Specific Event Tracking Functions ---

// Track clicks on navigation links
function trackNavigation(linkName) {
    trackEvent('Navigation Click', { link: linkName });
}

// Track form submissions
function trackFormSubmission(formName) {
    trackEvent('Form Submission', { form: formName });
}

// Track modal views
function trackModalView(modalName) {
    trackEvent('Modal View', { modal: modalName });
}

// Track button clicks
function trackButtonClick(buttonName, properties = {}) {
    trackEvent('Button Click', { button: buttonName, ...properties });
}

// --- Setup Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    identifyUserForTracking();
    // Example: Track page view on every page load
    trackEvent('Page View', {
        'Page Title': document.title,
        'Page URL': window.location.pathname
    });
    trackEvent('Page View', { page_title: document.title });

    // Track navigation links
    document.querySelectorAll('a[href]').forEach(link => {
        link.addEventListener('click', () => {
            const href = link.getAttribute('href');
            if (href === '/logout') {
                trackEvent('Logout');
            }
            trackNavigation(href);
        });
    });

    // Track form submissions
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', () => {
            trackFormSubmission(form.id || 'unnamed-form');
        });
    });

    // Track modal views
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('shown.bs.modal', () => {
            trackModalView(modal.id || 'unnamed-modal');
        });
    });

    // Track button clicks
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            trackButtonClick(button.id || button.textContent.trim());
        });
    });
}); 