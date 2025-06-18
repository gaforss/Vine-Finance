document.addEventListener('DOMContentLoaded', function () {
    let cashFlowChart = null;
    let goalsTable = null;
    let spendingChart = null;

    // --- Page Initialization ---
    async function initializeBudgetingPage() {
        console.log('[Init] Checking for linked accounts...');
        if (await checkForLinkedAccounts()) {
            console.log('[Init] Linked accounts found. Displaying main content.');
            document.getElementById('cta-container').style.display = 'none';
            document.getElementById('main-budgeting-content').style.display = 'block';
            
            initializeSortByDropdown();
            fetchDataAndInitializePage();
            initializeGoalEventHandlers();

        } else {
            console.log('[Init] No linked accounts found. Displaying CTA.');
            document.getElementById('cta-container').style.display = 'block';
            document.getElementById('main-budgeting-content').style.display = 'none';
        }
    }

    async function fetchDataAndInitializePage() {
        console.log('[Init] Fetching all data for page initialization...');
        try {
            const [cashFlowData, spendingData, goalsData] = await Promise.all([
                fetchCashFlowData(),
                fetchCategorizedSpending('monthly'),
                fetchSavingsGoals()
            ]);

            console.log('[Init] Data fetched. Rendering components...');

            if (cashFlowData) {
                renderCashFlowChart(cashFlowData.income, cashFlowData.expenses, cashFlowData.netIncome);
            }
            if (spendingData) {
                renderCategorizedSpendingChart(spendingData);
            }
            if (goalsData) {
                populateGoalsTable(goalsData);
            }

            generateFinancialInsights(cashFlowData, spendingData, goalsData);

        } catch (error) {
            console.error('[Init] Error during data fetching and page initialization:', error);
            Swal.fire('Error', 'Could not load budgeting data. Please try again later.', 'error');
        }
    }

    // --- Financial Insights Generation ---
    function generateFinancialInsights(cashFlowData, spendingData, goalsData) {
        console.log('[Insights] Starting financial insights generation...');
        const insightsList = document.getElementById('insights-list');
        insightsList.innerHTML = '<li class="list-group-item">Analyzing your financial data...</li>';

        const insights = [];

        if (cashFlowData) {
            const { income, expenses, netIncome } = cashFlowData;
            console.log(`[Insights] Cash Flow Data: Income=${income}, Expenses=${expenses}, Net=${netIncome}`);
            if (netIncome > 0) {
                insights.push(`<strong>Positive Cash Flow:</strong> You've earned $${netIncome.toFixed(2)} more than you spent. Well done!`);
            } else {
                insights.push(`<strong>Negative Cash Flow:</strong> You've spent $${Math.abs(netIncome).toFixed(2)} more than you earned. Let's review your spending.`);
            }
        }

        if (spendingData && spendingData.length > 0) {
            const topCategory = spendingData.reduce((prev, current) => (prev.value > current.value) ? prev : current);
            console.log(`[Insights] Top Spending Category: ${topCategory.name} at $${topCategory.value.toFixed(2)}`);
            insights.push(`<strong>Top Spending Category:</strong> Your highest spending this month was on "${topCategory.name}" ($${topCategory.value.toFixed(2)}).`);
        }

        if (goalsData && goalsData.length > 0) {
            const completedGoals = goalsData.filter(g => g.currentAmount >= g.targetAmount);
            const onTrackGoals = goalsData.filter(g => g.currentAmount < g.targetAmount && (g.currentAmount / g.targetAmount) >= 0.5);
            console.log(`[Insights] Goals: ${completedGoals.length} completed, ${onTrackGoals.length} on track.`);
            if (completedGoals.length > 0) {
                insights.push(`<strong>Goal Achievement:</strong> Congratulations on completing ${completedGoals.length} savings goal(s)!`);
            } else if (onTrackGoals.length > 0) {
                insights.push(`<strong>Goal Progress:</strong> You're making great progress on ${onTrackGoals.length} of your savings goals! Keep it up!`);
            }
        }

        console.log(`[Insights] Generated ${insights.length} insights.`);
        displayInsights(insights);
    }

    function displayInsights(insights) {
        const insightsList = document.getElementById('insights-list');
        if (insights.length === 0) {
            insightsList.innerHTML = '<li class="list-group-item">No specific insights to show right now. Link an account to get started!</li>';
            return;
        }
        insightsList.innerHTML = insights.map(insight => `<li class="list-group-item"><i class="fa fa-check-circle text-success me-2"></i>${insight}</li>`).join('');
    }

    // --- Data Fetching ---
    async function checkForLinkedAccounts() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/plaid/accounts', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) return false;
            const data = await response.json();
            return Object.values(data).some(arr => Array.isArray(arr) && arr.length > 0);
        } catch (error) {
            console.error('Error checking for linked accounts:', error);
            return false;
        }
    }

    async function fetchApi(url, options = {}) {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        return response.json();
    }

    async function fetchCategorizedSpending(period = 'monthly') {
        try {
            return await fetchApi(`/plaid/spending?period=${period}`);
        } catch (error) {
            console.error(`Error fetching spending data for period ${period}:`, error);
            return null;
        }
    }

    async function fetchSavingsGoals() {
        try {
            return await fetchApi('/api/goals');
        } catch (error) {
            console.error('Error fetching savings goals:', error);
            return null;
        }
    }

    async function fetchCashFlowData() {
        try {
            const transactions = await fetchApi('/plaid/transactions/cashflow');
            return analyzeCashFlow(transactions);
        } catch (error) {
            console.error('Error fetching cash flow data:', error);
            return null;
        }
    }

    // --- Data Processing ---
    function analyzeCashFlow(transactions) {
        if (!Array.isArray(transactions)) {
            console.error('Invalid transactions data received:', transactions);
            return { income: 0, expenses: 0, netIncome: 0 };
        }
        let income = 0;
        let expenses = 0;
        transactions.forEach(t => {
            // Plaid transactions: negative amounts are credits (income), positive are debits (expenses)
            if (t.amount < 0) {
                income += Math.abs(t.amount);
            } else {
                expenses += t.amount;
            }
        });
        return { income, expenses, netIncome: income - expenses };
    }

    // --- Chart and Table Rendering ---
    function renderCashFlowChart(income, expenses, netIncome) {
        if (!document.getElementById('cashFlowChart')) return;
        if (cashFlowChart) cashFlowChart.destroy();
        const options = {
            series: [{ name: 'Income', data: [income] }, { name: 'Expenses', data: [expenses] }],
            chart: { type: 'bar', height: 350, stacked: true, toolbar: { show: false } },
            plotOptions: { bar: { horizontal: false } },
            xaxis: { categories: ['Cash Flow'] },
            yaxis: { title: { text: 'Amount (USD)' } },
            colors: ['#28a745', '#dc3545'],
            tooltip: { y: { formatter: val => `$${val.toFixed(2)}` } }
        };
        cashFlowChart = new ApexCharts(document.getElementById('cashFlowChart'), options);
        cashFlowChart.render();
    }

    function renderCategorizedSpendingChart(data) {
        if (!document.getElementById('categorizedSpendingChart')) return;
        if (spendingChart) spendingChart.destroy();
        spendingChart = new ApexCharts(document.getElementById('categorizedSpendingChart'), getSpendingChartOptions(data));
        spendingChart.render();
        renderSpendingBreakdown(data);
    }

    function getSpendingChartOptions(data) {
        return {
            series: data.map(item => item.value),
            chart: { type: 'donut', height: 350, toolbar: { show: false } },
            labels: data.map(item => item.name),
            colors: ['#009cde', '#f2c500', '#28a745', '#dc3545', '#6f42c1', '#fd7e14', '#20c997'],
            legend: { position: 'bottom' },
            dataLabels: { enabled: true, formatter: val => `${val.toFixed(1)}%` },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Total Spent',
                                formatter: w => `$${w.globals.seriesTotals.reduce((a, b) => a + b, 0).toFixed(2)}`
                            }
                        }
                    }
                }
            },
            tooltip: { y: { formatter: val => `$${val.toFixed(2)}` } }
        };
    }

    function renderSpendingBreakdown(data) {
        const breakdownElement = document.getElementById('categorizedSpendingBreakdown');
        if (!breakdownElement) return;
        breakdownElement.innerHTML = '<ul class="list-group list-group-flush">' + 
            data.map(item => `<li class="list-group-item d-flex justify-content-between align-items-center">${item.name}<span class="badge bg-primary rounded-pill">$${item.value.toFixed(2)}</span></li>`).join('') + 
            '</ul>';
    }

    function populateGoalsTable(goals) {
        if (!goalsTable) return;
        goalsTable.clear();
        goals.forEach(goal => addGoalToTable(goal));
        goalsTable.draw();
    }

    function addGoalToTable(goal) {
        if (!goalsTable) return;
        const rowNode = goalsTable.row.add([
            goal.name,
            `$${goal.targetAmount.toFixed(2)}`,
            `$${goal.currentAmount.toFixed(2)}`,
            new Date(goal.endDate).toLocaleDateString(),
            `<div id="goal-progress-${goal._id}" class="goal-progress-chart"></div>`,
            `<button class="btn btn-sm btn-primary edit-goal-btn" data-id="${goal._id}" data-bs-toggle="modal" data-bs-target="#editGoalModal">Edit</button> <button class="btn btn-sm btn-danger delete-goal-btn" data-id="${goal._id}">Delete</button>`
        ]).node();
        $(rowNode).attr('id', `goal-${goal._id}`);
        renderGoalProgress(goal);
    }

    function renderGoalProgress(goal) {
        const chartId = `goal-progress-${goal._id}`;
        const percentage = (goal.currentAmount / goal.targetAmount) * 100;
        setTimeout(() => {
            const chartEl = document.getElementById(chartId);
            if (chartEl) {
                 if (chartEl.chart) chartEl.chart.destroy();
                 const chart = new ApexCharts(chartEl, getGoalProgressOptions(percentage));
                 chartEl.chart = chart;
                 chart.render();
            }
        }, 100);
    }

    function getGoalProgressOptions(percentage) {
        return {
            series: [percentage],
            chart: { type: 'radialBar', height: 80, sparkline: { enabled: true } },
            plotOptions: {
                radialBar: {
                    hollow: { size: '60%' },
                    dataLabels: { name: { show: false }, value: { show: true, offsetY: 5, formatter: val => `${Math.round(val)}%` } }
                }
            },
            stroke: { lineCap: 'round' },
            labels: ['Progress'],
        };
    }

    // --- Event Handlers and UI ---
    function initializeSortByDropdown() {
        document.querySelectorAll('.sort-by-dropdown .dropdown-item').forEach(item => {
            item.addEventListener('click', function (event) {
                event.preventDefault();
                const period = this.getAttribute('data-period');
                document.getElementById('sortByDropdown').textContent = this.textContent;
                fetchCategorizedSpending(period).then(data => {
                    if (data) renderCategorizedSpendingChart(data);
                });
            });
        });
    }

    function initializeGoalEventHandlers() {
        $('#addGoalForm').on('submit', handleAddGoal);
        $('#editGoalForm').on('submit', handleUpdateGoal);
        $('#goalsTable tbody').on('click', '.edit-goal-btn', function () {
            const goalId = $(this).data('id');
            populateEditGoalModal(goalId);
        });
        $('#goalsTable tbody').on('click', '.delete-goal-btn', function () {
            const goalId = $(this).data('id');
            confirmDeleteGoal(goalId);
        });
    }

    async function handleAddGoal(event) {
        event.preventDefault();
        const goalData = {
            name: $('#goal-name').val(),
            targetAmount: parseFloat($('#goal-target-amount').val()),
            currentAmount: parseFloat($('#goal-current-amount').val()) || 0,
            endDate: $('#goal-end-date').val()
        };

        try {
            const newGoal = await fetchApi('/api/goals', { method: 'POST', body: JSON.stringify(goalData) });
            addGoalToTable(newGoal);
            bootstrap.Modal.getInstance(document.getElementById('addGoalModal')).hide();
            $('#addGoalForm')[0].reset();
            Swal.fire('Success', 'Savings goal added!', 'success');
        } catch (error) {
            console.error('Error adding goal:', error);
            Swal.fire('Error', 'Could not add savings goal.', 'error');
        }
    }

    async function populateEditGoalModal(goalId) {
        try {
            const goal = await fetchApi(`/api/goals/${goalId}`);
            $('#edit-goal-id').val(goal._id);
            $('#edit-name').val(goal.name);
            $('#edit-targetAmount').val(goal.targetAmount);
            $('#edit-currentAmount').val(goal.currentAmount);
            $('#edit-endDate').val(new Date(goal.endDate).toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error fetching goal for edit:', error);
            Swal.fire('Error', 'Could not load goal data for editing.', 'error');
        }
    }

    async function handleUpdateGoal(event) {
        event.preventDefault();
        const goalId = $('#edit-goal-id').val();
        const goalData = {
            name: $('#edit-name').val(),
            targetAmount: parseFloat($('#edit-targetAmount').val()),
            currentAmount: parseFloat($('#edit-currentAmount').val()),
            endDate: $('#edit-endDate').val()
        };

        try {
            const updatedGoal = await fetchApi(`/api/goals/${goalId}`, { method: 'PUT', body: JSON.stringify(goalData) });
            updateGoalInTable(updatedGoal);
            bootstrap.Modal.getInstance(document.getElementById('editGoalModal')).hide();
            Swal.fire('Success', 'Savings goal updated!', 'success');
        } catch (error) {
            console.error('Error updating goal:', error);
            Swal.fire('Error', 'Could not update savings goal.', 'error');
        }
    }

    function updateGoalInTable(goal) {
        if (!goalsTable) return;
        const row = $(`#goal-${goal._id}`);
        if (row.length) {
            goalsTable.row(row).data([
                goal.name,
                `$${goal.targetAmount.toFixed(2)}`,
                `$${goal.currentAmount.toFixed(2)}`,
                new Date(goal.endDate).toLocaleDateString(),
                `<div id="goal-progress-${goal._id}" class="goal-progress-chart"></div>`,
                `<button class="btn btn-sm btn-primary edit-goal-btn" data-id="${goal._id}" data-bs-toggle="modal" data-bs-target="#editGoalModal">Edit</button> <button class="btn btn-sm btn-danger delete-goal-btn" data-id="${goal._id}">Delete</button>`
            ]).draw();
            renderGoalProgress(goal);
        }
    }

    async function confirmDeleteGoal(goalId) {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            deleteGoal(goalId);
        }
    }

    async function deleteGoal(goalId) {
        try {
            await fetchApi(`/api/goals/${goalId}`, { method: 'DELETE' });
            goalsTable.row($(`#goal-${goalId}`)).remove().draw();
            Swal.fire('Deleted!', 'Your savings goal has been deleted.', 'success');
        } catch (error) {
            console.error('Error deleting goal:', error);
            Swal.fire('Error', 'Could not delete savings goal.', 'error');
        }
    }

    // --- DataTable Initialization ---
    $(document).ready(function () {
        if (!$.fn.DataTable.isDataTable('#goalsTable')) {
            goalsTable = $('#goalsTable').DataTable({
                responsive: true,
                paging: false,
                searching: false,
                info: false,
                lengthChange: false,
                scrollX: true,
                columnDefs: [
                    { targets: [4, 5], orderable: false } // Disable sorting for progress and actions
                ]
            });
        }
        initializeBudgetingPage();
    });
});
