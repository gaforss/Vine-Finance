document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOMContentLoaded event fired');
    await updateFirstnamePlaceholder();
    console.log('Firstname placeholder updated');
    await populateProfileForm();
    console.log('Profile form populated');
    await fetchAndPopulateBalances();
    console.log('Balances fetched and populated');

    const linkButton = document.getElementById('link-button');
    if (linkButton) {
        console.log('Link button found, adding click event listener');
        linkButton.addEventListener('click', async () => {
            try {
                console.log('Link button clicked');
                const token = localStorage.getItem('token');
                
                if (!token) {
                    throw new Error('User token not found. Please log in again.');
                }

                const userResponse = await fetch('/auth/api/user', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const userData = await userResponse.json();
                const userId = userData._id;

                const response = await fetch('/plaid/create_link_token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ userId })
                });

                if (!response.ok) {
                    throw new Error(`Failed to create link token. Status: ${response.status}`);
                }

                const data = await response.json();
                console.log('Link token created:', data.link_token);

                console.log('Creating Plaid handler...');
                const handler = Plaid.create({
                    token: data.link_token,
                    onSuccess: async (public_token, metadata) => {
                        console.log('--- PLAID ONSUCCESS ---');
                        const exchangeResponse = await fetch('/plaid/exchange_public_token', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({ public_token, userId, institutionName: metadata.institution.name }),
                        });

                        const exchangeData = await exchangeResponse.json();
                        console.log('Public token exchanged. Fetching balances...');

                        sessionStorage.removeItem('userBalances');
                        await fetchAndPopulateBalances();

                        if (exchangeData.isFirstAccount) {
                            const firstAccountModal = new bootstrap.Modal(document.getElementById('firstAccountModal'));
                            firstAccountModal.show();
                        }
                    },
                    onExit: (err, metadata) => {
                        console.log('--- PLAID ONEXIT ---');
                        if (err != null) {
                            console.error('Plaid Link exit error:', err, metadata);
                        } else {
                            // User exited without an error, likely cancelled.
                            const plaidCancelledModal = new bootstrap.Modal(document.getElementById('plaidCancelledModal'));
                            plaidCancelledModal.show();
                        }
                    },
                    onEvent: (eventName, metadata) => {
                        console.log(`--- PLAID ONEVENT: ${eventName} ---`, metadata);
                    }
                });
                console.log('Plaid handler created. Opening Plaid Link...');
                handler.open();
                console.log('Plaid Link should be open now.');
            } catch (error) {
                console.error('Error initializing Plaid Link:', error);
            }
        });
    } else {
        console.error('Link button not found');
    }

    const addAccountButton = document.getElementById('addAccountButton');
    if (addAccountButton) {
        addAccountButton.addEventListener('click', async function() {
            const accountName = document.getElementById('accountName').value;
            const accountAmount = document.getElementById('accountAmount').value;
            const accountCategory = document.getElementById('accountCategory').value;
            const token = localStorage.getItem('token');

            if (!accountName || !accountAmount || !accountCategory) {
                alert('Please fill in all fields.');
                return;
            }

            try {
                const response = await fetch('/plaid/manual_account', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: accountName,
                        amount: parseFloat(accountAmount),
                        category: accountCategory
                    })
                });

                if (response.ok) {
                    $('#addManualAccountModal').modal('hide');
                    document.getElementById('manual-account-form').reset();
                    await fetchAndPopulateBalances();
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.message}`);
                }
            } catch (error) {
                console.error('Error adding manual account:', error);
                alert('An error occurred while adding the account.');
            }
        });
    }

    const saveEditButton = document.getElementById('saveEditButton');
    if (saveEditButton) {
        saveEditButton.addEventListener('click', saveAccountChanges);
    }

    const mainContent = document.querySelector('.main-content');
    const addManualFromCancelledBtn = document.getElementById('addManualAccountFromCancelledModal');
    if (addManualFromCancelledBtn) {
        addManualFromCancelledBtn.addEventListener('click', () => {
            const cancelledModal = bootstrap.Modal.getInstance(document.getElementById('plaidCancelledModal'));
            cancelledModal.hide();
            const addManualModal = new bootstrap.Modal(document.getElementById('addManualAccountModal'));
            addManualModal.show();
        });
    }

    if (mainContent) {
        mainContent.addEventListener('click', function(event) {
            const target = event.target.closest('button, a');
            if (!target) return;

            if (target.classList.contains('edit-account-btn')) {
                event.preventDefault();
                const { accountId, accountName, accountAmount, accountCategory } = target.dataset;
                editAccount(accountId, accountName, parseFloat(accountAmount), accountCategory);
            }

            if (target.classList.contains('delete-account-btn')) {
                event.preventDefault();
                const { accountId } = target.dataset;
                if (confirm('Are you sure you want to delete this account?')) {
                    deleteManualAccount(accountId);
                }
            }

            if (target.classList.contains('view-transactions-link')) {
                event.preventDefault();
                const { accountId } = target.dataset;
                viewTransactions(event, accountId);
            }
        });
    }

    setInterval(() => {
        console.log('Refreshing accounts...');
        fetchAndPopulateBalances();
    }, 86400000);
});

async function fetchAndPopulateBalances() {
    try {
        const token = localStorage.getItem('token');
        const cachedBalances = sessionStorage.getItem('userBalances');

        if (cachedBalances) {
            console.log('Using cached balances');
            const categorizedAccounts = JSON.parse(cachedBalances);
            await updateUIAfterFetchingBalances(categorizedAccounts, token);
            return;
        }

        console.log('Fetching balances from server');
        const response = await fetch('/plaid/all_accounts', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch accounts');
        }

        const categorizedAccounts = await response.json();
        sessionStorage.setItem('userBalances', JSON.stringify(categorizedAccounts));
        console.log('Categorized Accounts:', categorizedAccounts);
        await updateUIAfterFetchingBalances(categorizedAccounts, token);
    } catch (error) {
        console.error('Error in fetchAndPopulateBalances:', error);
        // Optionally clear cache on error if data might be stale/corrupt
        sessionStorage.removeItem('userBalances');
    }
}

async function updateUIAfterFetchingBalances(categorizedAccounts, token) {
    clearAccountLists();

    // Update UI with categorized accounts
    if (categorizedAccounts.bankAccounts) {
        populateAccountList('bank-accounts-list', categorizedAccounts.bankAccounts);
    }

    const manualAccountResponse = await fetch('/plaid/manual_accounts', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (manualAccountResponse.ok) {
        const manualAccounts = await manualAccountResponse.json();
        console.log('Manual Accounts:', manualAccounts);

        manualAccounts.forEach(account => {
            switch (account.category) {
                case 'bank':
                    categorizedAccounts.bankAccounts.push(account);
                    break;
                case 'credit card':
                    categorizedAccounts.creditCards.push(account);
                    break;
                case 'loan':
                    categorizedAccounts.loans.push(account);
                    break;
                case 'investment':
                    categorizedAccounts.investments.push(account);
                    break;
                case 'retirement':
                    categorizedAccounts.retirement.push(account);
                    break;
                case 'insurance':
                    categorizedAccounts.insurance.push(account);
                    break;
                case 'crypto':
                    categorizedAccounts.digital.push(account);
                    break;
                case 'misc':
                    categorizedAccounts.miscellaneous.push(account);
                    break;
            }
        });
    } else {
        console.error('Failed to fetch manual accounts');
    }

    const realEstateData = await fetchRealEstateData();
    console.log('Fetched real estate data:', realEstateData);

    const allData = {
        ...categorizedAccounts,
        realEstate: realEstateData.totalEquity, // Use equity, not just value
    };

    console.log("Passing combined data to calculateAndDisplayBalances:", allData);

    calculateAndDisplayBalances(allData);
}

function displayError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        console.error('Error message element not found in the DOM.');
        alert(message);
    }
}

function setFormattedValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        const numericValue = parseFloat(value) || 0;
        // Format the value as currency
        const formattedValue = numericValue.toLocaleString('en-US', { 
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        element.value = formattedValue;
        console.log(`Updated ${elementId} from ${value} to ${formattedValue}`);
    } else {
        console.error(`Element with ID ${elementId} not found`);
    }
}

async function calculateAndDisplayBalances(allData) {
    let cashBalance = 0;
    let investmentsBalance = 0;
    let liabilitiesBalance = 0;
    let retirementBalance = 0;
    let insuranceBalance = 0;
    let miscBalance = 0;
    let realEstateValue = parseFloat(allData.realEstate || 0);

    clearAccountLists();

    if (allData.bankAccounts) {
        cashBalance = allData.bankAccounts.reduce((sum, acc) => sum + parseFloat(acc.amount || acc.balances?.current || 0), 0);
        populateAccountList('bank-accounts-list', allData.bankAccounts);
    }

    if (allData.investments) {
        investmentsBalance = allData.investments.reduce((sum, acc) => sum + parseFloat(acc.amount || acc.balances?.current || 0), 0);
        populateAccountList('investments-list', allData.investments);
    }

    if (allData.digital) {
        investmentsBalance += allData.digital.reduce((sum, acc) => sum + parseFloat(acc.amount || acc.balances?.current || 0), 0);
        populateAccountList('digital-list', allData.digital);
    }

    if (allData.retirement) {
        retirementBalance = allData.retirement.reduce((sum, acc) => sum + parseFloat(acc.amount || acc.balances?.current || 0), 0);
        populateAccountList('retirement-list', allData.retirement);
    }

    if (allData.insurance) {
        insuranceBalance = allData.insurance.reduce((sum, acc) => sum + parseFloat(acc.amount || acc.balances?.current || 0), 0);
        populateAccountList('insurance-list', allData.insurance);
    }

    if (allData.miscellaneous) {
        miscBalance = allData.miscellaneous.reduce((sum, acc) => sum + parseFloat(acc.amount || acc.balances?.current || 0), 0);
        populateAccountList('miscellaneous-list', allData.miscellaneous);
    }

    if (allData.loans) {
        liabilitiesBalance = allData.loans.reduce((sum, acc) => sum + parseFloat(acc.amount || acc.balances?.current || 0), 0);
        populateAccountList('loans-list', allData.loans);
    }

    if (allData.creditCards) {
        liabilitiesBalance += allData.creditCards.reduce((sum, acc) => sum + parseFloat(acc.amount || acc.balances?.current || 0), 0);
        populateAccountList('creditcards-list', allData.creditCards);
    }

    setFormattedValue('cash', cashBalance);
    setFormattedValue('investments', investmentsBalance);
    setFormattedValue('liabilities', liabilitiesBalance);
    setFormattedValue('retirementAccounts', retirementBalance);
    setFormattedValue('insurance', insuranceBalance);
    setFormattedValue('miscellaneous', miscBalance);
    setFormattedValue('realEstate', realEstateValue);

    console.log('Final Balances Populated:', {
        cashBalance,
        investmentsBalance,
        retirementBalance,
        insuranceBalance,
        miscBalance,
        liabilitiesBalance,
        realEstateValue,
    });
}


async function updateAccountList(category) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/plaid/all_accounts', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch accounts');
        }

        const categorizedAccounts = await response.json();

        const manualAccountResponse = await fetch('/plaid/manual_accounts', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (manualAccountResponse.ok) {
            const manualAccounts = await manualAccountResponse.json();

            manualAccounts.forEach(account => {
                if (account.category === category) {
                    switch (account.category) {
                        case 'bank':
                            categorizedAccounts.bankAccounts.push(account);
                            break;
                        case 'credit card':
                            categorizedAccounts.creditCards.push(account);
                            break;
                        case 'loan':
                            categorizedAccounts.loans.push(account);
                            break;
                        case 'investment':
                            categorizedAccounts.investments.push(account);
                            break;
                        case 'retirement':
                            categorizedAccounts.retirement.push(account);
                            break;
                        case 'insurance':
                            categorizedAccounts.insurance.push(account);
                            break;
                        case 'crypto':
                            categorizedAccounts.digital.push(account);
                            break;
                        case 'misc':
                            categorizedAccounts.miscellaneous.push(account);
                            break;
                    }
                }
            });

            clearAccountListByCategory(category);

            switch (category) {
                case 'bank':
                    populateAccountList('bank-accounts-list', categorizedAccounts.bankAccounts);
                    break;
                case 'credit card':
                    populateAccountList('creditcards-list', categorizedAccounts.creditCards);
                    break;
                case 'loan':
                    populateAccountList('loans-list', categorizedAccounts.loans);
                    break;
                case 'investment':
                    populateAccountList('investments-list', categorizedAccounts.investments);
                    break;
                case 'retirement':
                    populateAccountList('retirement-list', categorizedAccounts.retirement);
                    break;
                case 'insurance':
                    populateAccountList('insurance-list', categorizedAccounts.insurance);
                    break;
                case 'crypto':
                    populateAccountList('digital-list', categorizedAccounts.digital);
                    break;
                case 'misc':
                    populateAccountList('miscellaneous-list', categorizedAccounts.miscellaneous);
                    break;
            }

            const allData = {
                ...categorizedAccounts,
            };
            calculateAndDisplayBalances(allData);

        } else {
            console.error('Failed to fetch manual accounts');
        }
    } catch (error) {
        console.error('Error updating account list:', error.message);
    }
}

function clearAccountList(listId) {
    const listElement = document.getElementById(listId);
    if (listElement) {
        console.log(`Clearing account list for: ${listId}`);
        listElement.innerHTML = '';
    }
}

function clearAccountListByCategory(category) {
    switch (category) {
        case 'bank':
            clearAccountList('bank-accounts-list');
            break;
        case 'credit card':
            clearAccountList('creditcards-list');
            break;
        case 'loan':
            clearAccountList('loans-list');
            break;
        case 'investment':
            clearAccountList('investments-list');
            break;
        case 'retirement':
            clearAccountList('retirement-list');
            break;
        case 'insurance':
            clearAccountList('insurance-list');
            break;
        case 'crypto':
            clearAccountList('digital-list');
            break;
        case 'misc':
            clearAccountList('miscellaneous-list');
            break;
    }
}

function editAccount(accountId, accountName, accountAmount, accountCategory) {
    // Populate the modal with existing account data
    document.getElementById('editAccountId').value = accountId;
    document.getElementById('editAccountName').value = accountName;
    document.getElementById('editAccountAmount').value = accountAmount;
    document.getElementById('editAccountCategory').value = accountCategory;

    // Show the modal
    $('#editAccountModal').modal('show');
}

async function saveAccountChanges() {
    const accountId = document.getElementById('editAccountId').value;
    const accountName = document.getElementById('editAccountName').value;
    const accountAmount = document.getElementById('editAccountAmount').value;
    const accountCategory = document.getElementById('editAccountCategory').value;
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/plaid/manual_account/${accountId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: accountName,
                amount: parseFloat(accountAmount),
                category: accountCategory
            })
        });

        if (response.ok) {
            $('#editAccountModal').modal('hide');
            await fetchAndPopulateBalances();
        } else {
            const error = await response.json();
            alert(`Error updating account: ${error.message}`);
        }
    } catch (error) {
        console.error('Error updating account:', error);
        alert('An error occurred while updating the account.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const saveButton = document.getElementById('saveEditButton');
    if(saveButton) {
        saveButton.addEventListener('click', async function(event) {
            event.preventDefault();
            const accountId = document.getElementById('editAccountId').value;
            const updatedName = document.getElementById('editAccountName').value;
            const updatedAmount = document.getElementById('editAccountAmount').value;
            const updatedCategory = document.getElementById('editAccountCategory').value;
            const token = localStorage.getItem('token');

            try {
                const response = await fetch(`/plaid/manual_account/${accountId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: updatedName,
                        amount: updatedAmount,
                        category: updatedCategory
                    })
                });

                if (!response.ok) {
                    throw new Error(await response.text());
                }
                
                $('#editAccountModal').modal('hide');
                await fetchAndPopulateBalances();

            } catch (error) {
                console.error('Error updating account:', error);
            }
        });
    }

    const editForm = document.getElementById('edit-account-form');
     if(editForm) {
        // Prevent default form submission
        editForm.addEventListener('submit', e => e.preventDefault());
    }
});

async function viewTransactions(event, accountId) {
    event.preventDefault();
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/plaid/transactions/${accountId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const transactions = await response.json();
        const transactionsList = document.getElementById('transactions-list');
        transactionsList.innerHTML = ''; // Clear previous transactions

        if (transactions.length === 0) {
            transactionsList.innerHTML = '<tr><td colspan="3">No transactions found for this account.</td></tr>';
        } else {
            transactions.forEach(transaction => {
                const row = document.createElement('tr');
                const nameCell = document.createElement('td');
                const quantityCell = document.createElement('td');
                const priceCell = document.createElement('td');
                const valueCell = document.createElement('td');

                nameCell.textContent = transaction.name;
                quantityCell.textContent = transaction.quantity;
                priceCell.textContent = transaction.price != null ? transaction.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A';
                valueCell.textContent = transaction.value != null ? transaction.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A';

                row.appendChild(nameCell);
                row.appendChild(quantityCell);
                row.appendChild(priceCell);
                row.appendChild(valueCell);
                transactionsList.appendChild(row);
            });
        }
        
        $('#transactionsModal').modal('show');

    } catch (error) {
        console.error('Error fetching transactions:', error);
    }
}

async function deleteManualAccount(accountId) {
    if (!confirm('Are you sure you want to delete this account?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/plaid/manual_account/${accountId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete manual account');
        }

        console.log('Manual account deleted successfully');
        await fetchAndPopulateBalances(); // Refresh the UI

    } catch (error) {
        console.error('Error deleting manual account:', error);
        alert(error.message);
    }
}

function clearAccountLists() {
    const listIds = [
        'bank-accounts-list',
        'creditcards-list',
        'loans-list',
        'investments-list',
        'retirement-list',
        'insurance-list',
        'digital-list',
        'miscellaneous-list'
    ];
    listIds.forEach(id => clearAccountList(id));
}

async function fetchRealEstateData() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/realestate/list', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch real estate data');
        }
        const properties = await response.json();
        let totalEquity = 0;
        let totalOwnershipValue = 0;
        let totalMortgage = 0;
        properties.forEach(property => {
            totalOwnershipValue += property.value;
            totalMortgage += property.mortgageBalance || property.mortgage || 0;
            totalEquity += (property.value || 0) - (property.mortgageBalance || property.mortgage || 0);
        });
        console.log("Fetched real estate data:", { totalOwnershipValue, totalMortgage, totalEquity });
        return { totalOwnershipValue, totalMortgage, totalEquity };
    } catch (error) {
        console.error('Error fetching real estate data:', error);
        return { totalOwnershipValue: 0, totalMortgage: 0 };
    }
}

async function fetchInvestments() {
    const token = localStorage.getItem('token');
    try {
        const investmentsResponse = await fetch('/plaid/investments/holdings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!investmentsResponse.ok) {
            const errorText = await investmentsResponse.text();
            throw new Error(errorText);
        }

        const holdingsData = await investmentsResponse.json();
        const holdings = holdingsData.holdings || [];

        const investmentsList = document.getElementById('investments-list');
        investmentsList.innerHTML = '';

        holdings.forEach(holding => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const quantityCell = document.createElement('td');
            const priceCell = document.createElement('td');
            const valueCell = document.createElement('td');

            nameCell.textContent = holding.name;
            quantityCell.textContent = holding.quantity;
            priceCell.textContent = holding.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            valueCell.textContent = holding.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            row.appendChild(nameCell);
            row.appendChild(quantityCell);
            row.appendChild(priceCell);
            row.appendChild(valueCell);
            investmentsList.appendChild(row);
        });

        document.getElementById('investments-container').style.display = 'block';
    } catch (error) {
        console.error('Error fetching investments:', error);
    }
}

async function fetchCreditCards() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/plaid/credit_cards', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const creditCards = await response.json();
        const creditCardsList = document.getElementById('creditcards-list');
        creditCardsList.innerHTML = '';

        creditCards.forEach(card => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const balanceCell = document.createElement('td');

            nameCell.textContent = card.name;
            balanceCell.textContent = card.balances.current.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            row.appendChild(nameCell);
            row.appendChild(balanceCell);
            creditCardsList.appendChild(row);
        });

        document.getElementById('creditcards-container').style.display = 'block';
    } catch (error) {
        console.error('Error fetching credit cards:', error);
    }
}

async function fetchLoans() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/plaid/loans', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const loans = await response.json();
        const loansList = document.getElementById('loans-list');
        loansList.innerHTML = '';

        loans.forEach(loan => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const balanceCell = document.createElement('td');

            nameCell.textContent = loan.name;
            balanceCell.textContent = loan.balances.current.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            row.appendChild(nameCell);
            row.appendChild(balanceCell);
            loansList.appendChild(row);
        });

        document.getElementById('loans-container').style.display = 'block';
    } catch (error) {
        console.error('Error fetching loans:', error);
    }
}

async function fetchRetirementAccounts() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/plaid/retirement', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const retirementAccounts = await response.json();
        const retirementList = document.getElementById('retirement-list');
        retirementList.innerHTML = '';

        retirementAccounts.forEach(account => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const balanceCell = document.createElement('td');

            nameCell.textContent = account.name;
            balanceCell.textContent = account.balances.current.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            row.appendChild(nameCell);
            row.appendChild(balanceCell);
            retirementList.appendChild(row);
        });

        document.getElementById('retirement-container').style.display = 'block';
    } catch (error) {
        console.error('Error fetching retirement accounts:', error);
    }
}

async function fetchInsuranceAccounts() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/plaid/insurance', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const insuranceAccounts = await response.json();
        const insuranceList = document.getElementById('insurance-list');
        insuranceList.innerHTML = '';

        insuranceAccounts.forEach(account => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const balanceCell = document.createElement('td');

            nameCell.textContent = account.name;
            balanceCell.textContent = account.balances.current.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            row.appendChild(nameCell);
            row.appendChild(balanceCell);
            insuranceList.appendChild(row);
        });

        document.getElementById('insurance-container').style.display = 'block';
    } catch (error) {
        console.error('Error fetching insurance accounts:', error);
    }
}

async function fetchDigitalAccounts() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/plaid/digital', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const digitalAccounts = await response.json();
        const digitalList = document.getElementById('digital-list');
        digitalList.innerHTML = '';

        digitalAccounts.forEach(account => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const balanceCell = document.createElement('td');

            nameCell.textContent = account.name;
            balanceCell.textContent = account.balances.current.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            row.appendChild(nameCell);
            row.appendChild(balanceCell);
            digitalList.appendChild(row);
        });

        document.getElementById('digital-container').style.display = 'block';
    } catch (error) {
        console.error('Error fetching digital accounts:', error);
    }
}

async function fetchMiscellaneousAccounts() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/plaid/miscellaneous', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const miscellaneousAccounts = await response.json();
        const miscellaneousList = document.getElementById('miscellaneous-list');
        miscellaneousList.innerHTML = '';

        miscellaneousAccounts.forEach(account => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const balanceCell = document.createElement('td');

            nameCell.textContent = account.name;
            balanceCell.textContent = account.balances.current.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            row.appendChild(nameCell);
            row.appendChild(balanceCell);
            miscellaneousList.appendChild(row);
        });

        document.getElementById('miscellaneous-container').style.display = 'block';
    } catch (error) {
        console.error('Error fetching miscellaneous accounts:', error);
    }
}

async function fetchLiabilities() {
    const token = localStorage.getItem('token');
    try {
        const loansResponse = await fetch('/plaid/loans', { headers: { 'Authorization': `Bearer ${token}` } });

        if (!loansResponse.ok) {
            throw new Error('Failed to fetch loans');
        }

        const loans = await loansResponse.json();
        const liabilities = loans.map(loan => loan.balances.current);

        populateLiabilities(liabilities);
    } catch (error) {
        console.error('Error fetching liabilities:', error);
    }
}

function populateLiabilities(liabilities) {
    const liabilitiesInput = document.getElementById('liabilities');
    if (liabilitiesInput) {
        const totalLiabilities = liabilities.reduce((total, liability) => {
            return total + (liability || 0);
        }, 0);
        liabilitiesInput.value = totalLiabilities.toFixed(2);
        liabilitiesInput.title = totalLiabilities.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    } else {
        console.error('Element with ID liabilities not found');
    }
}

function populateAccountList(listId, accounts) {
    const listElement = document.getElementById(listId);
    if (!listElement) {
        console.error(`Element with id ${listId} not found.`);
        return;
    }
    listElement.innerHTML = ''; // Clear existing list

    const filteredAccounts = accounts.filter(account =>
        account.name !== 'LinkedIn Bank' && account.name !== 'Microsoft Bank'
    );

    if (filteredAccounts.length === 0) {
        return;
    }

    filteredAccounts.forEach(account => {
        const balance = account.balances ? account.balances.current : account.amount;
        const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance);

        const card = document.createElement('div');
        card.className = 'col-xl-6 col-md-6';

        let actionsHtml = '';
        if (account.type === 'manual' && account._id) {
            actionsHtml = `
                <a class="dropdown-item edit-account-btn" href="#" data-account-id="${account._id}" data-account-name="${account.name}" data-account-amount="${balance}" data-account-category="${account.category}">Edit</a>
                <a class="dropdown-item delete-account-btn" href="#" data-account-id="${account._id}">Delete</a>
            `;
        } else if (account.account_id) {
            actionsHtml = `<a class="dropdown-item view-transactions-link" href="#" data-account-id="${account.account_id}">View Transactions</a>`;
        }

        let logoHtml;
        if (account.type === 'manual') {
            logoHtml = `
                <div class="manual-account-icon-container">
                    <i class="fa fa-plus"></i>
                </div>
            `;
        } else {
            logoHtml = `
                <div class="manual-account-icon-container">
                    <i class="fa fa-link"></i>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="card account-card">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-4">
                        ${logoHtml}
                        <div>
                            <p class="institution-name mb-0">${account.institutionName || 'Manual Account'}</p>
                            <h5 class="account-name mb-1">${account.name}</h5>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <p class="balance-label mb-1">Available Balance</p>
                            <h4 class="balance-amount mb-0">${formattedBalance}</h4>
                        </div>
                        <div class="dropdown">
                            <a class="font-size-20 text-white dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                <i class="fa fa-ellipsis-v"></i>
                            </a>
                            <div class="dropdown-menu dropdown-menu-end">
                                ${actionsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        listElement.appendChild(card);
    });
}