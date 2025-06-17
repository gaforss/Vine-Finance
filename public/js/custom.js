document.addEventListener('DOMContentLoaded', async () => {
    updateFirstnamePlaceholder();
    populateProfileForm();
    await populateSessionActivity();

    const profileForm = document.getElementById('profileForm');
    const deleteProfileForm = document.getElementById('deleteProfileForm');

    if (profileForm) {
        profileForm.addEventListener('submit', updateProfile);
    }

    if (deleteProfileForm) {
        deleteProfileForm.addEventListener('submit', deleteProfile);
    }

    const logoutLink = document.querySelector('a[href="/auth/logout"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(event) {
            event.preventDefault();
            logout();
        });
    }

    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return;
    }

    await checkAndHideDummyDataButton();

    const deleteDummyDataBtn = document.getElementById('deleteDummyDataBtn');
    if (deleteDummyDataBtn) {
        deleteDummyDataBtn.addEventListener('click', deleteDummyData);
    }

    // const entryForm = document.getElementById('entryForm');
    // if (entryForm) {
    //     entryForm.addEventListener('submit', function (event) {
    //         event.preventDefault();
    //         const submitButton = event.target.querySelector('button[type="submit"]');
    //         submitButton.disabled = true;
    //         updateEntry(entryId);
    //     });
    // }
});

function setFormattedValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        const numericValue = parseFloat(value) || 0;
        const formattedValue = numericValue.toLocaleString('en-US', { 
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
        });
        element.value = formattedValue;
        console.log(`Updated ${elementId} to ${formattedValue}`);
    } else {
        console.error(`Element with ID ${elementId} not found`);
    }
}

async function deleteDummyData() {
    if (typeof mixpanel !== 'undefined') {
        mixpanel.track('Delete Demo Data Clicked');
    }
    try {
        const userId = await getUserId();
        const response = await fetch(`/entries/deleteDummyData/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            alert('Dummy data deleted successfully');
            const deleteDummyDataBtn = document.getElementById('deleteDummyDataBtn');
            if (deleteDummyDataBtn) {
                deleteDummyDataBtn.style.display = 'none';
            }
            await fetchEntries();
        } else {
            alert('Failed to delete dummy data');
        }
    } catch (error) {
        console.error('Error deleting dummy data:', error);
        alert('An error occurred while deleting the dummy data');
    }
}

async function checkAndHideDummyDataButton() {
    try {
        const userData = await fetchUserData();
        if (userData.hasDeletedDummyData) {
            const deleteDummyDataBtn = document.getElementById('deleteDummyDataBtn');
            if (deleteDummyDataBtn) {
                deleteDummyDataBtn.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error checking dummy data deletion status:', error);
    }
}

async function getUserId() {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error('User not authenticated');
    }

    const response = await fetch('/auth/api/user', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user ID');
    }

    const user = await response.json();
    console.log('Fetched user ID:', user._id);
    return user._id;
}

async function fetchUserData() {
    try {
        const token = localStorage.getItem('token'); 
        const response = await fetch("/auth/api/user", {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            const userData = await response.json();
            return userData;
        } else {
            throw new Error("Failed to fetch user data");
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        return null;
    }
}

async function populateSessionActivity() {
    const sessionActivityList = document.getElementById('sessionActivityList');
    // If the element doesn't exist on the page, don't proceed
    if (!sessionActivityList) {
        return;
    }

    const token = localStorage.getItem('token');
    try {
        console.log('Fetching user session activity');
        const response = await fetch("/auth/api/user", {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const userData = await response.json();
            console.log('User data received:', userData);

            sessionActivityList.innerHTML = ''; // Clear any existing items

            const sortedSessions = userData.sessionActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            const recentSessions = sortedSessions.slice(0, 25);

            recentSessions.forEach(session => {
                console.log('Adding session to list:', session);
                
                const city = session.location?.city || 'Unknown';
                const region = session.location?.region || 'Unknown';
                const country = session.location?.country || 'Unknown';

                console.log(`Session location data: City: ${city}, Region: ${region}, Country: ${country}`);

                const sessionItem = document.createElement('li');
                sessionItem.className = 'list-group-item';

                sessionItem.innerHTML = `
                    <a href="#">
                        <div class="d-flex align-items-start">
                            <div class="flex-grow-1 overflow-hidden">
                                <p class="mb-1 text-white-50"><i class="fa fa-location-arrow"></i> ${session.ipAddress}</p>
                                <p class="mb-1 text-white-50"><i class="fa fa-user"></i> ${session.userAgent}</p>
                                <p class="mb-1 text-white-50"><i class="fa fa-map-pin"></i> ${city}, ${region}, ${country}</p>
                                <p class="mb-1 text-white-50"><i class="fa fa-calendar"></i> ${new Date(session.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                    </a>
                `;

                sessionActivityList.appendChild(sessionItem);
            });

            console.log('Session activity list updated in the DOM.');
        } else {
            console.error('Failed to fetch session activity. Status:', response.status);
            throw new Error("Failed to fetch session activity");
        }
    } catch (error) {
        console.error("Error fetching session activity:", error);
    }
}

async function updateFirstnamePlaceholder() {
    try {
        const userData = await fetchUserData();
        const firstnamePlaceholder = document.getElementById("firstnamePlaceholder");
        const userFirstName = document.getElementById("userFirstName");

        if (firstnamePlaceholder && userFirstName) {
            if (userData && userData.firstName) {
                firstnamePlaceholder.textContent = `Hello, ${userData.firstName}`;
                userFirstName.textContent = userData.firstName;
                console.log('Updated header with firstName:', userData.firstName);
            } else {
                firstnamePlaceholder.textContent = "Hello, User";
                userFirstName.textContent = "User";
            }
        }
    } catch (error) {
        console.error("Error updating first name placeholder:", error);
        const firstnamePlaceholder = document.getElementById("firstnamePlaceholder");
        const userFirstName = document.getElementById("userFirstName");

        if (firstnamePlaceholder && userFirstName) {
            firstnamePlaceholder.textContent = "Error fetching data";
            userFirstName.textContent = "User";
        }
    }
}

async function updateProfile(event) {
    event.preventDefault();
    const formData = new FormData(document.getElementById('profileForm'));
    const token = localStorage.getItem('token');

    for (let [key, value] of formData.entries()) {
        console.log(key, value);
    }

    const data = {
        username: formData.get('username'),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email')
    };

    try {
        const response = await fetch("/auth/updateProfile", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            console.log('Updated user data:', updatedUser);
            updateLocalUserData(updatedUser.user);
            alert("Profile updated successfully");
        } else {
            throw new Error("Failed to update profile");
        }
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Error updating profile");
    }
}

function updateLocalUserData(userData) {
    console.log('Updating local user data with:', userData);
    localStorage.setItem('user', JSON.stringify(userData));
    updateFirstnamePlaceholder();
    populateProfileForm();
}

async function deleteProfile(event) {
    event.preventDefault();
    const token = localStorage.getItem('token');

    if (confirm("Are you sure you want to delete your profile? This action cannot be undone.")) {
        try {
            const response = await fetch('/auth/deleteAccount', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                alert('Profile deleted successfully.');
                localStorage.removeItem('token');
                sessionStorage.removeItem('userBalances'); // Clear cached balances
                window.location.href = '/login'; // Redirect to login page
            } else {
                throw new Error("Failed to delete profile");
            }
        } catch (error) {
            console.error("Error deleting profile:", error);
            alert("Error deleting profile");
        }
    }
}

async function populateProfileForm() {
    const userData = await fetchUserData();
    if (userData) {
        console.log('Populating profile form with:', userData);
        const username = document.getElementById('username');
        const firstName = document.getElementById('firstName');
        const lastName = document.getElementById('lastName');
        const email = document.getElementById('email');

        if (username) username.value = userData.username || '';
        if (firstName) firstName.value = userData.firstName || '';
        if (lastName) lastName.value = userData.lastName || '';
        if (email) email.value = userData.email || '';
    }
}

async function fetchEntries() {
    try {
        const response = await fetch('/entries', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const entries = await response.json();
        if (!Array.isArray(entries)) {
            throw new Error('Expected an array of entries');
        }

        if (!$.fn.DataTable.isDataTable('#transactionsTable')) {
            $('#transactionsTable').DataTable({
                paging: false,
                searching: false,
                info: false,
                lengthChange: false,
                dom: '<"row"<"col-sm-12"tr>>',
                order: [[0, 'desc']],
                columnDefs: [
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
                    }
                ]
            });
        }

        const transactionsTable = $('#transactionsTable').DataTable();
        transactionsTable.clear();

        entries.forEach(entry => {
            const dateObj = new Date(entry.date);
            const rowData = [
                dateObj.getTime(), // Keep timestamp for sorting
                dateObj.toISOString().split('T')[0], // Keep ISO date for data
                `<button class="btn btn-warning btn-sm" onclick="editEntry('${entry._id}')"> <i class="fa fa-edit"></i> </button>
                 <button class="btn btn-danger btn-sm" onclick="deleteEntry('${entry._id}')"><i class="fa fa-close"></i> </button>`,
                (entry.cash || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                (entry.investments || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                (entry.realEstate || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                (entry.retirementAccounts || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                (entry.vehicles || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                (entry.personalProperty || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                (entry.otherAssets || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                (entry.liabilities || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                ((entry.cash || 0) + (entry.investments || 0) + (entry.realEstate || 0) + (entry.retirementAccounts || 0) + (entry.vehicles || 0) + (entry.personalProperty || 0) + (entry.otherAssets || 0) - (entry.liabilities || 0)).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            ];
            transactionsTable.row.add(rowData);
        });

        transactionsTable.draw();
    } catch (error) {
        console.error('Error fetching entries:', error);
    }
}

async function editEntry(entryId) {
    const token = localStorage.getItem('token');
    console.log('editEntry called with entryId:', entryId);

    try {
        const response = await fetch(`/entries/${entryId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch entry details');
        }

        const entry = await response.json();
        console.log('Fetched entry details:', entry);

        // Populate modal fields with formatted values
        document.getElementById('date').value = entry.date.split('T')[0];
        setFormattedValue('modalCash', entry.cash);
        setFormattedValue('modalInvestments', entry.investments);
        setFormattedValue('modalRealEstate', entry.realEstate);
        setFormattedValue('modalRetirementAccounts', entry.retirementAccounts);
        setFormattedValue('modalVehicles', entry.vehicles);
        setFormattedValue('modalPersonalProperty', entry.personalProperty);
        setFormattedValue('modalOtherAssets', entry.otherAssets);
        setFormattedValue('modalLiabilities', entry.liabilities);
        document.getElementById('modalEntryId').value = entryId;

        $('#editModal').modal('show');
    } catch (error) {
        console.error('Error fetching entry details:', error);
    }
}

async function updateEntry() {
    const token = localStorage.getItem('token');
    const entryId = document.getElementById('modalEntryId').value;

    const formData = new FormData(document.getElementById('editEntryForm'));

    const parseCurrency = (value) => {
        return parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0; // Removes currency formatting before parsing
    };

    const data = {
        date: formData.get('date'),
        cash: parseCurrency(formData.get('cash')),
        investments: parseCurrency(formData.get('investments')),
        realEstate: parseCurrency(formData.get('realEstate')),
        retirementAccounts: parseCurrency(formData.get('retirementAccounts')),
        vehicles: parseCurrency(formData.get('vehicles')),
        personalProperty: parseCurrency(formData.get('personalProperty')),
        otherAssets: parseCurrency(formData.get('otherAssets')),
        liabilities: parseCurrency(formData.get('liabilities'))
    };

    const response = await fetch(`/entries/${entryId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        alert('Entry updated successfully');
        await fetchEntries();
        $('#editModal').modal('hide');
    } else {
        alert('Failed to update entry');
    }
}

const table = $('#dataTable').DataTable({
    processing: true,
    serverSide: true,
    ajax: {
        url: '/api/data',
        data: function(d) {
            d.start_date = $('#start_date').val();
            d.end_date = $('#end_date').val();
        }
    },
    columns: [
        { 
            data: 'date',
            render: function(data) {
                const [year, month] = data.split('-');
                const date = new Date(Date.UTC(year, parseInt(month) - 1));
                return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            }
        },
        { data: 'total_sales' },
        { data: 'total_orders' },
        { data: 'average_order_value' }
    ],
    order: [[0, 'asc']],
    pageLength: 12,
    lengthMenu: [[12, 24, 36, 48], [12, 24, 36, 48]],
    language: {
        search: "Filter:"
    },
    dom: '<"top"lf>rt<"bottom"ip>',
    className: 'compact-table'
});

// Add custom CSS for the table
$('<style>')
    .text(`
        .compact-table td, .compact-table th {
            font-size: 0.9rem !important;
            padding: 0.5rem !important;
        }
        .dataTables_wrapper .dataTables_length, 
        .dataTables_wrapper .dataTables_filter,
        .dataTables_wrapper .dataTables_info,
        .dataTables_wrapper .dataTables_paginate {
            font-size: 0.9rem !important;
        }
    `)
    .appendTo('head');

function logout() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('userBalances'); // Clear any cached financial data
    window.location.href = '/auth/logout'; // Redirect to logout route
}