let currentStep = 0;

function startTour() {
    document.getElementById('tour-overlay').style.display = 'flex';
    showStep(0);
}

function showStep(step) {
    const steps = document.querySelectorAll('.tour-step');
    steps.forEach((el, index) => {
        el.style.display = index === step ? 'block' : 'none';
    });

    const targetSelector = steps[step].getAttribute('data-target');
    if (targetSelector) {
        highlightElement(targetSelector);
    } else {
        removeHighlight();
    }
}

function nextStep() {
    console.log("nextStep called, current step is", currentStep);
    currentStep++;
    const steps = document.querySelectorAll('.tour-step');
    if (currentStep < steps.length) {
        showStep(currentStep);
    } else {
        showStep(steps.length - 1);
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
    }
}

function completeTour() {
    document.getElementById('tour-overlay').style.display = 'none';
    removeHighlight();
    fetch('/auth/complete-tour', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        }
    }).then(response => response.json())
      .then(data => {
          console.log('Tour marked as completed');
          window.location.href = '/editProfile';
      });
}

function highlightElement(selector) {
    removeHighlight();
    const element = document.querySelector(selector);
    if (element) {
        element.classList.add('highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function removeHighlight() {
    const highlighted = document.querySelector('.highlight');
    if (highlighted) {
        highlighted.classList.remove('highlight');
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Attach event listeners for tour buttons
    document.querySelectorAll('.tour-next-btn').forEach(button => {
        button.addEventListener('click', nextStep);
    });

    document.querySelectorAll('.tour-prev-btn').forEach(button => {
        button.addEventListener('click', prevStep);
    });

    const completeButton = document.querySelector('.tour-complete-btn');
    if (completeButton) {
        completeButton.addEventListener('click', completeTour);
    }

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