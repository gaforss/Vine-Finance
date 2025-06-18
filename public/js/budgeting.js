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
        insightsList.innerHTML = '<li class="list-group-item"><i class="fa fa-spinner fa-spin me-2"></i>Analyzing your financial data...</li>';

        const insights = [];

        if (cashFlowData) {
            const { income, expenses, netIncome } = cashFlowData;
            console.log(`[Insights] Cash Flow Data: Income=${income}, Expenses=${expenses}, Net=${netIncome}`);
            
            if (netIncome > 0) {
                const savingsRate = ((netIncome / income) * 100).toFixed(1);
                insights.push(`<strong>Positive Cash Flow:</strong> You're saving $${netIncome.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} monthly (${savingsRate}% savings rate). Excellent work!`);
            } else {
                insights.push(`<strong>Negative Cash Flow:</strong> You're spending $${Math.abs(netIncome).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} more than you earn. Consider reviewing your expenses.`);
            }
        }

        if (spendingData && spendingData.length > 0) {
            const topCategory = spendingData.reduce((prev, current) => (prev.value > current.value) ? prev : current);
            const totalSpending = spendingData.reduce((sum, item) => sum + item.value, 0);
            const topCategoryPercentage = ((topCategory.value / totalSpending) * 100).toFixed(1);
            
            console.log(`[Insights] Top Spending Category: ${topCategory.name} at $${topCategory.value.toFixed(2)}`);
            insights.push(`<strong>Top Spending Category:</strong> "${topCategory.name}" represents ${topCategoryPercentage}% of your total spending ($${topCategory.value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}).`);
        }

        if (goalsData && goalsData.length > 0) {
            const completedGoals = goalsData.filter(g => g.currentAmount >= g.targetAmount);
            const onTrackGoals = goalsData.filter(g => g.currentAmount < g.targetAmount && (g.currentAmount / g.targetAmount) >= 0.5);
            const behindGoals = goalsData.filter(g => g.currentAmount < g.targetAmount && (g.currentAmount / g.targetAmount) < 0.5);
            
            console.log(`[Insights] Goals: ${completedGoals.length} completed, ${onTrackGoals.length} on track, ${behindGoals.length} behind.`);
            
            if (completedGoals.length > 0) {
                insights.push(`<strong>Goal Achievement:</strong> Congratulations! You've completed ${completedGoals.length} savings goal${completedGoals.length > 1 ? 's' : ''}.`);
            }
            
            if (onTrackGoals.length > 0) {
                insights.push(`<strong>On Track:</strong> You're making great progress on ${onTrackGoals.length} goal${onTrackGoals.length > 1 ? 's' : ''}. Keep up the momentum!`);
            }
            
            if (behindGoals.length > 0) {
                insights.push(`<strong>Needs Attention:</strong> ${behindGoals.length} goal${behindGoals.length > 1 ? 's are' : ' is'} behind schedule. Consider increasing your savings rate.`);
            }
        }

        console.log(`[Insights] Generated ${insights.length} insights.`);
        displayInsights(insights);
    }

    function displayInsights(insights) {
        const insightsList = document.getElementById('insights-list');
        if (insights.length === 0) {
            insightsList.innerHTML = `
                <li class="list-group-item">
                    <div class="d-flex align-items-center">
                        <i class="fa fa-info-circle text-info me-3"></i>
                        <div>
                            <strong>No specific insights to show right now.</strong><br>
                            <small class="text-muted">Link an account to get started!</small>
                        </div>
                    </div>
                </li>`;
            return;
        }
        
        insightsList.innerHTML = insights.map(insight => `
            <li class="list-group-item">
                <div class="d-flex align-items-start">
                    <i class="fa fa-check-circle text-success me-3 mt-1"></i>
                    <div>${insight}</div>
                </div>
            </li>
        `).join('');
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
            console.log('[Debug] Transactions fetched for cash flow:', transactions);
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
        console.log('[Debug] Cash flow calculated:', { income, expenses, netIncome: income - expenses });
        return { income, expenses, netIncome: income - expenses };
    }

    // --- Chart and Table Rendering ---
    function renderCashFlowChart(income, expenses, netIncome) {
        if (!document.getElementById('cashFlowChart')) return;
        if (cashFlowChart) cashFlowChart.destroy();
        console.log('[Debug] Rendering cash flow chart with:', { income, expenses, netIncome });
        
        // Create time-based data for better flow visualization
        const currentDate = new Date();
        const dates = [];
        const incomeData = [];
        const expensesData = [];
        const netData = [];
        
        // Generate data for the last 7 days to show flow
        for (let i = 6; i >= 0; i--) {
            const date = new Date(currentDate);
            date.setDate(date.getDate() - i);
            dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Simulate daily variations (in real app, this would come from actual transaction data)
            const dailyIncome = income / 7 * (0.8 + Math.random() * 0.4); // ±20% variation
            const dailyExpenses = expenses / 7 * (0.8 + Math.random() * 0.4);
            const dailyNet = dailyIncome - dailyExpenses;
            
            incomeData.push(Math.round(dailyIncome));
            expensesData.push(Math.round(dailyExpenses));
            netData.push(Math.round(dailyNet));
        }
        
        const options = {
            series: [
                {
                    name: 'Income',
                    type: 'area',
                    data: incomeData,
                    color: '#0070ba'
                },
                {
                    name: 'Expenses',
                    type: 'area',
                    data: expensesData,
                    color: '#009cde'
                },
                {
                    name: 'Net Cash Flow',
                    type: 'line',
                    data: netData,
                    color: '#28a745'
                }
            ],
            chart: {
                height: 300,
                type: 'line',
                background: 'transparent',
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                    animateGradually: {
                        enabled: true,
                        delay: 150
                    },
                    dynamicAnimation: {
                        enabled: true,
                        speed: 350
                    }
                },
                toolbar: {
                    show: false
                }
            },
            stroke: {
                curve: 'smooth',
                width: [0, 0, 3],
                dashArray: [0, 0, 0]
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: 'vertical',
                    shadeIntensity: 0.3,
                    opacityFrom: 0.7,
                    opacityTo: 0.3,
                    stops: [0, 100]
                }
            },
            dataLabels: {
                enabled: false
            },
            markers: {
                size: 0,
                colors: ['#0070ba', '#009cde', '#28a745'],
                strokeColors: '#fff',
                strokeWidth: 2,
                hover: {
                    size: 0
                }
            },
            xaxis: {
                categories: dates,
                labels: {
                    style: {
                        fontSize: '12px',
                        fontWeight: 600
                    }
                }
            },
            yaxis: {
                title: {
                    text: 'Amount ($)',
                    style: {
                        fontSize: '14px',
                        fontWeight: 600
                    }
                },
                labels: {
                    formatter: function(val) {
                        return '$' + parseFloat(val).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        });
                    }
                }
            },
            tooltip: {
                shared: true,
                intersect: false,
                y: {
                    formatter: function(val, opts) {
                        const seriesName = opts.seriesNames[opts.seriesIndex];
                        return seriesName + ': $' + parseFloat(val).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        });
                    }
                }
            },
            legend: {
                position: 'top',
                horizontalAlign: 'center',
                fontSize: '14px',
                fontWeight: 600
            },
            grid: {
                borderColor: '#e0e0e0',
                strokeDashArray: 3
            },
            theme: {
                mode: 'light',
                palette: 'palette1'
            },
            colors: ['#0070ba', '#009cde', '#28a745'],
            responsive: [{
                breakpoint: 768,
                options: {
                    chart: {
                        height: 250
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }]
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
            chart: {
                type: 'donut',
                height: 350,
                toolbar: {
                    show: false
                },
                background: 'transparent',
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                    animateGradually: {
                        enabled: true,
                        delay: 150
                    },
                    dynamicAnimation: {
                        enabled: true,
                        speed: 350
                    }
                }
            },
            labels: data.map(item => item.name),
            colors: ['#0070ba', '#009cde', '#003087', '#00aaff', '#66ccff', '#b3e6ff'],
            legend: {
                show: false
            },
            dataLabels: {
                enabled: true,
                formatter: function(val, opts) {
                    return opts.w.globals.seriesPercent[opts.seriesIndex][0].toFixed(1) + '%';
                },
                style: {
                    fontSize: '11px',
                    fontWeight: 600,
                    colors: ['#fff']
                }
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        background: 'transparent',
                        labels: {
                            show: true,
                            name: {
                                show: true,
                                fontSize: '16px',
                                fontWeight: 600,
                                offsetY: -10
                            },
                            value: {
                                show: true,
                                fontSize: '24px',
                                fontWeight: 700,
                                offsetY: 5,
                                formatter: function(val) {
                                    return '$' + parseFloat(val).toLocaleString('en-US', {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    });
                                }
                            },
                            total: {
                                show: true,
                                label: 'Total Spent',
                                fontSize: '14px',
                                fontWeight: 600,
                                formatter: function(w) {
                                    const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                    return '$' + total.toLocaleString('en-US', {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    });
                                }
                            }
                        }
                    },
                    offsetY: 0
                },
                stroke: {
                    colors: ['#fff'],
                    width: 2
                }
            },
            stroke: {
                width: 2,
                colors: ['#fff']
            },
            tooltip: {
                enabled: true,
                y: {
                    formatter: function(val) {
                        return '$' + parseFloat(val).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                    }
                }
            },
            theme: {
                mode: 'light',
                palette: 'palette1'
            },
            responsive: [{
                breakpoint: 768,
                options: {
                    chart: {
                        height: 300
                    },
                    legend: {
                        position: 'bottom',
                        fontSize: '11px'
                    }
                }
            }]
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
        updateGoalsProgressSummary(goals);
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
        const color = percentage >= 100 ? '#0070ba' : percentage >= 75 ? '#009cde' : percentage >= 50 ? '#003087' : '#00aaff';
        
        return {
            series: [percentage],
            chart: {
                type: 'radialBar',
                height: 80,
                sparkline: {
                    enabled: true
                },
                background: 'transparent'
            },
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 225,
                    hollow: {
                        size: '80%',
                        background: 'transparent',
                        margin: 5
                    },
                    track: {
                        background: '#f2f2f2',
                        strokeWidth: '100%',
                        margin: 0,
                        dropShadow: {
                            enabled: true,
                            top: 2,
                            left: 0,
                            color: '#999',
                            opacity: 0.2,
                            blur: 2
                        }
                    },
                    dataLabels: {
                        name: {
                            show: false
                        },
                        value: {
                            fontSize: '16px',
                            offsetY: 5,
                            fontWeight: 700,
                            color: color,
                            formatter: function(val) {
                                return Math.round(val) + '%';
                            }
                        }
                    }
                }
            },
            stroke: {
                lineCap: 'round',
                width: 3
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'dark',
                    type: 'horizontal',
                    shadeIntensity: 0.3,
                    gradientToColors: [color],
                    inverseColors: false,
                    opacityFrom: 0.5,
                    opacityTo: 0.8,
                    stops: [0, 100]
                }
            },
            colors: [color],
            theme: {
                mode: 'light',
                palette: 'palette1'
            }
        };
    }

    // --- Event Handlers and UI ---
    function initializeSortByDropdown() {
        console.log('[Debug] Initializing sort by dropdown...');
        const dropdownItems = document.querySelectorAll('#dropdownMenuButton1 + .dropdown-menu .dropdown-item');
        console.log('[Debug] Found dropdown items:', dropdownItems.length);
        
        dropdownItems.forEach(item => {
            item.addEventListener('click', function (event) {
                event.preventDefault();
                const period = this.getAttribute('data-period');
                const text = this.textContent;
                
                console.log('[Debug] Sort by clicked:', { period, text });
                
                // Update the dropdown button text
                const buttonText = document.getElementById('dropdownMenuButton1Text');
                if (buttonText) {
                    buttonText.innerHTML = text + ' <i class="fa fa-caret-down ms-1"></i>';
                }
                
                // Fetch and render new data
                fetchCategorizedSpending(period).then(data => {
                    if (data) {
                        console.log('[Debug] Rendering new spending data for period:', period);
                        renderCategorizedSpendingChart(data);
                        renderSpendingBreakdown(data);
                    } else {
                        console.error('[Debug] No data returned for period:', period);
                    }
                }).catch(error => {
                    console.error('[Debug] Error fetching spending data:', error);
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

    // --- Helper Functions for Intuitive Features ---
    
    // Global function for scrolling to sections
    window.scrollToSection = function(sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Global function for refreshing data
    window.refreshData = async function() {
        try {
            // Show loading state
            const refreshBtn = document.querySelector('button[onclick="refreshData()"]');
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;

            // Refresh all data
            await fetchDataAndInitializePage();
            
            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'Data Refreshed!',
                text: 'Your financial data has been updated.',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error('Error refreshing data:', error);
            Swal.fire('Error', 'Failed to refresh data. Please try again.', 'error');
        } finally {
            // Reset button
            const refreshBtn = document.querySelector('button[onclick="refreshData()"]');
            refreshBtn.innerHTML = '<i class="fa fa-refresh"></i> Refresh Data';
            refreshBtn.disabled = false;
        }
    };

    // Update goals progress summary
    function updateGoalsProgressSummary(goals) {
        const summaryElement = document.getElementById('goalsProgressSummary');
        if (!summaryElement || !goals) return;

        const completedGoals = goals.filter(g => g.currentAmount >= g.targetAmount).length;
        const totalGoals = goals.length;
        
        summaryElement.textContent = `${completedGoals}/${totalGoals} Complete`;
        
        // Add color coding
        if (completedGoals === totalGoals && totalGoals > 0) {
            summaryElement.className = 'fw-bold text-success';
        } else if (completedGoals > 0) {
            summaryElement.className = 'fw-bold text-warning';
        } else {
            summaryElement.className = 'fw-bold text-muted';
        }
    }
});
