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
        alert('An entry for this month already exists. Please update the existing entry.');
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

function editEntry(id) {
    fetch(`/entries/${id}`, {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => response.json())
    .then(entry => {
        console.log(`Editing entry date: ${entry.date}`);
        const dateObj = new Date(entry.date);
        const formattedDate = dateObj.toISOString().slice(0, 7);
        document.getElementById('modalDate').value = formattedDate;
        
        // Format values before populating
        document.getElementById('modalCash').value = entry.cash;
        document.getElementById('modalInvestments').value = entry.investments;
        document.getElementById('modalRealEstate').value = entry.realEstate;
        document.getElementById('modalRetirementAccounts').value = entry.retirementAccounts;
        document.getElementById('modalVehicles').value = entry.vehicles;
        document.getElementById('modalPersonalProperty').value = entry.personalProperty;
        document.getElementById('modalOtherAssets').value = entry.otherAssets;
        document.getElementById('modalLiabilities').value = entry.liabilities;
        
        // Apply formatting to all inputs in the modal
        applyFormattingToInputs(document.getElementById('editEntryForm'));

        modalEntryId.value = id;
        editModal.show();
    })
    .catch(error => console.error('Error fetching entry:', error));
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

document.getElementById('modalAddCustomFieldBtn').addEventListener('click', () => {
    const customFieldDiv = document.createElement('div');
    customFieldDiv.classList.add('custom-field');

    const label = document.createElement('label');
    label.innerText = 'Custom Field Name:';
    const inputName = document.createElement('input');
    inputName.type = 'text';
    inputName.classList.add('custom-field-name');
    inputName.required = true;

    const valueLabel = document.createElement('label');
    valueLabel.innerText = 'Value:';
    const inputValue = document.createElement('input');
    inputValue.type = 'number';
    inputValue.classList.add('custom-field-value');
    inputValue.step = '0.01';
    inputValue.required = true;

    const typeLabel = document.createElement('label');
    typeLabel.innerText = 'Type:';
    const inputType = document.createElement('select');
    inputType.classList.add('custom-field-type');
    inputType.required = true;
    inputType.innerHTML = `
        <option value="asset">Asset</option>
        <option value="liability">Liability</option>
    `;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.classList.add('removeCustomFieldBtn');
    removeButton.innerText = 'Remove';
    removeButton.addEventListener('click', () => {
        document.getElementById('modalCustomFieldsContainer').removeChild(customFieldDiv);
    });

    customFieldDiv.appendChild(label);
    customFieldDiv.appendChild(inputName);
    customFieldDiv.appendChild(document.createElement('br'));
    customFieldDiv.appendChild(valueLabel);
    customFieldDiv.appendChild(inputValue);
    customFieldDiv.appendChild(document.createElement('br'));
    customFieldDiv.appendChild(typeLabel);
    customFieldDiv.appendChild(inputType);
    customFieldDiv.appendChild(document.createElement('br'));
    customFieldDiv.appendChild(removeButton);
    customFieldDiv.appendChild(document.createElement('br'));

    document.getElementById('modalCustomFieldsContainer').appendChild(customFieldDiv);
});

document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    console.log('File selected:', file);
    console.log('Form data:', formData);
    console.log('Headers for request:', headers);

    try {
        const response = await fetch('/import', {
            method: 'POST',
            headers: headers,
            body: formData
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Upload result:', result);
        alert(result.message);
        if (response.ok) {
            console.log('Result data:', result.data);
            populateUploadedData(result.data);
        }
    } catch (error) {
        console.error('Error during upload:', error);
        alert('Error during upload: ' + error.message);
    }
});

function populateUploadedData(data) {
    if (!data) {
        console.error('No data received to populate');
        return;
    }

    console.log('Data received to populate:', data);

    const transactionsTable = $('#transactionsTable').DataTable();
    console.log('Updating DataTable with uploaded data:', transactionsTable);
    transactionsTable.clear().draw();

    data.forEach(entry => {
        const dateObj = new Date(entry.date);
        const formattedDate = isNaN(dateObj) ? 'Invalid Date' : dateObj.toLocaleDateString('en-US', { timeZone: 'UTC' });
        
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

document.getElementById('prefillFromAccountsBtn').addEventListener('click', async () => {
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