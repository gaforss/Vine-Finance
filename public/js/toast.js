function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now();
    
    // Check if this is a warning/confirmation type that should be displayed as a large modal
    if (type === 'warning' || type === 'danger') {
        // Remove any existing modal toasts first
        if (window.currentModalToast) {
            hideModalToast(window.currentModalToast.element, window.currentModalToast.backdrop);
        }
        
        // Add backdrop
        const backdropId = 'toast-backdrop-' + Date.now();
        const backdropHTML = `<div id="${backdropId}" class="toast-backdrop"></div>`;
        document.body.insertAdjacentHTML('beforeend', backdropHTML);
        
        const modalToastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0 modal-toast" role="alert" aria-live="assertive" aria-atomic="true" style="max-width: 500px; width: 90vw; margin: 0 auto; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); border-radius: 12px;">
                <div class="d-flex flex-column">
                    <div class="toast-body p-4">
                        ${message}
                    </div>
                </div>
            </div>
        `;
        
        // Insert modal directly into body to avoid container conflicts
        document.body.insertAdjacentHTML('beforeend', modalToastHTML);
        
        const toastElement = document.getElementById(toastId);
        const backdropElement = document.getElementById(backdropId);
        
        // Show the toast immediately without Bootstrap toast
        toastElement.style.display = 'block';
        toastElement.classList.add('show');
        
        // Handle backdrop click with a small delay to prevent immediate dismissal
        backdropElement.addEventListener('click', (e) => {
            e.stopPropagation();
            setTimeout(() => {
                hideModalToast(toastElement, backdropElement);
            }, 100);
        });
        
        // Store references for manual dismissal
        window.currentModalToast = {
            element: toastElement,
            backdrop: backdropElement
        };
        
    } else {
        // Regular toast for info/success messages
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);

        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Function to manually hide modal toast
function hideModalToast(toastElement, backdropElement) {
    if (toastElement) {
        toastElement.classList.remove('show');
        setTimeout(() => {
            toastElement.remove();
        }, 300);
    }
    if (backdropElement) {
        backdropElement.remove();
    }
    window.currentModalToast = null;
}
