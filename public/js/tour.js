let currentStep = 0;
const tourSteps = document.querySelectorAll('.tour-step');
const totalSteps = tourSteps.length;

function startTour(e) {
    if (e) e.preventDefault(); // Prevent default link behavior if called from an event
    currentStep = 0;
    document.getElementById('tour-overlay').style.display = 'flex';
    showStep(currentStep);
}

function showStep(step) {
    tourSteps.forEach((el, index) => {
        if (index === step) {
            el.style.display = 'block';
            // Use a timeout to allow the display property to apply before adding the class for the animation
            setTimeout(() => {
                el.classList.add('active');
                // Set focus to the first focusable element in the current step
                const focusableElements = el.querySelectorAll('button, [href]');
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            }, 10);
        } else {
            el.style.display = 'none';
            el.classList.remove('active');
        }
    });

    const targetSelector = tourSteps[step].getAttribute('data-target');
    if (targetSelector) {
        highlightElement(targetSelector);
    } else {
        removeHighlight();
    }
    updateProgressBar();
}

function nextStep() {
    if (currentStep < totalSteps - 1) {
        currentStep++;
        showStep(currentStep);
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
    }
}

function completeTour() {
    fetch('/auth/complete-tour', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        }
    }).then(response => response.json())
      .then(data => {
          console.log('Tour marked as completed');
          endTour();
          window.location.href = '/editProfile';
      }).catch(error => {
          console.error('Error completing tour:', error);
          endTour(); // Still hide tour on error
      });
}

function endTour() {
    document.getElementById('tour-overlay').style.display = 'none';
    removeHighlight();
}

function updateProgressBar() {
    const progress = ((currentStep + 1) / totalSteps) * 100;
    document.querySelectorAll('.tour-progress-bar').forEach(bar => {
        bar.style.width = `${progress}%`;
    });
}

function highlightElement(selector) {
    removeHighlight(); // Remove any existing highlight
    const targetElement = document.querySelector(selector);
    if (!targetElement) return;

    // Scroll the target element into view with a smooth animation
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const overlay = document.getElementById('tour-overlay');
    const highlight = document.createElement('div');
    highlight.className = 'highlight';
    
    const rect = targetElement.getBoundingClientRect();
    
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.left = `${rect.left}px`;

    overlay.appendChild(highlight);
}

function removeHighlight() {
    const existingHighlight = document.querySelector('#tour-overlay .highlight');
    if (existingHighlight) {
        existingHighlight.remove();
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Attach event listeners for tour buttons
    document.querySelectorAll('.tour-next-btn').forEach(button => button.addEventListener('click', nextStep));
    document.querySelectorAll('.tour-prev-btn').forEach(button => button.addEventListener('click', prevStep));
    document.querySelectorAll('.tour-close-btn').forEach(button => button.addEventListener('click', endTour));
    document.querySelector('.tour-complete-btn').addEventListener('click', completeTour);
    document.getElementById('restart-tour-btn').addEventListener('click', startTour);

    const tourOverlay = document.getElementById('tour-overlay');

    // Allow closing the tour by clicking the overlay
    tourOverlay.addEventListener('click', (e) => {
        if (e.target === tourOverlay) {
            endTour();
        }
    });

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (tourOverlay.style.display === 'flex') {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextStep();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevStep();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                endTour();
            } else if (e.key === 'Tab') {
                const currentStepElement = tourSteps[currentStep];
                const focusableElements = Array.from(currentStepElement.querySelectorAll('button, [href]'));
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else { // Tab
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        }
    });

    const token = localStorage.getItem('token');
    if (token) {
        try {
            const response = await fetch('/auth/api/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }
            const user = await response.json();
            if (user && user.isNewUser) {
                startTour();
            }
        } catch (error) {
            console.error('Error checking user tour status:', error);
        }
    }
});