// Open and populate the Edit Expense modal
window.openEditExpenseModal = async function(expenseId, propertyId) {
    // Hide the expenses modal to prevent stacking
    const expensesModalEl = document.getElementById('expensesModal');
    const expensesModal = bootstrap.Modal.getInstance(expensesModalEl) || new bootstrap.Modal(expensesModalEl);
    expensesModal.hide();
    // Now proceed as before
    try {
        const token = localStorage.getItem('token');
        // Fetch all expenses for the property (since no single-expense endpoint)
        const response = await fetch(`/realestate/expense/list/${propertyId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch expenses.');
        const expenses = await response.json();
        const expense = expenses.find(e => e._id === expenseId);
        if (!expense) throw new Error('Expense not found.');
        document.getElementById('editExpenseId').value = expense._id;
        document.getElementById('editExpenseDate').value = expense.date ? expense.date.split('T')[0] : '';
        // Set the select dropdown value for category, case-insensitive
        const categorySelect = document.getElementById('editExpenseCategory');
        for (let i = 0; i < categorySelect.options.length; i++) {
            if (categorySelect.options[i].value.toLowerCase() === (expense.category || '').toLowerCase()) {
                categorySelect.selectedIndex = i;
                break;
            }
        }
        document.getElementById('editExpenseAmount').value = expense.amount || '';
        document.getElementById('editExpensePropertyId').value = propertyId;
        const modal = new bootstrap.Modal(document.getElementById('editExpenseModal'));
        modal.show();
        // When the edit modal closes, re-show the expenses modal
        const editModalEl = document.getElementById('editExpenseModal');
        editModalEl.addEventListener('hidden.bs.modal', function handler() {
            expensesModal.show();
            editModalEl.removeEventListener('hidden.bs.modal', handler);
        });
    } catch (error) {
        console.error('Error opening edit expense modal:', error);
        showToast('Could not load expense for editing.', 'error');
    }
}

// Helper function to safely track events with Mixpanel
function trackEvent(eventName, properties = {}) {
    if (typeof window.mixpanel !== 'undefined' && window.mixpanel.track) {
        try {
            window.mixpanel.track(eventName, properties);
        } catch (error) {
            console.warn('Failed to track event with Mixpanel:', error);
        }
    }
}

// Toast notification function
function showToast(message, type = 'success') {
    const toastId = `toast-${Date.now()}`;
    const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
    const toastHtml = `
      <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="3000">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `;
    const toastContainer = document.getElementById('toastContainer');
    if (toastContainer) {
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
    }
}

// Confirmation modal function
function confirmAction(message, onConfirm) {
    const confirmModalBody = document.getElementById('confirmModalBody');
    const confirmModalYes = document.getElementById('confirmModalYes');
    if (!confirmModalBody || !confirmModalYes) return;

    confirmModalBody.textContent = message;
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    
    const handler = () => {
        confirmModal.hide();
        confirmModalYes.removeEventListener('click', handler);
        onConfirm();
    };
    
    confirmModalYes.addEventListener('click', handler, { once: true });
    confirmModal.show();
}

async function fetchPortfolioSummary() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/realestate/summary', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            showToast('Failed to fetch portfolio summary', 'error');
            throw new Error('Failed to fetch portfolio summary');
        }

        const summary = await response.json();

        const formatCurrency = (value) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

        document.getElementById('total-noi').textContent = formatCurrency(summary.totalNOI || 0);
        document.getElementById('average-cap-rate').textContent = formatPercent(summary.averageCapRate || 0);
        document.getElementById('average-coc-return').textContent = formatPercent(summary.averageCoCReturn || 0);

    } catch (error) {
        console.error('Error fetching portfolio summary:', error);
        showToast('Error fetching portfolio summary', 'error');
        document.getElementById('total-noi').textContent = '$0';
        document.getElementById('average-cap-rate').textContent = '0%';
        document.getElementById('average-coc-return').textContent = '0%';
    }
}

function getPropertyTypeBadgeClass(propertyType) {
    switch (propertyType) {
        case 'Primary Residence':
            return 'bg-primary';
        case 'Long-Term Rental':
            return 'bg-success';
        case 'Short-Term Rental':
            return 'bg-warning';
        default:
            return 'bg-secondary';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const realEstateForm = document.getElementById('realEstateForm');
    const realEstateOverview = document.getElementById('realEstateOverview');

    const totalRentPaidElement = document.getElementById('totalRentPaid');
    const editRealEstateForm = document.getElementById('editRealEstateForm');
    const editPropertyId = document.getElementById('editPropertyId');
    const propertyDetailsModal = new bootstrap.Modal(document.getElementById('propertyDetailsModal'));
    const propertyDetailsContent = document.getElementById('propertyDetailsContent');
    const rentStartMonthInput = document.getElementById('rentStartMonth');
    const rentEndMonthInput = document.getElementById('rentEndMonth');
    const rentAmountInput = document.getElementById('rentAmount');
    const addRentPaymentBtn = document.getElementById('addRentPaymentBtn');
    const documentUploadForm = document.getElementById('documentUploadForm');
    const propertyIdInput = document.getElementById('propertyId');
    const documentsSection = new bootstrap.Modal(document.getElementById('documentsSection'));
    const documentsContent = document.getElementById('documentsContent');
    const documentUploadModal = new bootstrap.Modal(document.getElementById('documentUploadModal'));
    const expensesModal = new bootstrap.Modal(document.getElementById('expensesModal'));

    let currentPropertyId = null;

    // Define openDocumentUploadModal function
    window.openDocumentUploadModal = function(propertyId) {
        propertyIdInput.value = propertyId;
        documentUploadModal.show();
    };

    window.openExpensesModal = async function(propertyId) {
        document.getElementById('expensePropertyId').value = propertyId;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/expense/list/${propertyId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const expenses = await response.json();
                renderExpenses(propertyId, expenses);
                expensesModal.show();
            } else {
                const errorText = await response.text();
                console.error('Failed to fetch expenses. Status:', response.status, 'Response:', errorText);
                showToast(`Failed to fetch expenses: ${errorText}`, 'error');
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
            showToast('Error fetching expenses', 'error');
        }
    };

    document.getElementById('addExpenseForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const propertyId = document.getElementById('expensePropertyId').value;
        const formData = new FormData(event.target);
        const expenseData = {
            date: formData.get('date'),
            category: formData.get('category'),
            amount: parseFloat(formData.get('amount'))
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/expense/add/${propertyId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(expenseData)
            });

            if (response.ok) {
                const updatedProperty = await response.json();
                renderExpenses(propertyId, updatedProperty.expenses);
                event.target.reset();
                showToast('Expense added successfully');
                updatePropertyInCard(updatedProperty);
            } else {
                const errorText = await response.text();
                console.error('Failed to add expense. Status:', response.status, 'Response:', errorText);
                showToast(`Failed to add expense: ${errorText}`, 'error');
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            showToast('Error adding expense', 'error');
        }
    });

    // Edit Expense Form Submit Handler
    document.getElementById('editExpenseForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const expenseId = document.getElementById('editExpenseId').value;
        const propertyId = document.getElementById('editExpensePropertyId').value;
        const date = document.getElementById('editExpenseDate').value;
        const category = document.getElementById('editExpenseCategory').value;
        const amount = parseFloat(document.getElementById('editExpenseAmount').value);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/expense/update/${propertyId}/${expenseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ date, category, amount })
            });
            if (response.ok) {
                const updatedProperty = await response.json();
                showToast('Expense updated successfully.');
                const editExpenseModal = bootstrap.Modal.getInstance(document.getElementById('editExpenseModal'));
                editExpenseModal.hide();
                // A bit of a hack, but we need to refresh the underlying expenses modal
                openExpensesModal(propertyId).catch(err => {
                    console.error('Error refreshing expenses after edit:', err);
                });
                refreshProperty(propertyId);
            } else {
                const errorText = await response.text();
                console.error('Failed to update expense. Status:', response.status, 'Response:', errorText);
                showToast(`Failed to update expense: ${errorText}`, 'error');
            }
        } catch (error) {
            console.error('Error updating expense:', error);
            showToast('Error updating expense', 'error');
        }
    });

    realEstateForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const formData = new FormData(realEstateForm);
        const property = {
            propertyAddress: formData.get('propertyAddress'),
            url: formData.get('propertyURL'),
            value: parseFloat(formData.get('propertyValue')) || 0,
            propertyType: formData.get('propertyType'),
            purchasePrice: parseFloat(formData.get('purchasePrice')) || 0,
            purchaseDate: formData.get('purchaseDate'),
            mortgageBalance: parseFloat(formData.get('mortgageBalance')) || 0
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(property)
            });

            if (response.ok) {
                const newProperty = await response.json();
                showToast('Property added successfully!');
                addPropertyToCard(newProperty);
                realEstateForm.reset();
                // Collapse the accordion
                const collapseOne = document.getElementById('collapseOne');
                const bsCollapse = new bootstrap.Collapse(collapseOne, {
                  toggle: false
                });
                bsCollapse.hide();
                updateTotalRentPaid();

                // Mixpanel tracking
                trackEvent('Property Added', {
                    propertyAddress: property.propertyAddress,
                    propertyValue: property.value,
                    timestamp: new Date().toISOString()
                });

            } else {
                const errorData = await response.json();
                showToast(errorData.message || 'Failed to add property', 'error');
                console.error('Failed to add property:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    editRealEstateForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const propertyId = document.getElementById('editPropertyId').value;
        const formData = new FormData(editRealEstateForm);
        const property = {
            propertyAddress: formData.get('editPropertyAddress'),
            url: formData.get('editPropertyURL'),
            value: parseFloat(formData.get('editPropertyValue')) || 0,
            propertyType: formData.get('editPropertyType'),
            purchasePrice: parseFloat(formData.get('editPurchasePrice')) || 0,
            purchaseDate: formData.get('editPurchaseDate'),
            mortgageBalance: parseFloat(formData.get('editMortgageBalance')) || 0
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/update/${propertyId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(property)
            });

            if (response.ok) {
                const { message, data: updatedProperty } = await response.json();
                showToast(message || 'Property updated successfully!');
                updatePropertyInCard(updatedProperty);
                
                // Hide and reset the edit form
                const editModal = bootstrap.Modal.getInstance(document.getElementById('editPropertyModal'));
                editModal.hide();
                editRealEstateForm.reset();

                refreshProperty(propertyId);
                fetchPortfolioSummary();

                // Mixpanel tracking
                trackEvent('Property Updated', {
                    propertyId: propertyId,
                    propertyAddress: property.propertyAddress,
                    propertyValue: property.value,
                    timestamp: new Date().toISOString()
                });

            } else {
                const errorData = await response.json();
                showToast(errorData.message || 'Failed to update property', 'error');
                console.error('Failed to update property:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    documentUploadForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const formData = new FormData(documentUploadForm);
        const propertyId = propertyIdInput.value;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/uploadDocument', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                showToast(data.message || 'Document uploaded successfully');
                documentUploadForm.reset();
                documentUploadModal.hide();
                viewDocuments(propertyId);

                // Mixpanel tracking
                trackEvent('Document Uploaded', {
                    propertyId: propertyId,
                    documentType: formData.get('documentType'),
                    timestamp: new Date().toISOString()
                });

            } else {
                const errorData = await response.json();
                showToast(errorData.message || 'Failed to upload document.', 'error');
                console.error('Failed to upload document:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    window.viewDocuments = async function(propertyId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/documents/${propertyId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const documents = data.documents;
                displayDocuments(propertyId, documents);
                documentsSection.show();
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch documents:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    function displayDocuments(propertyId, documents) {
        documentsContent.innerHTML = '';

        const groupedDocuments = documents.reduce((acc, doc) => {
            if (!acc[doc.type]) {
                acc[doc.type] = [];
            }
            acc[doc.type].push(doc);
            return acc;
        }, {});

        for (const [type, docs] of Object.entries(groupedDocuments)) {
            const typeHeader = document.createElement('h5');
            typeHeader.textContent = type.replace('_', ' ').toUpperCase();
            documentsContent.appendChild(typeHeader);

            docs.forEach(doc => {
                const docRow = document.createElement('div');
                docRow.classList.add('d-flex', 'justify-content-between', 'mb-2');

                const docLink = document.createElement('a');
                docLink.href = `/${doc.path}`;
                docLink.textContent = `Document uploaded on ${new Date(doc.uploadedAt).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short' })}`;
                docLink.target = '_blank';
                docLink.classList.add('d-block');

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
                deleteButton.setAttribute('data-id', doc._id);
                deleteButton.addEventListener('click', () => deleteDocument(propertyId, doc._id));

                docRow.appendChild(docLink);
                docRow.appendChild(deleteButton);

                documentsContent.appendChild(docRow);
            });
        }
    }

    const exportDocumentsBtn = document.getElementById('exportDocumentsBtn');

    exportDocumentsBtn.addEventListener('click', async function() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/exportDocuments', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'documents.zip';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                showToast('Documents exported successfully');
            } else {
                const errorData = await response.json();
                console.error('Failed to export documents:', errorData);
                showToast('Failed to export documents', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error exporting documents', 'error');
        }
    });

    async function deleteDocument(propertyId, documentId) {
        confirmAction('Are you sure you want to delete this document?', async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/realestate/deleteDocument/${propertyId}/${documentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    showToast('Document deleted successfully');
                    viewDocuments(propertyId); // Refresh the document list
                } else {
                    const errorData = await response.json();
                    console.error('Failed to delete document:', errorData);
                    showToast('Failed to delete document.', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Error deleting document.', 'error');
            }
        });
    }

    async function fetchProperties() {
        if (realEstateOverview) {
            realEstateOverview.innerHTML = '<div class="text-center my-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        }
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/list', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (realEstateOverview) realEstateOverview.innerHTML = '';
            if (response.ok) {
                const properties = await response.json();
                if (properties.length === 0) {
                    realEstateOverview.innerHTML = '<div class="alert alert-info text-center">No properties found. Add your first property!</div>';
                } else {
                    properties.forEach(addPropertyToCard);
                }
                updateTotalEquityValue();
                updateTotalRentPaid();
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch properties:', errorData);
                showToast('Failed to fetch properties', 'error');
                if (realEstateOverview) realEstateOverview.innerHTML = '<div class="alert alert-danger text-center">Could not load properties. Please try again later.</div>';
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error fetching properties', 'error');
            if (realEstateOverview) realEstateOverview.innerHTML = '<div class="alert alert-danger text-center">Could not load properties. Please try again later.</div>';
        }
    }

    async function fetchPropertyDataOnly(propertyId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/property/${propertyId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                return await response.json();
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch property details:', errorData);
                return null;
            }
        } catch (error) {
            console.error('Error:', error);
            return null;
        }
    }

    async function fetchPropertyDetails(propertyId) {
        const property = await fetchPropertyDataOnly(propertyId);
        if (property) {
            currentPropertyId = propertyId;
            showPropertyDetails(property);
            propertyDetailsModal.show();

            // Mixpanel tracking
            trackEvent('Viewed Property Details', {
                propertyId: propertyId,
                propertyAddress: property.propertyAddress,
                timestamp: new Date().toISOString()
            });
        }
    }



    window.renderExpenses = function(propertyId, expenses) {
    const expensesList = document.getElementById('expensesList');
    expensesList.innerHTML = '';

    if (!expenses || expenses.length === 0) {
        expensesList.innerHTML = '<p>No expenses recorded for this property.</p>';
        return;
    }

    const table = document.createElement('table');
    table.classList.add('table', 'table-striped', 'table-hover');
    table.innerHTML = `
        <thead>
            <tr>
                <th scope="col">Date</th>
                <th scope="col">Category</th>
                <th scope="col">Amount</th>
                <th scope="col">Actions</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;

    const tbody = table.querySelector('tbody');
    expenses.forEach(expense => {
        if (!expense || typeof expense.amount !== 'number' || !expense._id) {
            console.error('Skipping invalid expense object:', expense);
            return;
        }

        const row = tbody.insertRow();
        
        const formattedDate = expense.date ? new Date(expense.date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'N/A';
        const formattedAmount = expense.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

        row.insertCell(0).textContent = formattedDate;
        row.insertCell(1).textContent = expense.category || 'N/A';
        row.insertCell(2).textContent = formattedAmount;

        const actionsCell = row.insertCell(3);

        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-outline-primary me-2';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => openEditExpenseModal(expense._id, propertyId));
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger btn-sm';
        deleteButton.innerHTML = '<i class="fa fa-trash"></i> Delete';
        deleteButton.addEventListener('click', () => deleteExpense(propertyId, expense._id));
        actionsCell.appendChild(deleteButton);
    });

    expensesList.appendChild(table);
}

window.deleteExpense = async function(propertyId, expenseId) {
    confirmAction('Are you sure you want to delete this expense?', async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/expense/delete/${propertyId}/${expenseId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const updatedProperty = await response.json();
                renderExpenses(propertyId, updatedProperty.data.expenses);
                showToast('Expense deleted successfully');
                refreshProperty(propertyId);
                fetchPortfolioSummary();
            } else {
                console.error('Failed to delete expense');
                showToast('Failed to delete expense', 'error');
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
            showToast('Error deleting expense', 'error');
        }
    });
}

window.openEditModal = async function(propertyId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/realestate/property/${propertyId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch property details.');
        }

        const property = await response.json();

        document.getElementById('editPropertyId').value = property._id;
        document.getElementById('editPropertyAddress').value = property.propertyAddress;
        document.getElementById('editPropertyURL').value = property.url;
        document.getElementById('editPropertyValue').value = property.value;
        document.getElementById('editPropertyType').value = property.propertyType;
        document.getElementById('editPurchasePrice').value = property.purchasePrice || '';
        if (property.purchaseDate) {
            const date = new Date(property.purchaseDate);
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            document.getElementById('editPurchaseDate').value = `${year}-${month}-${day}`;
        } else {
            document.getElementById('editPurchaseDate').value = '';
        }
        document.getElementById('editMortgageBalance').value = property.mortgageBalance || '';

        const editModal = new bootstrap.Modal(document.getElementById('editPropertyModal'));
        editModal.show();
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast('Could not load property data for editing.', 'error');
    }
};

function addPropertyToCard(property) {
    // Validate property data
    if (!property || typeof property !== 'object') {
        console.error('Invalid property data:', property);
        return;
    }

    // --- NEW METRICS --- 
    const appreciation = property.appreciation || 0;
    const noi = property.noi || 0;
    const capRate = property.capRate || 0;
    const cocReturn = property.cocReturn || 0;
    const purchasePrice = property.purchasePrice || 0;

    // 1. Appreciation Badge
    const appreciationPercent = (appreciation * 100).toFixed(1);
    const appreciationClass = appreciation >= 0 ? 'text-success' : 'text-danger';
    const appreciationIcon = appreciation >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    const appreciationBadge = purchasePrice > 0 
        ? `<span class="ms-2 small ${appreciationClass}" style="font-size: 0.8em; vertical-align: middle;"><i class="fa ${appreciationIcon}"></i> ${appreciationPercent}%</span>` 
        : '';

    // 2. Investment Metrics HTML


    // Ensure required fields exist and are numbers
    const value = typeof property.value === 'number' ? property.value : 0;
    const propertyAddress = property.propertyAddress;
    const url = property.url || '#';
    const id = property._id;
    const propertyType = property.propertyType || 'N/A';
    const badgeClass = getPropertyTypeBadgeClass(propertyType);
    const purchaseDate = property.purchaseDate ? new Date(property.purchaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const totalExpenses = (property.expenses && Array.isArray(property.expenses)) ? property.expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0) : 0;
    const equity = value - (property.mortgageBalance || 0);

    if (!id) {
        console.error('Property missing ID:', property);
        return;
    }

    // Modern Bootstrap 5 Card UI
    const card = document.createElement('div');
    card.className = 'col-12 col-sm-6 col-lg-6 mb-4';
    card.innerHTML = `
        <div class="card shadow-lg rounded-4 border-0 h-100 bg-light card-hover-effect" data-id="${id}" style="transition: box-shadow 0.2s;">
            <div class="card-body pb-2">
                <div class="d-flex align-items-center mb-3" style="gap: 0.5rem;">
                    <div class="icon-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:44px;height:44px;">
                        <a href="${url}" target="_blank" class="text-decoration-none"><i class="fa fa-link text-primary fs-4"></i></a>
                    </div>
                    <h5 class="card-title mb-0 flex-grow-1 fw-bold fs-5" style="letter-spacing:0.5px;">${propertyAddress}</h5>
                    <span class="badge rounded-pill ${badgeClass} px-3 py-1 property-type-container shadow-sm me-2" data-property-id="${id}" style="font-size:0.95em;">${propertyType}</span>
                    <div class="dropdown">
                        <a class="dropdown-toggle btn btn-outline-secondary btn-sm" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="margin-left:2px;">
                            <i class="fa fa-ellipsis-v"></i>
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item edit-btn" href="#">Edit</a></li>
                            <li><a class="dropdown-item delete-btn" href="#">Delete</a></li>
                        </ul>
                    </div>
                </div>
                <div class="text-center mb-3">
                    <div class="d-flex align-items-center justify-content-center mx-auto rounded-circle shadow border border-2 bg-white" style="width:80px; height:80px;"><i class="fa fa-home text-primary" style="font-size:2.5rem;"></i></div>
                </div>
                <div class="row text-center mb-3">
                    <div class="col">
                        <div class="text-muted small"><i class="fa fa-hand-holding-usd me-1"></i>Equity</div>
                        <div class="fw-bold text-success property-equity fs-5">${equity.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
                    </div>
                    <div class="col">
                        <div class="text-muted small"><i class="fa fa-dollar-sign me-1"></i>Zestimate</div>
                        <div class="fw-bold text-primary property-value fs-5">${value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}<br>${appreciationBadge}</div>
                    </div>
                    <div class="col">
                        <div class="text-muted small"><i class="fa fa-credit-card me-1"></i>Mortgage</div>
                        <div class="fw-bold text-danger property-mortgage fs-5">${(property.mortgageBalance || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
                    </div>
                </div>



                <hr class="my-3" style="opacity:0.12;">
                <div class="text-center">
                    <button class="btn btn-info me-2 waves-effect waves-light view-details-btn btn-sm">
                        <i class="fa fa-eye"></i> View Details
                    </button>
                    <button class="btn btn-secondary me-2 waves-effect waves-light property-docs-btn btn-sm">
                        <i class="fa fa-file-alt"></i> Property Docs
                    </button>
                    <button class="btn btn-warning me-2 waves-effect waves-light manage-expenses-btn btn-sm">
                        <i class="fa fa-money-bill-wave btn-sm"></i> Manage Expenses
                    </button>
                </div>
            </div>
        </div>
    `;
    realEstateOverview.appendChild(card);

    // Event Listeners for View Details Button
    const viewDetailsBtn = card.querySelector('.view-details-btn');
    if (viewDetailsBtn) {
        viewDetailsBtn.addEventListener('click', function() {
            fetchPropertyDetails(id);
        });
    }

    const propertyDocsBtn = card.querySelector('.property-docs-btn');
    if (propertyDocsBtn) {
        propertyDocsBtn.addEventListener('click', () => {
            openPropertyDocsModal(id);
        });
    }

    const manageExpensesBtn = card.querySelector('.manage-expenses-btn');
    if (manageExpensesBtn) {
        manageExpensesBtn.addEventListener('click', () => {
            openExpensesModal(id);
        });
    }

    // Event Listeners for Edit and Delete Buttons
    const editBtn = card.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function(event) {
            event.preventDefault();
            openEditModal(id);
        });
    }

    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            const cardTitle = card.querySelector('.card-title');
            const propertyAddress = cardTitle ? cardTitle.textContent.trim() : 'this property';
            confirmAction(`Are you sure you want to delete ${propertyAddress}? This action cannot be undone.`, async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/realestate/delete/${id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (response.ok) {
                        card.remove();
                        updateTotalEquityValue();
                        updateTotalRentPaid();
                        showToast('Property deleted successfully.');
                        trackEvent('Property Deleted', {
                            propertyId: id,
                            propertyAddress: propertyAddress,
                            timestamp: new Date().toISOString()
                        });
                        refreshProperty(id);
                        fetchPortfolioSummary();
                    } else {
                        const errorData = await response.json();
                        console.error('Failed to delete property:', errorData);
                        showToast('Failed to delete property.', 'error');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    showToast('An error occurred while deleting the property.', 'error');
                }
            });
        });
    }
    updateTotalEquityValue();
}

function updatePropertyInCard(property) {
    const cardToUpdate = document.querySelector(`.card[data-id="${property._id}"]`);
    if (!cardToUpdate) return;

    const value = typeof property.value === 'number' ? property.value : 0;
    const ownershipValue = value;
    const badgeClass = getPropertyTypeBadgeClass(property.propertyType);

    // Add null check for card title
    const cardTitle = cardToUpdate.querySelector('.card-title');
    if (cardTitle) {
        cardTitle.innerHTML = `<i class="fa fa-home text-primary"></i> ${property.propertyAddress}`;
    }
    
    // Add null check for href element
    const hrefElement = cardToUpdate.querySelector('a[href^="https://"]');
    if (hrefElement) {
        hrefElement.href = property.url;
    }
    
    // Add null check for property type container
    const propertyTypeContainer = cardToUpdate.querySelector('.property-type-container');
    if (propertyTypeContainer) {
        propertyTypeContainer.innerHTML = `<span class="badge ${badgeClass}">${property.propertyType}</span>`;
    }
    
    const valueElement = cardToUpdate.querySelector('.card-text:nth-of-type(2)');
    if(valueElement) valueElement.innerHTML = `<span class="badge bg-primary">Value:</span> ${value.toLocaleString('en-US', { style: 'currency', 'currency': 'USD' })}`;
    
    const principalElement = cardToUpdate.querySelector('.card-text:nth-of-type(3)');
    if(principalElement) principalElement.innerHTML = `<span class="badge bg-info">Principal:</span> ${ownershipValue.toLocaleString('en-US', { style: 'currency', 'currency': 'USD' })}`;

    // Re-attach listeners as they might be lost in DOM manipulation
    const editBtn = cardToUpdate.querySelector('.edit-btn');
    const deleteBtn = cardToUpdate.querySelector('.delete-btn');
    const viewDetailsBtn = cardToUpdate.querySelector('.view-details-btn');
    const uploadDocBtn = cardToUpdate.querySelector('button[onclick^="openDocumentUploadModal"]');
    const viewDocsBtn = cardToUpdate.querySelector('button[onclick^="viewDocuments"]');
    
    // Add null check for edit button before adding event listener
    if (editBtn) {
        editBtn.addEventListener('click', function(event) {
             event.preventDefault();  // Prevents the default action of scrolling to the top
             
             const editAccordionItem = document.getElementById('editPropertyAccordionItem');
             if (editAccordionItem) {
                 editAccordionItem.style.display = 'block';
             }
 
             const collapseEdit = document.getElementById('collapseEdit');
             if (collapseEdit) {
                 const bsCollapse = new bootstrap.Collapse(collapseEdit, { toggle: false });
                 bsCollapse.show();
             }
             
             const editPropertyIdElement = document.getElementById('editPropertyId');
             if (editPropertyIdElement) {
                 editPropertyIdElement.value = property._id;
             }
             
             // Fetch full property details to populate the form
             fetch(`/realestate/property/${property._id}`, {
                 headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
             })
             .then(response => response.json())
             .then(property => {
                  const editPropertyAddress = document.getElementById('editPropertyAddress');
                  const editPropertyURL = document.getElementById('editPropertyURL');
                  const editPropertyValue = document.getElementById('editPropertyValue');
                  const editPropertyType = document.getElementById('editPropertyType');
                  const editPurchasePrice = document.getElementById('editPurchasePrice');
                  const editPurchaseDate = document.getElementById('editPurchaseDate');
                  
                  if (editPropertyAddress) editPropertyAddress.value = property.propertyAddress;
                  if (editPropertyURL) editPropertyURL.value = property.url;
                  if (editPropertyValue) editPropertyValue.value = property.value;
                  if (editPropertyType) editPropertyType.value = property.propertyType;
                  if (editPurchasePrice) editPurchasePrice.value = property.purchasePrice;
                  if (editPurchaseDate) editPurchaseDate.value = property.purchaseDate ? new Date(property.purchaseDate).toISOString().split('T')[0] : '';
             });
          });
    }
}

async function refreshProperty(propertyId) {
    try {
        const updatedProperty = await fetchPropertyDataOnly(propertyId);
        if (updatedProperty) {
            updatePropertyInCard(updatedProperty);
        }
    } catch (error) {
        console.error(`Error refreshing property ${propertyId}:`, error);
        showToast('Could not refresh property details.', 'error');
    }
}

    // Add event listener for property type editing
    document.getElementById('realEstateOverview').addEventListener('click', function(event) {
        const propertyTypeContainer = event.target.closest('.property-type-container');
        if (propertyTypeContainer) {
            // Prevent multiple dropdowns
            if (propertyTypeContainer.querySelector('select')) {
                return;
            }

            const propertyId = propertyTypeContainer.dataset.propertyId;
            const badge = propertyTypeContainer.querySelector('.badge');
            
            // Add null check for badge
            if (!badge) {
                console.warn('Badge element not found in property type container');
                return;
            }
            
            const currentType = badge.textContent;
            
            // Hide badge
            badge.style.display = 'none';

            // Create and show select
            const select = document.createElement('select');
            select.className = 'form-select form-select-sm';
            const types = ['Primary Residence', 'Long-Term Rental', 'Short-Term Rental'];
            
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                if (type === currentType) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            propertyTypeContainer.appendChild(select);
            select.focus();

            // Handle selection change or blur
            const updateType = async () => {
                const newType = select.value;
                
                // If type hasn't changed, just revert UI
                if (newType === currentType) {
                    badge.style.display = '';
                    select.remove();
                    return;
                }

                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/realestate/update/${propertyId}/type`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ propertyType: newType })
                    });

                    if (response.ok) {
                        const updatedProperty = await response.json();
                        updatePropertyInCard(updatedProperty);
                        showToast('Property type updated successfully.');
                        refreshProperty(propertyId);
                        fetchPortfolioSummary();
                    } else {
                        showToast('Failed to update property type.', 'error');
                        // Revert on failure
                        badge.style.display = '';
                        select.remove();
                    }
                } catch (error) {
                    console.error('Error updating property type:', error);
                    showToast('An error occurred.', 'error');
                    badge.style.display = '';
                    select.remove();
                }
            };
            
            select.addEventListener('change', updateType);
            select.addEventListener('blur', () => {
                // Revert if it loses focus without changing
                if (select.value === currentType) {
                    badge.style.display = '';
                    select.remove();
                }
            });
        }
    });

    function showPropertyDetails(property) {
        if (!property || typeof property !== 'object') {
            console.error('Invalid property data:', property);
            return;
        }

        const { propertyAddress, url, value, propertyType, rentCollected, shortTermIncome, _id, noi, capRate, cocReturn, expenses } = property;
        const totalExpenses = (expenses && Array.isArray(expenses)) ? expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0) : 0;
        const purchaseDate = property.purchaseDate ? new Date(property.purchaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
        const propertyDetailsContent = document.getElementById('propertyDetailsContent');
        
        // Add null check for propertyDetailsModal
        const propertyDetailsModalElement = document.getElementById('propertyDetailsModal');
        if (!propertyDetailsModalElement) {
            console.error('Property details modal not found');
            return;
        }
        
        const modalFooter = propertyDetailsModalElement.querySelector('.modal-footer');
        const propertyDetailsModal = new bootstrap.Modal(propertyDetailsModalElement);

        const formatCurrency = (val) => (val || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const formatPercent = (val) => `${((val || 0) * 100).toFixed(2)}%`;

        let detailsHtml = `
        <div class="container-fluid">
            <div class="text-center my-3">
                <h3>${propertyAddress}</h3>
                <a href="${url}" target="_blank" class="text-muted">View on Zillow</a>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">Key Info</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Property Value
                                <span class="fw-bold text-success">${formatCurrency(value)}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Purchased
                                <span>${purchaseDate}</span>
                            </li>
                        </ul>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">Financial Performance</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span><i class="fa fa-wallet me-2 text-primary"></i>NOI <i class="fa fa-question-circle text-muted ms-1" data-bs-toggle="tooltip" title="Net Operating Income: Annual income after operating expenses."></i></span>
                                <span>${formatCurrency(noi)}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span><i class="fa fa-percentage me-2 text-primary"></i>Cap Rate <i class="fa fa-question-circle text-muted ms-1" data-bs-toggle="tooltip" title="Capitalization Rate: Rate of return based on property's net operating income."></i></span>
                                <span>${formatPercent(capRate)}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span><i class="fa fa-cash-register me-2 text-primary"></i>CoC Return <i class="fa fa-question-circle text-muted ms-1" data-bs-toggle="tooltip" title="Cash-on-Cash Return: Measures the annual return on the cash invested in the property."></i></span>
                                <span>${formatPercent(cocReturn)}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span><i class="fa fa-receipt me-2 text-primary"></i>Expenses</span>
                                <span>${formatCurrency(totalExpenses)}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;

        let footerHtml = '';

        if (propertyType === 'Primary Residence') {
            detailsHtml += '<div class="alert alert-info text-center">This is your primary residence. No income is tracked.</div>';
            footerHtml = ''; // No footer for primary residence
        } else if (propertyType === 'Long-Term Rental') {
            let totalCollected = 0;
            const rentRows = Object.entries(rentCollected || {}).map(([month, details]) => {
                const amount = typeof details.amount === 'number' ? details.amount : 0;
                const collected = details.collected || false;
                if (collected) {
                    totalCollected += amount;
                }
                return `
                    <tr>
                        <td>${month}</td>
                        <td>${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                        <td><span class="badge ${collected ? 'bg-success' : 'bg-danger'}">${collected ? 'Collected' : 'Incomplete'}</span></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-primary edit-rent-btn" data-id="${_id}" data-month="${month}" data-amount="${amount}">Edit</button>
                            <button class="btn btn-sm btn-success mark-collected-btn" data-id="${_id}" data-month="${month}">Mark as Collected</button>
                        </td>
                    </tr>
                `;
            }).join('');

            detailsHtml += `
                <div class="card mt-3">
                    <div class="card-header">Rent Collection Status</div>
                    <div class="table-responsive">
                        <table class="table table-striped table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rentRows}
                            </tbody>
                        </table>
                    </div>
                    <div class="card-footer text-end">
                        <strong>Total Collected:</strong> ${formatCurrency(totalCollected)}
                    </div>
                </div>
            `;

            footerHtml = `
                <div class="container-fluid">
                    <div class="row mb-3">
                        <div class="col-md-4"><label for="rentStartMonth" class="form-label">Start of Rental Term:</label></div>
                        <div class="col-md-8"><input type="month" id="rentStartMonth" class="form-control"></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-md-4"><label for="rentEndMonth" class="form-label">End of Rental Term:</label></div>
                        <div class="col-md-8"><input type="month" id="rentEndMonth" class="form-control"></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-md-4"><label for="rentAmount" class="form-label">Monthly Rent Value:</label></div>
                        <div class="col-md-8"><input type="number" id="rentAmount" class="form-control" placeholder="$..."></div>
                    </div>
                    <div class="row"><div class="col-md-12 text-end"><button type="button" class="btn btn-primary" id="addRentPaymentBtn">Add Rent Payment</button></div></div>
                </div>
            `;
        } else if (propertyType === 'Short-Term Rental') {
            let totalIncome = 0;
            const incomeRows = (shortTermIncome || []).sort((a, b) => new Date(b.date) - new Date(a.date)).map(income => {
                totalIncome += income.amount;
                const incomeDate = new Date(income.date).toLocaleDateString('en-US', { timeZone: 'UTC' });
                return `
                    <tr>
                        <td>${incomeDate}</td>
                        <td>${income.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                        <td>${income.notes || ''}</td>
                        <td><button class="btn btn-sm btn-danger delete-str-income-btn" data-id="${_id}" data-income-id="${income._id}">Delete</button></td>
                    </tr>
                `;
            }).join('');

            detailsHtml += `
                <div class="card mt-3">
                    <div class="card-header">Short-Term Income</div>
                    <div class="table-responsive">
                        <table class="table table-striped table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${incomeRows}
                            </tbody>
                        </table>
                    </div>
                    <div class="card-footer text-end">
                        <strong>Total Income:</strong> ${formatCurrency(totalIncome)}
                    </div>
                </div>
            `;

            footerHtml = `
                <div class="container-fluid">
                    <h6 class="mb-3">Add New Income</h6>
                    <div class="row mb-3 gy-2">
                        <div class="col-md-4"><label for="strIncomeDate" class="form-label visually-hidden">Date:</label><input type="date" id="strIncomeDate" class="form-control"></div>
                        <div class="col-md-4"><label for="strIncomeAmount" class="form-label visually-hidden">Amount:</label><input type="number" id="strIncomeAmount" class="form-control" placeholder="Amount ($)"></div>
                        <div class="col-md-4"><label for="strIncomeNotes" class="form-label visually-hidden">Notes:</label><input type="text" id="strIncomeNotes" class="form-control" placeholder="Notes (Optional)"></div>
                    </div>
                    <div class="row"><div class="col-md-12 text-end"><button type="button" class="btn btn-primary" id="addStrIncomeBtn">Add Income</button></div></div>
                </div>
            `;
        }

        propertyDetailsContent.innerHTML = detailsHtml;
        modalFooter.innerHTML = footerHtml;

        // Initialize tooltips within the modal
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('#propertyDetailsModal [data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });

        propertyDetailsModal.show();

        // Re-attach event listeners based on property type
        if (propertyType === 'Long-Term Rental') {
            document.querySelectorAll('.edit-rent-btn').forEach(button => button.addEventListener('click', function() {
                editRentDetails(this.getAttribute('data-id'), this.getAttribute('data-month'), this.getAttribute('data-amount'));
            }));
            document.querySelectorAll('.mark-collected-btn').forEach(button => button.addEventListener('click', function() {
                markRentAsCollected(this.getAttribute('data-id'), this.getAttribute('data-month'));
            }));
            document.getElementById('addRentPaymentBtn')?.addEventListener('click', () => {
                const startMonth = document.getElementById('rentStartMonth').value;
                const endMonth = document.getElementById('rentEndMonth').value;
                const amount = document.getElementById('rentAmount').value;
                if(startMonth && endMonth && amount) {
                    addRentPayment(_id, startMonth, endMonth, amount);
                } else {
                    showToast('Please fill all fields for rent payment.', 'error');
                }
            });
        } else if (propertyType === 'Short-Term Rental') {
            document.getElementById('addStrIncomeBtn')?.addEventListener('click', () => addShortTermIncome(_id));
            document.querySelectorAll('.delete-str-income-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const incomeId = this.getAttribute('data-income-id');
                    confirmAction('Are you sure you want to delete this income entry?', () => deleteShortTermIncome(_id, incomeId));
                });
            });
        }
    }

    async function addShortTermIncome(propertyId) {
        const date = document.getElementById('strIncomeDate').value;
        const amount = document.getElementById('strIncomeAmount').value;
        const notes = document.getElementById('strIncomeNotes').value;

        if (!date || !amount) {
            showToast('Please provide a date and amount.', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/income/short-term/add/${propertyId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ date, amount: parseFloat(amount), notes })
            });

            if (response.ok) {
                showToast('Income added successfully.');
                fetchPropertyDetails(propertyId); // Refresh modal content
                refreshProperty(propertyId);
                fetchPortfolioSummary();
            } else {
                const errorData = await response.json();
                showToast(`Failed to add income: ${errorData.message}`, 'error');
            }
        } catch (error) {
            console.error('Error adding short-term income:', error);
            showToast('An error occurred while adding income.', 'error');
        }
    }

    async function deleteShortTermIncome(propertyId, incomeId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/income/short-term/delete/${propertyId}/${incomeId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                showToast('Short-term income deleted successfully');
                fetchPropertyDetails(propertyId); // Refresh modal content
                refreshProperty(propertyId);
                fetchPortfolioSummary();
            } else {
                const errorData = await response.json();
                showToast(`Failed to delete income: ${errorData.message}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting short-term income:', error);
            showToast('An error occurred while deleting income.', 'error');
        }
    }

    function editRentDetails(propertyId, month, amount) {
        const propertyCard = document.querySelector(`[data-id="${propertyId}"]`);
        const propertyAddress = propertyCard ? propertyCard.querySelector('.card-title').textContent.trim() : 'this property';
        const newAmount = prompt(`Enter new rent amount for ${month} at ${propertyAddress}:`, amount);
        if (newAmount !== null) {
            updateRentDetails(propertyId, month, false, parseFloat(newAmount));
        }
    }

    async function updateRentDetails(propertyId, month, collected, amount = null) {
        try {
            const token = localStorage.getItem('token');
            const payload = { collected };
            if (amount !== null) payload.amount = amount;

            const response = await fetch(`/realestate/rent/collect/${propertyId}/${month}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const { message, data: updatedProperty } = await response.json();
                showToast(message || 'Rent status updated');
                updatePropertyInCard(updatedProperty);
                // Optionally, you can update the specific rent details in the modal if it's open
                refreshProperty(propertyId);
                fetchPortfolioSummary();
            } else {
                const errorData = await response.json();
                showToast(errorData.message || 'Failed to update rent status', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function markRentAsCollected(propertyId, month) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/rent/collect/${propertyId}/${month}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ collected: true })
            });

            if (response.ok) {
                const { message, data: updatedProperty } = await response.json();
                showToast(message || 'Rent marked as collected');
                updatePropertyInCard(updatedProperty);
                // Optionally, you can update the specific rent details in the modal if it's open
                refreshProperty(propertyId);
                fetchPortfolioSummary();
            } else {
                const errorData = await response.json();
                showToast(errorData.message || 'Failed to mark rent as collected', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function fetchTotalRentCollected() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/totalRentCollected', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                let percentageCollected;
                if (data.totalExpected === 0) {
                    percentageCollected = 0;
                } else {
                    percentageCollected = (data.totalCollected / data.totalExpected) * 100;
                }
                renderRentCollectedChart(percentageCollected);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch total rent collected:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function renderRentCollectedChart(percentage) {
        var options = {
            chart: {
                height: 225,
                type: 'radialBar',
            },
            plotOptions: {
                radialBar: {
                    hollow: {
                        size: '60%',
                    },
                    dataLabels: {
                        showOn: 'always',
                        name: {
                            show: true,
                            fontSize: '14px',
                        },
                        value: {
                            show: true,
                            fontSize: '18px',
                            formatter: function(val) {
                                return val.toFixed(2) + "%";
                            }
                        }
                    }
                }
            },
            series: [percentage],
            colors: ['#003087', '#009cde', '#012169'],
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: "vertical",
                    shadeIntensity: 0.5,
                    gradientToColors: ['#009cde', '#003087'],
                    inverseColors: true,
                    opacityFrom: 1,
                    opacityTo: 1,
                    stops: [0, 100]
                }
            },
            labels: ['Rent Collection']
        };

        var chart = new ApexCharts(document.querySelector("#totalRentPaidChart"), options);
        chart.render();
    }

    async function fetchTotalUnpaidRent() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/totalUnpaidRent', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const unpaidRentElement = document.getElementById('unpaidRent');
                if (unpaidRentElement) {
                    unpaidRentElement.textContent = data.totalUnpaidRent.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                }

                trackEvent('Total Unpaid Rent Viewed', {
                    totalUnpaidRent: data.totalUnpaidRent,
                    timestamp: new Date().toISOString()
                });
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch total unpaid rent:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function getMonthRange(startDate, endDate) {
        const start = new Date(startDate + '-01');
        const end = new Date(endDate + '-01');
        const months = [];

        let current = new Date(start);
        while (current <= end) {
            months.push(current.toISOString().slice(0, 7)); // Format as YYYY-MM
            current.setMonth(current.getMonth() + 1);
        }

        if (!months.includes(end.toISOString().slice(0, 7))) {
            months.push(end.toISOString().slice(0, 7));
        }

        return months;
    }

    async function addRentPayment(propertyId, startDate, endDate, amount) {
        try {
            const token = localStorage.getItem('token');
            const months = getMonthRange(startDate, endDate);
            let success = true;

            for (const month of months) {
                const response = await fetch(`/realestate/rent/pay/${propertyId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        amount, 
                        startDate: month, 
                        endDate: month 
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Failed to add rent payment for', month, ':', errorData);
                    success = false;
                }
            }

            if (success) {
                // Only refresh the property details and update totals if all payments were successful
                await fetchPropertyDetails(propertyId);
                await updateTotalRentPaid();
                refreshProperty(propertyId);
                fetchPortfolioSummary();
                // Clear the form
                rentStartMonthInput.value = '';
                rentEndMonthInput.value = '';
                rentAmountInput.value = '';
            } else {
                showToast('Some rent payments could not be added. Please check the console for details.', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('An error occurred while adding rent payments. Please try again.', 'error');
        }
    }

    document.getElementById('closePropertyDetails').addEventListener('click', function() {
        propertyDetailsModal.hide();
        propertyDetailsContent.innerHTML = '';
    });

    async function fetchCashFlowData() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/cashFlow', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const months = data.map(item => item.month);
                const cashFlows = data.map(item => item.cashFlow);
                renderCashFlowChart(months, cashFlows);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch cash flow data:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function updateTotalRentPaid() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/totalRentPaid', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const totalRentPaidElement = document.getElementById('totalRentPaid');
                totalRentPaidElement.textContent = data.totalRentPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch total rent paid:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function fetchTotalOverdueRent() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/realestate/totalOverdueRent', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const overdueRentElement = document.getElementById('overdueRent');
                if (overdueRentElement) {
                    overdueRentElement.textContent = data.totalOverdueRent.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                }

                trackEvent('Total Overdue Rent Viewed', {
                    totalOverdueRent: data.totalOverdueRent,
                    timestamp: new Date().toISOString()
                });
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch total overdue rent:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function fetchUpcomingRentNotifications() {
        try {
            const token = localStorage.getItem('token');
            console.log('Fetching upcoming rent notifications');
            const response = await fetch('/realestate/rent/upcoming', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const notifications = await response.json();
                console.log('Notifications fetched:', notifications);
                displayNotifications(notifications);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch upcoming rent notifications:', errorData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function displayNotifications(notifications) {
        const notificationsList = document.getElementById('notificationsList');
        notificationsList.innerHTML = '';

        if (notifications.length === 0) {
            notificationsList.innerHTML = '<p>You have no notifications at this time.</p>';
            console.log('No notifications to display.');
            return;
        }

        notifications.forEach(notification => {
            console.log('Displaying notification:', notification);
            const notificationElement = document.createElement('div');
            notificationElement.className = 'alert alert-warning';
            notificationElement.innerHTML = `
                <i class="fa fa-exclamation-triangle"></i>
                Time to collect the ${notification.month} rent of 
                ${notification.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} 
                for ${notification.propertyAddress}.
            `;
            notificationsList.appendChild(notificationElement);
        });
    }

    function renderCashFlowChart(months, cashFlows) {
        var options = {
            chart: {
                type: 'area',
                height: 350,
                zoom: {
                    enabled: false
                },
                toolbar: {
                    show: false
                }
            },
            dataLabels: {
                enabled: false
            },
            series: [{
                name: 'Cash Flow',
                data: cashFlows
            }],
            xaxis: {
                categories: months,
                labels: {
                    type: 'dates',
                }
            },
            yaxis: {
                title: {
                    text: 'Cash Flow ($)'
                },
                labels: {
                    formatter: function(value) {
                        return value.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                    }
                }
            },
            colors: ['#0070ba'],
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: 'horizontal',
                    shadeIntensity: 0.5,
                    gradientToColors: ['#003087'],
                    inverseColors: false,
                    opacityFrom: 0.5,
                    opacityTo: 0.5,
                    stops: [0, 100]
                }
            },
            grid: {
                show: false
            },
            tooltip: {
                x: {
                    type: 'dates',
                },
                y: {
                    formatter: function(value) {
                        return value.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                    }
                }
            },
            legend: {
                show: false
            }
        };

        var chart = new ApexCharts(document.querySelector("#cashFlowChart"), options);
        chart.render();
    }

    function updateTotalEquityValue() {
        const propertyCards = document.querySelectorAll('#realEstateOverview .card');
        const totalEquityValueElement = document.getElementById('totalEquityValue');
        
        // Add null check for totalEquityValueElement
        if (!totalEquityValueElement) {
            console.warn('Total equity value element not found');
            return;
        }
        
        let totalEquity = 0;

        propertyCards.forEach(card => {
            const propertyEquityElement = card.querySelector('.property-equity');

            if (propertyEquityElement) {
                const equityText = propertyEquityElement.textContent;
                const propertyEquity = parseFloat(equityText.replace(/[^0-9.-]+/g, ""));
                if (!isNaN(propertyEquity)) {
                    totalEquity += propertyEquity;
                }
            }
        });

        totalEquityValueElement.innerHTML = `${totalEquity.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
    }

    // =================================================================================
    // Document Management Functions
    // =================================================================================

    async function openPropertyDocsModal(propertyId) {
        const propertyIdForDocUpload = document.getElementById('propertyIdForDocUpload');
        if (propertyIdForDocUpload) {
            propertyIdForDocUpload.value = propertyId;
        }
        
        const documentList = document.getElementById('documentList');
        if (documentList) {
            documentList.innerHTML = '<li class="list-group-item">Loading documents...</li>';
        }

        const propertyDocsModalElement = document.getElementById('propertyDocsModal');
        if (!propertyDocsModalElement) {
            console.error('Property docs modal not found');
            return;
        }
        
        const propertyDocsModal = new bootstrap.Modal(propertyDocsModalElement);
        propertyDocsModal.show();

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/${propertyId}/documents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 404) {
                if (documentList) {
                    documentList.innerHTML = '<li class="list-group-item">No documents found for this property.</li>';
                }
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch documents. Please ensure the backend route exists.');
            }

            const documents = await response.json();
            populateDocumentList(documents, propertyId);
        } catch (error) {
            console.error('Error fetching documents:', error);
            if (documentList) {
                documentList.innerHTML = `<li class="list-group-item text-danger">${error.message}</li>`;
            }
        }
    }

    function populateDocumentList(documents, propertyId) {
        const documentList = document.getElementById('documentList');
        if (!documentList) {
            console.warn('Document list element not found');
            return;
        }
        
        documentList.innerHTML = '';

        if (!documents || documents.length === 0) {
            documentList.innerHTML = '<li class="list-group-item">No documents found for this property.</li>';
            return;
        }

        documents.forEach(doc => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';

            const docName = document.createElement('span');
            docName.className = 'document-name';
            docName.textContent = doc.name;

            const actionsDiv = document.createElement('div');

            const downloadLink = document.createElement('a');
            downloadLink.href = doc.url;
            downloadLink.target = '_blank';
            downloadLink.className = 'btn btn-outline-primary btn-sm me-2';
            downloadLink.innerHTML = '<i class="fas fa-download"></i> Download';

            const renameButton = document.createElement('button');
            renameButton.className = 'btn btn-outline-warning btn-sm me-2';
            renameButton.innerHTML = '<i class="fas fa-edit"></i> Rename';
            renameButton.addEventListener('click', () => renameDocument(propertyId, doc._id, doc.name));

            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-outline-danger btn-sm';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete';
            deleteButton.addEventListener('click', () => deleteDocument(propertyId, doc._id));

            actionsDiv.appendChild(downloadLink);
            actionsDiv.appendChild(renameButton);
            actionsDiv.appendChild(deleteButton);

            li.appendChild(docName);
            li.appendChild(actionsDiv);

            documentList.appendChild(li);
        });
    }

    async function renameDocument(propertyId, docId, currentName) {
        const newName = prompt('Enter the new name for the document:', currentName);

        if (!newName || newName.trim() === '') {
            return; // User cancelled or entered an empty name
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/${propertyId}/documents/${docId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to rename document.');
            }

            const updatedData = await response.json();
            populateDocumentList(updatedData.documents, propertyId);
        } catch (error) {
            console.error('Rename error:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async function deleteDocument(propertyId, docId) {
        if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/realestate/${propertyId}/documents/${docId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete document.');
            }

            const updatedData = await response.json();
            populateDocumentList(updatedData.documents, propertyId);
        } catch (error) {
            console.error('Delete error:', error);
            alert(`Error: ${error.message}`);
        }
    }

    // =================================================================================
    // Page Initialization
    // =================================================================================

    function initializePage() {
        console.log('Starting page initialization...');
        
        Promise.all([
            fetchProperties(),
            fetchTotalUnpaidRent(),
            fetchTotalRentCollected(),
            fetchTotalOverdueRent(),
            fetchCashFlowData(),
            fetchUpcomingRentNotifications(),
            fetchPortfolioSummary()
        ]).catch(error => {
            console.error('Error during initialization:', error);
        });
    }

    // Initialize the page
    initializePage();

    // Expose functions to global scope to be called from HTML
    window.openExpensesModal = openExpensesModal;
    window.openDocumentUploadModal = openDocumentUploadModal;
    window.viewDocuments = viewDocuments;
    window.openPropertyDocsModal = openPropertyDocsModal;
    window.renameDocument = renameDocument;
    window.deleteDocument = deleteDocument;

    // Add event listener for the document upload form
    const propertyDocUploadForm = document.getElementById('propertyDocUploadForm');
    if (propertyDocUploadForm) {
        propertyDocUploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const propertyId = document.getElementById('propertyIdForDocUpload').value;
            const documentName = document.getElementById('newDocumentName').value;
            const fileInput = document.getElementById('newDocumentFile');
            const file = fileInput.files[0];

            if (!file) {
                alert('Please select a file to upload.');
                return;
            }

            const formData = new FormData();
            formData.append('document', file);
            formData.append('name', documentName);

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/realestate/${propertyId}/documents`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to upload document.');
                }

                const updatedData = await response.json();
                populateDocumentList(updatedData.documents, propertyId);
                document.getElementById('propertyDocUploadForm').reset();
            } catch (error) {
                console.error('Upload error:', error);
                alert(`Error: ${error.message}`);
            }
        });
    }
});