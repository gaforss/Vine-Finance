// public/js/mixpanel-tracking.js

mixpanel.init("883554c993442ff0049a280607fd6324", {
    debug: true,
    track_pageview: true,
    persistence: 'localStorage',
    ignore_dnt: true
});

// Function to get user data from the token
async function getUserData() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
        const response = await fetch('/auth/api/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Error fetching user data for tracking:', error);
        return null;
    }
}

// Identify user for Mixpanel tracking and set user properties
async function identifyUserForTracking() {
    const user = await getUserData();
    if (user && user._id) {
        mixpanel.identify(user._id);
        mixpanel.people.set({
            "$first_name": user.firstName,
            "$last_name": user.lastName,
            "$email": user.email,
            "username": user.username,
            "is_new_user": user.isNewUser,
        });
        console.log(`Mixpanel user identified: ${user._id} and properties set.`);
    }
}

// Generic function to track an event
function trackEvent(eventName, properties = {}) {
    mixpanel.track(eventName, properties);
}

// --- Specific Event Tracking Functions ---

function trackPageView() {
    trackEvent('Page View', {
        'page_title': document.title,
        'page_url': window.location.pathname
    });
}

function trackFormSubmission(formName, properties = {}) {
    trackEvent('Form Submission', { form: formName, ...properties });
}

function trackModalView(modalName, properties = {}) {
    trackEvent('Modal View', { modal: modalName, ...properties });
}

function trackUserAction(eventName, properties = {}) {
    trackEvent(eventName, properties);
}

// --- Setup Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    identifyUserForTracking();
    trackPageView();

    // Delegated event listener for tracking clicks
    document.body.addEventListener('click', event => {
        const target = event.target.closest('[data-track-click]');
        
        if (target) {
            const eventName = target.getAttribute('data-track-click');
            const properties = {};
            
            // Collect properties from data-track-prop-* attributes
            for (const attr of target.attributes) {
                if (attr.name.startsWith('data-track-prop-')) {
                    const propName = attr.name.replace('data-track-prop-', '');
                    properties[propName] = attr.value;
                }
            }

            trackUserAction(eventName, properties);

            // Special handling for logout
            if (eventName === 'Logout') {
                mixpanel.reset();
                console.log('Mixpanel user reset on logout.');
            }
        }
    });

    // Track form submissions
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', () => {
            const formName = form.getAttribute('data-track-form') || form.id || 'unnamed-form';
            trackFormSubmission(formName);
        });
    });

    // Track modal views
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('shown.bs.modal', () => {
            const modalName = modal.getAttribute('data-track-modal') || modal.id || 'unnamed-modal';
            trackModalView(modalName);
        });
    });
}); 