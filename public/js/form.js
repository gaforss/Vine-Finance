const form = document.getElementById('entryForm');
const entryIdInput = document.createElement('input');
entryIdInput.type = 'hidden';
entryIdInput.id = 'entryId';
form.appendChild(entryIdInput);

const customFieldsContainer = document.getElementById('customFieldsContainer');
const formTitle = document.getElementById('formTitle'); // Ensure this element exists in your HTML

async function checkDuplicateMonth(selectedDate, excludeEntryId = null) {
    try {
        const response = await fetch('/entries', {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const entries = await response.json();
        if (!Array.isArray(entries)) {
            throw new Error('Expected an array of entries');
        }

        const selectedMonth = new Date(selectedDate).toISOString().slice(0, 7); // Format as YYYY-MM

        // Check if there is an entry with the same month
        return entries.some(entry => entry.date.slice(0, 7) === selectedMonth && entry._id !== excludeEntryId);
    } catch (error) {
        console.error('Error fetching entries:', error);
        return false;
    }
}

form.addEventListener('submit', async function(event) {
    event.preventDefault();

    const entryId = entryIdInput.value.trim();
    const url = entryId ? `/entries/edit/${entryId}` : '/entries/add';
    const method = entryId ? 'PUT' : 'POST';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const fieldsToCheck = ['cash', 'investments', 'realEstate', 'retirementAccounts', 'vehicles', 'personalProperty', 'otherAssets', 'liabilities'];
    for (let field of fieldsToCheck) {
        if (typeof data[field] === 'string') {
            // Remove currency symbol and commas before parsing
            data[field] = parseFloat(data[field].replace(/[$,]/g, '')) || 0;
        } else {
            data[field] = parseFloat(data[field]) || 0;
        }
    }

    const selectedDate = new Date(data.date);
    data.date = selectedDate.toISOString();

    console.log(`Selected date (after conversion): ${data.date}`);
    console.log('Form data being sent:', data);

    data.customFields = [];
    
    const isDuplicate = await checkDuplicateMonth(data.date, entryId);
    if (isDuplicate && !entryId) {
        showToast('An entry for this month already exists. Please update the existing entry.', 'warning');
        return;
    }

    // Final validation before submitting
    const requiredInputs = form.querySelectorAll('input[required]');
    let allFieldsFilled = true;
    for (const input of requiredInputs) {
        if (!input.value.trim()) {
            allFieldsFilled = false;
            break; 
        }
    }

    if (!allFieldsFilled) {
        showToast('Please ensure all required fields are completed before saving.', 'danger');
        return;
    }

    // Send the form data to the server
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(data)
        });

        console.log('Form submission response:', response);

        if (response.ok) {
            alert('Entry processed successfully');
            await fetchEntries(); 
            form.reset();
            customFieldsContainer.innerHTML = '';
            entryIdInput.value = ''; 
            if (formTitle) {
                formTitle.textContent = 'Add New Entry';
            }
        } else {
            const errorMessage = await response.text();
            alert(`Failed to process entry: ${errorMessage}`);
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('An unexpected network error occurred.');
    }
});

async function fetchEntries() {
    try {
        const response = await fetch('/entries', {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const entries = await response.json();
        if (!Array.isArray(entries)) {
            throw new Error('Expected an array of entries');
        }

        const transactionsTable = $('#transactionsTable').DataTable();
        transactionsTable.clear().draw();

        entries.forEach(entry => {
            const dateObj = new Date(entry.date);
            const formattedDate = dateObj.toISOString().split('T')[0]; // Use ISO date without time
            const rowData = [
                dateObj.getTime(), // Hidden column for sorting
                formattedDate,
                (entry.cash || 0).toFixed(2),
                (entry.investments || 0).toFixed(2),
                (entry.realEstate || 0).toFixed(2),
                (entry.retirementAccounts || 0).toFixed(2),
                (entry.vehicles || 0).toFixed(2),
                (entry.personalProperty || 0).toFixed(2),
                (entry.otherAssets || 0).toFixed(2),
                (entry.liabilities || 0).toFixed(2),
                ((entry.cash || 0) + (entry.investments || 0) + (entry.realEstate || 0) + (entry.retirementAccounts || 0) + (entry.vehicles || 0) + (entry.personalProperty || 0) + (entry.otherAssets || 0) - (entry.liabilities || 0)).toFixed(2),
                `<button class="btn btn-warning btn-sm" onclick="editEntry('${entry._id}')"> <i class="fa fa-edit"></i> </button>
                 <button class="btn btn-danger btn-sm" onclick="deleteEntry('${entry._id}')"><i class="fa fa-close"></i> </button>`
            ];
            transactionsTable.row.add(rowData).draw();
        });
    } catch (error) {
        console.error('Error fetching entries:', error);
    }
}

// New Modal-specific JavaScript
const editModal = new bootstrap.Modal(document.getElementById('editModal'));
const editEntryForm = document.getElementById('editEntryForm');
const modalEntryId = document.getElementById('modalEntryId');

async function editEntry(id) {
    try {
        const response = await fetch(`/entries/${id}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch entry data.');
        }
        const entry = await response.json();

        const formatCurrency = (value) => {
            return (parseFloat(value) || 0).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        // Populate the modal form
        modalEntryId.value = entry._id;
        document.getElementById('modalDate').value = entry.date.slice(0, 7); // Format as YYYY-MM
        document.getElementById('modalCash').value = formatCurrency(entry.cash);
        document.getElementById('modalInvestments').value = formatCurrency(entry.investments);
        document.getElementById('modalRealEstate').value = formatCurrency(entry.realEstate);
        document.getElementById('modalRetirementAccounts').value = formatCurrency(entry.retirementAccounts);
        document.getElementById('modalVehicles').value = formatCurrency(entry.vehicles);
        document.getElementById('modalPersonalProperty').value = formatCurrency(entry.personalProperty);
        document.getElementById('modalOtherAssets').value = formatCurrency(entry.otherAssets);
        document.getElementById('modalLiabilities').value = formatCurrency(entry.liabilities);
        
        // This call ensures the input event listeners are attached for user interaction.
        applyFormattingToInputs(document.getElementById('editEntryForm'));

        // Show the modal
        editModal.show();
    } catch (error) {
        console.error('Error fetching entry for editing:', error);
        alert('Could not load entry for editing.');
    }
}

editEntryForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const entryId = modalEntryId.value;
    const url = `/entries/edit/${entryId}`;
    const method = 'PUT';
    const formData = new FormData(editEntryForm);
    const data = Object.fromEntries(formData.entries());

    const fieldsToUnformat = ['cash', 'investments', 'realEstate', 'retirementAccounts', 'vehicles', 'personalProperty', 'otherAssets', 'liabilities'];
    for (let field of fieldsToUnformat) {
        if (typeof data[field] === 'string') {
            data[field] = unformatCurrency(data[field]);
        }
    }

    const selectedDate = new Date(data.date);
    data.date = selectedDate.toISOString();

    // Check for duplicate month entry excluding the current entry being edited
    const isDuplicate = await checkDuplicateMonth(data.date, entryId);
    if (isDuplicate) {
        alert('An entry for this month already exists. Please update the existing entry.');
        return; // Prevent form submission
    }

    data.customFields = [];
    document.querySelectorAll('.modal .custom-field').forEach(fieldDiv => {
        const fieldName = fieldDiv.querySelector('.custom-field-name').value;
        const fieldValue = parseFloat(fieldDiv.querySelector('.custom-field-value').value) || 0;
        const fieldType = fieldDiv.querySelector('.custom-field-type').value;
        data.customFields.push({ name: fieldName, amount: fieldValue, type: fieldType });
    });

    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        alert('Entry updated successfully');
        fetchEntries();
        editModal.hide();
    } else {
        const errorMessage = await response.text();
        alert(`Failed to update entry: ${errorMessage}`);
    }
});

// Add null check for uploadForm
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
        const uploadStatusDiv = document.getElementById('uploadStatus');

        if (!file) {
            showUploadStatus('Please select a file to upload.', true);
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Show a loading spinner and clear previous status
        uploadStatusDiv.innerHTML = '<div class="d-flex align-items-center"><strong>Uploading...</strong><div class="spinner-border ms-auto" role="status" aria-hidden="true"></div></div>';
        uploadStatusDiv.className = 'mt-3 alert alert-info';

        try {
            const response = await fetch('/import', {
                method: 'POST',
                headers: headers,
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                showUploadStatus('Data imported successfully!', false);
                await fetchEntries(); // Refresh the data table
                document.getElementById('uploadForm').reset();
            } else {
                showUploadStatus(result.message || 'An unknown error occurred during import.', true);
            }
        } catch (error) {
            console.error('Error during upload:', error);
            showUploadStatus('An unexpected network error occurred. Please try again.', true);
        }
    });
}

function showUploadStatus(message, isError = false) {
    const statusDiv = document.getElementById('uploadStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'mt-3 alert';
        statusDiv.classList.add(isError ? 'alert-danger' : 'alert-success');
    }
}

async function deleteEntry(id) {
    const response = await fetch(`/entries/delete/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    });

    console.log('Delete entry response:', response);
    if (response.ok) {
        alert('Entry deleted successfully');
        fetchEntries();
    } else {
        const errorMessage = await response.text();
        alert(`Failed to delete entry: ${errorMessage}`);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOMContentLoaded event triggered');
    const token = getToken();
    console.log('Token:', token);
    if (!token) {
        redirectToLogin();
        return;
    }
    console.log('Initializing DataTable');
    $('#transactionsTable').DataTable({
        "order": [[0, "desc"]],
        "paging": false,
        "searching": false,
        "info": false,
        "lengthChange": false,
        "dom": '<"row"<"col-sm-12"tr>>',
        "columnDefs": [
            { "targets": 0, "visible": false },
            { 
                "targets": 1,
                "type": "date",
                "render": function(data, type, row) {
                    if (type === 'display') {
                        // Parse the date and adjust for timezone
                        const [year, month] = data.split('-');
                        const date = new Date(year, month - 1); // month is 0-based in JavaScript
                        return date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            timeZone: 'UTC' // Ensure consistent timezone handling
                        });
                    }
                    return data;
                }
            },
            {
                "targets": [2, 3, 4, 5, 6, 7, 8, 9, 10],
                "render": function(data, type, row) {
                    if (type === 'display') {
                        return parseFloat(data).toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD'
                        });
                    }
                    return data;
                }
            }
        ]
    });
    await fetchEntries();
});

function getToken() {
    return localStorage.getItem('token');
}

function redirectToLogin() {
    window.location.href = '/login.html';
}

// Add null check for prefillFromAccountsBtn
const prefillFromAccountsBtn = document.getElementById('prefillFromAccountsBtn');
if (prefillFromAccountsBtn) {
    prefillFromAccountsBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/plaid/api/all-balances', {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch balances');
            }

            const balances = await response.json();

            document.getElementById('cash').value = balances.cash.toFixed(2);
            document.getElementById('investments').value = balances.investments.toFixed(2);
            document.getElementById('retirementAccounts').value = balances.retirement.toFixed(2);
            document.getElementById('liabilities').value = balances.liabilities.toFixed(2);

        } catch (error) {
            console.error('Error prefilling from accounts:', error);
            alert('Failed to prefill from accounts.');
        }
    });
}