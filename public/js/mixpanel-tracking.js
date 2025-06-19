// public/js/mixpanel-tracking.js

// Wait for Mixpanel to be available before initializing
let initAttempts = 0;
const maxInitAttempts = 50; // 5 seconds max (50 * 100ms)

function initializeMixpanel() {
    if (typeof mixpanel === 'undefined') {
        initAttempts++;
        if (initAttempts >= maxInitAttempts) {
            console.error('Mixpanel failed to load after maximum attempts');
            return;
        }
        console.warn(`Mixpanel library not loaded yet, retrying in 100ms... (attempt ${initAttempts}/${maxInitAttempts})`);
        setTimeout(initializeMixpanel, 100);
        return;
    }

    // Initialize Mixpanel with proper configuration
    mixpanel.init("883554c993442ff0049a280607fd6324", {
        debug: false, // Set to false in production
        track_pageview: false, // We'll handle page views manually
        persistence: 'localStorage',
        ignore_dnt: true,
        api_host: 'https://api.mixpanel.com',
        loaded: function() {
            console.log('Mixpanel loaded successfully');
            // Wait a bit more to ensure Mixpanel is fully ready
            setTimeout(() => {
                if (mixpanel && mixpanel.track) {
                    setupTracking();
                } else {
                    console.warn('Mixpanel loaded but not ready, retrying...');
                    setTimeout(setupTracking, 500);
                }
            }, 100);
        }
    });
}

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
    if (typeof mixpanel === 'undefined' || !mixpanel || !mixpanel.identify) {
        console.warn('Mixpanel not available for user identification');
        return;
    }

    const user = await getUserData();
    if (user && user._id) {
        mixpanel.identify(user._id);
        mixpanel.people.set({
            "$first_name": user.firstName || '',
            "$last_name": user.lastName || '',
            "$email": user.email || '',
            "username": user.username || '',
            "is_new_user": user.isNewUser || false,
            "last_seen": new Date().toISOString(),
            "user_type": user.isNewUser ? 'new' : 'returning'
        });
        console.log(`Mixpanel user identified: ${user._id}`);
    }
}

// Generic function to track an event with error handling
function trackEvent(eventName, properties = {}) {
    if (typeof mixpanel === 'undefined' || !mixpanel || !mixpanel.track) {
        console.warn('Mixpanel not available or not ready, event not tracked:', eventName);
        return;
    }

    try {
        // Add common properties
        const enhancedProperties = {
            ...properties,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            page_url: window.location.pathname,
            page_title: document.title
        };

        mixpanel.track(eventName, enhancedProperties);
        console.log('Event tracked:', eventName, enhancedProperties);
    } catch (error) {
        console.error('Error tracking event:', eventName, error);
    }
}

// --- Specific Event Tracking Functions ---

function trackPageView() {
    trackEvent('Page View', {
        'page_title': document.title,
        'page_url': window.location.pathname,
        'referrer': document.referrer || 'direct'
    });
}

function trackFormSubmission(formName, properties = {}) {
    trackEvent('Form Submission', { 
        form: formName, 
        form_id: properties.formId || '',
        ...properties 
    });
}

function trackModalView(modalName, properties = {}) {
    trackEvent('Modal View', { 
        modal: modalName, 
        modal_id: properties.modalId || '',
        ...properties 
    });
}

function trackUserAction(eventName, properties = {}) {
    trackEvent(eventName, properties);
}

// Track errors
function trackError(errorType, errorMessage, additionalData = {}) {
    trackEvent('Error Occurred', {
        error_type: errorType,
        error_message: errorMessage,
        ...additionalData
    });
}

// Track feature usage
function trackFeatureUsage(featureName, properties = {}) {
    trackEvent('Feature Used', {
        feature: featureName,
        ...properties
    });
}

// --- Setup Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Start the initialization process
    initializeMixpanel();
    
    // Fallback: if Mixpanel doesn't load after 3 seconds, set up basic tracking
    setTimeout(() => {
        if (typeof mixpanel === 'undefined') {
            console.warn('Setting up fallback tracking without Mixpanel');
            setupBasicTracking();
        }
    }, 3000);
});

// Basic tracking fallback
function setupBasicTracking() {
    console.log('Basic tracking setup (no Mixpanel)');
    
    // Track page view
    console.log('Page View:', {
        page_title: document.title,
        page_url: window.location.pathname,
        referrer: document.referrer || 'direct'
    });
    
    // Track clicks (console only)
    document.body.addEventListener('click', event => {
        const target = event.target.closest('[data-track-click]');
        if (target) {
            const eventName = target.getAttribute('data-track-click');
            console.log('Click Event:', eventName, {
                element_type: target.tagName.toLowerCase(),
                element_id: target.id || '',
                element_class: target.className || ''
            });
        }
    });
    
    // Track form submissions (console only)
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (event) => {
            const formName = form.getAttribute('data-track-form') || form.id || 'unnamed-form';
            console.log('Form Submission:', formName);
        });
    });
}

// Setup tracking after Mixpanel is loaded
function setupTracking() {
    identifyUserForTracking();
    trackPageView();

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            trackEvent('Page Became Visible', {
                time_hidden: Date.now() - (window.lastHiddenTime || Date.now())
            });
        } else {
            window.lastHiddenTime = Date.now();
            trackEvent('Page Became Hidden');
        }
    });

    // Delegated event listener for tracking clicks with deduplication
    let lastClickTime = 0;
    document.body.addEventListener('click', event => {
        const target = event.target.closest('[data-track-click]');
        
        if (target) {
            // Prevent duplicate clicks within 500ms
            const now = Date.now();
            if (now - lastClickTime < 500) {
                return;
            }
            lastClickTime = now;

            const eventName = target.getAttribute('data-track-click');
            const properties = {};
            
            // Collect properties from data-track-prop-* attributes
            for (const attr of target.attributes) {
                if (attr.name.startsWith('data-track-prop-')) {
                    const propName = attr.name.replace('data-track-prop-', '');
                    properties[propName] = attr.value;
                }
            }

            // Add element context
            properties.element_type = target.tagName.toLowerCase();
            properties.element_id = target.id || '';
            properties.element_class = target.className || '';

            trackUserAction(eventName, properties);

            // Special handling for logout
            if (eventName === 'Logout') {
                mixpanel.reset();
                console.log('Mixpanel user reset on logout.');
            }
        }
    });

    // Track form submissions with deduplication
    const submittedForms = new Set();
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (event) => {
            const formId = form.id || form.getAttribute('data-track-form') || 'unnamed-form';
            
            // Prevent duplicate form submissions
            if (submittedForms.has(formId)) {
                return;
            }
            submittedForms.add(formId);
            
            // Reset after 5 seconds
            setTimeout(() => submittedForms.delete(formId), 5000);

            const formName = form.getAttribute('data-track-form') || form.id || 'unnamed-form';
            trackFormSubmission(formName, {
                formId: formId,
                form_action: form.action || '',
                form_method: form.method || 'GET'
            });
        });
    });

    // Track modal views with deduplication
    const viewedModals = new Set();
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('shown.bs.modal', () => {
            const modalId = modal.id || modal.getAttribute('data-track-modal') || 'unnamed-modal';
            
            // Prevent duplicate modal views within 10 seconds
            if (viewedModals.has(modalId)) {
                return;
            }
            viewedModals.add(modalId);
            
            // Reset after 10 seconds
            setTimeout(() => viewedModals.delete(modalId), 10000);

            const modalName = modal.getAttribute('data-track-modal') || modal.id || 'unnamed-modal';
            trackModalView(modalName, {
                modalId: modalId
            });
        });
    });

    // Track AJAX errors
    window.addEventListener('error', (event) => {
        trackError('JavaScript Error', event.message, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        trackError('Unhandled Promise Rejection', event.reason, {
            promise: event.promise
        });
    });

    console.log('Mixpanel tracking setup complete');
} 