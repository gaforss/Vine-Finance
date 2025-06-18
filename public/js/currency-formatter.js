// public/js/currency-formatter.js

function formatCurrency(input) {
    // 1. Unformat the value
    let rawValue = input.value.replace(/[^0-9.]/g, '');
    if (rawValue === '' || rawValue === '.') {
        input.value = '';
        return;
    }

    // 2. Keep track of cursor position
    const cursorStart = input.selectionStart;
    const originalLength = input.value.length;
    const originalCommas = (input.value.match(/,/g) || []).length;

    // 3. Format the number with currency
    let parts = rawValue.split('.');
    let integerPart = parts[0];
    let fractionPart = parts.length > 1 ? '.' + parts[1].substring(0, 2) : '';
    let formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    // 4. Set the new value with currency symbol
    input.value = '$' + formattedInteger + fractionPart;
    
    // 5. Adjust cursor position
    const newCommas = (input.value.match(/,/g) || []).length;
    const commaDifference = newCommas - originalCommas;
    let newCursorPosition = cursorStart + commaDifference + 1; // +1 for the currency symbol

    // Adjust for cursor position
    if (originalLength === 0 && input.value.length > 0) {
        newCursorPosition = input.value.length;
    }

    input.setSelectionRange(newCursorPosition, newCursorPosition);
}

function unformatCurrency(value) {
    return value.replace(/[^0-9.-]+/g, "");
}

function applyFormattingToInputs(container) {
    const inputs = container.querySelectorAll('input[type="text"][step="0.01"], input[type="number"][step="0.01"]');
    inputs.forEach(input => {
        const formatValue = () => {
            let numericValue = parseFloat(unformatCurrency(input.value));
            // If value is not a number (e.g., empty or invalid), default to 0
            if (isNaN(numericValue)) {
                numericValue = 0;
            }
            input.value = numericValue.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        const unformatValue = () => {
            if (input.value) {
                input.value = unformatCurrency(input.value);
            }
        };

        // Format on load/blur
        input.addEventListener('blur', formatValue);
        // Format as you type
        input.addEventListener('input', () => formatCurrency(input));
        // Un-format on focus
        input.addEventListener('focus', unformatValue);

        // The initial format is now handled by the data population script (plaid.js).
    });
} 