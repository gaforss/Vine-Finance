document.addEventListener('DOMContentLoaded', function() {
    let cashFlowChart = null;
    let goalsTable = null;
    let spendingChart = null;

    // This function will orchestrate all the initial data fetching and rendering
    async function initializePage() {
        const hasAccounts = await checkForLinkedAccounts();
        if (hasAccounts) {
            document.getElementById('cta-container').style.display = 'none';
            document.getElementById('main-budgeting-content').style.display = 'block';
            initializeSortByDropdown();
            await fetchSavingsGoals();
            await fetchCashFlowData();
            await fetchCategorizedSpending('yearly');
        } else {
            document.getElementById('cta-container').style.display = 'block';
            document.getElementById('main-budgeting-content').style.display = 'none';
        }
    }

    async function checkForLinkedAccounts() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/plaid/accounts', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Response from /plaid/balances:', response);

            if (response.ok) {
                const data = await response.json();
                console.log('Data from /plaid/balances:', data);
                // Check if there are any accounts in any of the categories
                const hasAccounts = (data.bankAccounts && data.bankAccounts.length > 0) ||
                       (data.investments && data.investments.length > 0) ||
                       (data.digital && data.digital.length > 0) ||
                       (data.retirement && data.retirement.length > 0) ||
                       (data.liabilities && data.liabilities.length > 0) ||
                       (data.insurance && data.insurance.length > 0) ||
                       (data.misc && data.misc.length > 0);
                console.log('Has linked accounts:', hasAccounts);
                return hasAccounts;
            } else {
                console.error('Request to /plaid/balances was not ok. Status:', response.status);
            }
            return false;
        } catch (error) {
            console.error('Error fetching /plaid/balances:', error);
            return false;
        }
    }

    // Initialize DataTables and then the rest of the page
    $(document).ready(function() {
        if (!$.fn.DataTable.isDataTable('#goalsTable')) {
            goalsTable = $('#goalsTable').DataTable({
                responsive: true,
                autoWidth: false,
                paging: false,
                searching: false,
                info: false,
                lengthChange: false,
                scrollX: true
            });
        }
        // Once the table is ready, initialize the rest of the data
        initializePage();
    });

    function initializeSortByDropdown() {
        const dropdownMenuText = document.getElementById('dropdownMenuButton1Text');
        const dropdownItems = document.querySelectorAll('.dropdown-item');

        if (!dropdownMenuText || dropdownItems.length === 0) {
            console.log('Sort by dropdown not found, skipping initialization.');
            return; // Exit if elements are not found
        }

        // Set default text to "This Year" dynamically
        updateDropdownText('This Year');

        dropdownItems.forEach(item => {
            item.addEventListener('click', function(event) {
                event.preventDefault();
                const selectedPeriod = this.getAttribute('data-period');
                const displayText = this.innerText;
                fetchCategorizedSpending(selectedPeriod);
                updateDropdownText(displayText);
            });
        });
    }

    function updateDropdownText(text) {
        const dropdownMenuText = document.getElementById('dropdownMenuButton1Text');
        if (dropdownMenuText) {
            dropdownMenuText.innerHTML = `${text} <i class="fa fa-caret-down ms-1"></i>`;
        }
    }

    async function fetchCategorizedSpending(period = 'yearly') {
        const token = localStorage.getItem('token');
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // Months are zero-based
        let queryParam = '';

        switch (period) {
            case 'monthly':
                queryParam = `year=${currentYear}&month=${String(currentMonth).padStart(2, '0')}`;
                break;
            case 'weekly':
                const startOfWeek = new Date(currentDate);
                startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                queryParam = `start=${startOfWeek.toISOString().split('T')[0]}&end=${endOfWeek.toISOString().split('T')[0]}`;
                break;
            case 'yearly':
            default:
                queryParam = `year=${currentYear}`;
                break;
        }

        try {
            const response = await fetch(`/plaid/categorized-spending?${queryParam}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const categorizedSpending = await response.json();

            const filteredSpending = categorizedSpending.filter(item => 
                !['Transfer', 'Service', 'Payment', 'Interest'].includes(item._id)
            );

            renderCategorizedSpendingChart(filteredSpending);
            mixpanel.track('Categorized Spending Retrieved', {
                period: period,
                distinct_id: await getUserId(),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching categorized spending:', error);
        }
    }

    function renderCategorizedSpendingChart(data) {
        const chartElement = document.getElementById("categorizedSpendingChart");
        const breakdownElement = document.getElementById("categorizedSpendingBreakdown");
        if (!chartElement || !breakdownElement) return;

        const categories = data.map(item => item._id);
        const amounts = data.map(item => item.totalAmount);
        const totalAmount = amounts.reduce((acc, amount) => acc + amount, 0);
        const percentages = amounts.map(amount => (amount / totalAmount) * 100);

        const combinedData = categories.map((category, index) => ({
            category,
            amount: amounts[index],
            percentage: percentages[index]
        })).sort((a, b) => b.percentage - a.percentage);

        const sortedCategories = combinedData.map(item => item.category);
        const sortedAmounts = combinedData.map(item => item.amount);
        const sortedPercentages = combinedData.map(item => item.percentage);

        const options = {
            series: sortedPercentages,
            chart: {
                type: 'radialBar',
                height: 450,
                offsetY: 0,
                sparkline: {
                    enabled: false
                }
            },
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 135,
                    hollow: {
                        margin: 15,
                        size: '60%',
                        background: 'transparent'
                    },
                    track: {
                        background: '#f2f2f2',
                        strokeWidth: '100%',
                        margin: 0
                    },
                    dataLabels: {
                        name: {
                            show: true,
                            fontSize: '16px',
                            fontFamily: 'Helvetica, Arial, sans-serif',
                            fontWeight: 'bold',
                            color: '#888',
                            offsetY: -10
                        },
                        value: {
                            formatter: function (val) {
                                return parseFloat(val).toFixed(2) + "%";
                            },
                            fontSize: '22px',
                            fontFamily: 'Helvetica, Arial, sans-serif',
                            fontWeight: 'bold',
                            color: '#111',
                            offsetY: 16
                        }
                    }
                }
            },
            labels: sortedCategories,
            colors: ['#009cde', '#003087', '#0070ba', '#f2c500'],
            fill: {
                type: 'solid'
            },
            stroke: {
                lineCap: 'round',
                width: 20
            },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return parseFloat(val).toFixed(2) + "%";
                    }
                },
                custom: function({ series, seriesIndex }) {
                    const val = series[seriesIndex];
                    const amount = sortedAmounts[seriesIndex];
                    return `<div class="apexcharts-tooltip" style="padding: 10px; font-size: 14px; font-family: Helvetica, Arial, sans-serif;">
                                <div><strong>${sortedCategories[seriesIndex]}</strong></div>
                                <div>${parseFloat(val).toFixed(2)}% ($${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div>`;
                }
            }
        };

        if (spendingChart) spendingChart.destroy();

        spendingChart = new ApexCharts(chartElement, options);
        spendingChart.render();

        let breakdownHtml = '<div class="row">';
        sortedCategories.forEach((category, index) => {
            const amount = sortedAmounts[index];
            const percentage = sortedPercentages[index];
            breakdownHtml += `
                <div class="col-md-12">
                    <div class="card mb-2">
                        <div class="card-body">
                            <h6 class="card-title">${category}</h6>
                            <p class="card-text">${percentage.toFixed(2)}% ($${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                        </div>
                    </div>
                </div>
            `;
        });
        breakdownHtml += '</div>';
        breakdownElement.innerHTML = breakdownHtml;
    }

    const addGoalForm = document.getElementById('add-goal-form');
    if (addGoalForm) {
        addGoalForm.onsubmit = async function(event) {
            event.preventDefault();
            const formData = new FormData(addGoalForm);
            const goalData = {
                name: formData.get('name'),
                targetAmount: parseFloat(formData.get('targetAmount')) || 0,
                currentAmount: parseFloat(formData.get('currentAmount')) || 0,
                endDate: formData.get('endDate')
            };

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/budgeting/savings-goals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(goalData)
                });

                if (response.ok) {
                    const newGoal = await response.json();
                    addGoalToTable(newGoal);
                    addGoalForm.reset();
                    mixpanel.track('Savings Goal Added', {
                        distinct_id: await getUserId(),
                        goalName: goalData.name,
                        targetAmount: goalData.targetAmount,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
            } catch (error) {
                console.error('Error adding savings goal:', error);
            }
        };
    }

    async function fetchSavingsGoals() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/budgeting/savings-goals', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const goals = await response.json();
            populateGoalsTable(goals);
            mixpanel.track('Savings Goals Retrieved', {
                distinct_id: await getUserId(),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching savings goals:', error);
        }
    }

    function populateGoalsTable(goals) {
        const goalsTableBody = document.getElementById('goals-table-body');
        if (!goalsTableBody) return;

        goalsTableBody.innerHTML = '';

        goals.forEach(goal => {
            addGoalToTable(goal);
        });

        if (goalsTable) goalsTable.draw();
    }

    function addGoalToTable(goal) {
        const goalsTableBody = document.getElementById('goals-table-body');
        const row = document.createElement('tr');
        row.setAttribute('data-id', goal._id);

        row.innerHTML = `
            <td>${goal.name}</td>
            <td>${goal.targetAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
            <td>${goal.currentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
            <td>${new Date(goal.endDate).toLocaleDateString()}</td>
            <td><div id="goal-progress-${goal._id}" style="width: 100px; height: 100px;"></div></td>
            <td>
                <button class="btn btn-sm btn-primary edit-goal-btn" data-id="${goal._id}" data-bs-toggle="modal" data-bs-target="#editGoalModal">Edit</button>
                <button class="btn btn-sm btn-danger delete-goal-btn" data-id="${goal._id}">Delete</button>
            </td>
        `;

        goalsTableBody.appendChild(row);
        renderGoalProgress(goal);

        if (goalsTable) goalsTable.row.add($(row)).draw();
    }

    function renderGoalProgress(goal) {
        const progressElement = document.getElementById(`goal-progress-${goal._id}`);
        if (!progressElement) return;

        const rect = progressElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        if (progressElement.chart) progressElement.chart.destroy();

        const progress = Math.max(0, Math.min((goal.currentAmount / goal.targetAmount) * 100, 100));
        if (isNaN(progress)) return;

        const options = {
            series: [progress],
            chart: {
                height: 150,
                type: 'radialBar',
                offsetY: 0,
                sparkline: {
                    enabled: true
                },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                }
            },
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 135,
                    hollow: {
                        margin: 0,
                        size: '70%',
                        background: 'transparent',
                        dropShadow: {
                            enabled: true,
                            top: 3,
                            left: 0,
                            blur: 4,
                            opacity: 0.24
                        }
                    },
                    track: {
                        background: '#f2f2f2',
                        strokeWidth: '100%',
                        margin: 0,
                    },
                    dataLabels: {
                        show: true,
                        name: {
                            show: false
                        },
                        value: {
                            offsetY: 5,
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#ffffff',
                            formatter: function(val) {
                                return val.toFixed(1) + '%';
                            }
                        }
                    }
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: 'horizontal',
                    shadeIntensity: 0.5,
                    gradientToColors: ['#003087', '#009cde'],
                    opacityFrom: 0.8,
                    opacityTo: 0.8,
                    stops: [0, 100]
                }
            },
            stroke: {
                lineCap: 'round',
                width: 10
            },
            labels: ['Progress'],
        };

        const chart = new ApexCharts(progressElement, options);
        progressElement.chart = chart;
        chart.render();
    }

    document.getElementById('goals-table-body').addEventListener('click', function(event) {
        if (event.target.classList.contains('edit-goal-btn')) {
            const goalId = event.target.getAttribute('data-id');
            editGoal(goalId);
        } else if (event.target.classList.contains('delete-goal-btn')) {
            const goalId = event.target.getAttribute('data-id');
            confirmDeleteGoal(goalId);
        }
    });

    async function editGoal(goalId) {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`/budgeting/savings-goals/${goalId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const goal = await response.json();

            document.getElementById('edit-goal-id').value = goal._id;
            document.getElementById('edit-name').value = goal.name;
            document.getElementById('edit-targetAmount').value = goal.targetAmount;
            document.getElementById('edit-currentAmount').value = goal.currentAmount;
            document.getElementById('edit-endDate').value = goal.endDate.split('T')[0];
        } catch (error) {
            console.error('Error fetching goal:', error);
        }
    }

    const editGoalForm = document.getElementById('edit-goal-form');
    if (editGoalForm) {
        editGoalForm.onsubmit = async function(event) {
            event.preventDefault();
            const goalId = document.getElementById('edit-goal-id').value;
            const goalData = {
                name: document.getElementById('edit-name').value,
                targetAmount: parseFloat(document.getElementById('edit-targetAmount').value) || 0,
                currentAmount: parseFloat(document.getElementById('edit-currentAmount').value) || 0,
                endDate: document.getElementById('edit-endDate').value
            };

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/budgeting/savings-goals/${goalId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(goalData)
                });

                if (response.ok) {
                    const updatedGoal = await response.json();
                    updateGoalInTable(updatedGoal);
                    const editGoalModal = document.getElementById('editGoalModal');
                    const bootstrapModal = bootstrap.Modal.getInstance(editGoalModal);
                    bootstrapModal.hide();
                    mixpanel.track('Savings Goal Updated', {
                        distinct_id: await getUserId(),
                        goalName: updatedGoal.name,
                        targetAmount: updatedGoal.targetAmount,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
            } catch (error) {
                console.error('Error updating goal:', error);
            }
        };
    }

    function updateGoalInTable(goal) {
        const goalsTableBody = document.getElementById('goals-table-body');
        const row = goalsTableBody.querySelector(`tr[data-id='${goal._id}']`);

        if (row) {
            row.querySelector('td:nth-child(1)').textContent = goal.name;
            row.querySelector('td:nth-child(2)').textContent = goal.targetAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            row.querySelector('td:nth-child(3)').textContent = goal.currentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            row.querySelector('td:nth-child(4)').textContent = new Date(goal.endDate).toLocaleDateString();
            renderGoalProgress(goal);

            if (goalsTable) goalsTable.row($(row)).invalidate().draw();
        }
    }

    async function confirmDeleteGoal(goalId) {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'No, cancel!',
            reverseButtons: true
        });

        if (result.isConfirmed) deleteGoal(goalId);
    }

    async function deleteGoal(goalId) {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`/budgeting/savings-goals/${goalId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                removeGoalFromTable(goalId);
                Swal.fire('Deleted!', 'Your goal has been deleted.', 'success');
                mixpanel.track('Savings Goal Deleted', {
                    distinct_id: await getUserId(),
                    goalId: goalId,
                    timestamp: new Date().toISOString()
                });
            } else {
                const errorText = await response.text();
                throw new Error(errorText);
            }
        } catch (error) {
            console.error('Error deleting goal:', error);
            Swal.fire('Error!', 'There was an error deleting your goal.', 'error');
        }
    }

    function removeGoalFromTable(goalId) {
        const goalsTableBody = document.getElementById('goals-table-body');
        const row = goalsTableBody.querySelector(`tr[data-id='${goalId}']`);

        if (row) {
            const progressElement = document.getElementById(`goal-progress-${goalId}`);
            if (progressElement && progressElement.chart) progressElement.chart.destroy();

            if (goalsTable) goalsTable.row($(row)).remove().draw();
        }
    }

    async function fetchCashFlowData() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/budgeting/transactions', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const transactions = await response.json();
            analyzeCashFlow(transactions);
            mixpanel.track('Cash Flow Data Retrieved', {
                distinct_id: await getUserId(),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }
    }

    function analyzeCashFlow(transactions) {
        const monthlyIncome = {};
        const monthlyExpenses = {};

        transactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
            const amount = transaction.amount;

            if (amount > 0) {
                monthlyIncome[monthYear] = (monthlyIncome[monthYear] || 0) + amount;
            } else {
                monthlyExpenses[monthYear] = (monthlyExpenses[monthYear] || 0) + Math.abs(amount);
            }
        });

        const netIncome = {};
        Object.keys(monthlyIncome).forEach(monthYear => {
            netIncome[monthYear] = (monthlyIncome[monthYear] || 0) - (monthlyExpenses[monthYear] || 0);
        });

        renderCashFlowChart(monthlyIncome, monthlyExpenses, netIncome);
    }

    function renderCashFlowChart(income, expenses, netIncome) {
        const labels = Object.keys(income).sort();
        const incomeData = labels.map(label => income[label] || 0);
        const expensesData = labels.map(label => expenses[label] || 0);
        const netIncomeData = labels.map(label => netIncome[label] || 0);

        const chartElement = document.querySelector("#cashFlowChart");
        if (!chartElement) return;

        if (cashFlowChart) cashFlowChart.destroy();

        const options = {
            series: [{
                name: 'Income',
                data: incomeData,
                color: '#009cde'
            }, {
                name: 'Expenses',
                data: expensesData,
                color: '#f2c500'
            }, {
                name: 'Net Income',
                data: netIncomeData,
                color: '#28a745'
            }],
            chart: {
                type: 'area',
                height: 350,
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                }
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            xaxis: {
                categories: labels,
                labels: {
                    style: {
                        colors: '#333',
                        fontSize: '14px'
                    }
                },
                axisBorder: {
                    show: true,
                    color: '#e0e0e0'
                },
                axisTicks: {
                    show: true,
                    color: '#e0e0e0'
                }
            },
            yaxis: {
                labels: {
                    formatter: function (value) {
                        return value.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                    },
                    style: {
                        colors: '#333',
                        fontSize: '14px'
                    }
                },
                axisBorder: {
                    show: true,
                    color: '#e0e0e0'
                },
                axisTicks: {
                    show: true,
                    color: '#e0e0e0'
                }
            },
            grid: {
                borderColor: '#e0e0e0',
                strokeDashArray: 4,
                xaxis: {
                    lines: {
                        show: false
                    }
                },
                yaxis: {
                    lines: {
                        show: false
                    }
                }
            },
            tooltip: {
                enabled: true,
                theme: 'light',
                x: {
                    show: true
                },
                y: {
                    formatter: function (value) {
                        return value.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                    }
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: 'vertical',
                    shadeIntensity: 0.5,
                    gradientToColors: ['#0070ba', '#f2c500', '#28a745'],
                    opacityFrom: 0.6,
                    opacityTo: 0.4,
                    stops: [0, 100]
                }
            },
            markers: {
                size: 0
            },
            legend: {
                show: true,
                position: 'top',
                horizontalAlign: 'left',
                labels: {
                    colors: '#333'
                }
            }
        };

        cashFlowChart = new ApexCharts(chartElement, options);
        cashFlowChart.render();
    }

    document.querySelector('.main-content').addEventListener('scroll', function() {
        if (goalsTable) goalsTable.columns.adjust().responsive.recalc();
    });
});