document.addEventListener('DOMContentLoaded', () => {
    const steps = document.querySelectorAll('.form-step');
    const nextButtons = document.querySelectorAll('.next-btn');
    const prevButtons = document.querySelectorAll('.prev-btn');
    const entryForm = document.getElementById('entryForm');
    const maxSteps = steps.length;

    let currentStep = 1;

    const updateStepper = () => {
        document.querySelectorAll('.stepper-item').forEach(item => {
            const step = parseInt(item.dataset.step);
            if (step < currentStep) {
                item.classList.add('completed');
                item.classList.remove('active');
            } else if (step === currentStep) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('active', 'completed');
            }
        });

        steps.forEach(step => {
            if (parseInt(step.dataset.step) === currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
    };

    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (currentStep < maxSteps) {
                currentStep++;
                if (currentStep === 3) { // Assuming step 3 is the review step
                    populateReview();
                }
                updateStepper();
            }
        });
    });

    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateStepper();
            }
        });
    });

    const populateReview = () => {
        const reviewContent = document.getElementById('review-summary');
        const formData = new FormData(entryForm);
        let summaryHtml = '<dl class="row">';

        for (const [key, value] of formData.entries()) {
            if (key !== 'entryId') {
                const labelElement = document.querySelector(`label[for="${key}"]`);
                const label = labelElement ? labelElement.innerHTML : key;
                summaryHtml += `<dt class="col-sm-3">${label}</dt><dd class="col-sm-9">${value}</dd>`;
            }
        }

        summaryHtml += '</dl>';
        reviewContent.innerHTML = summaryHtml;
    };

    updateStepper();
});
