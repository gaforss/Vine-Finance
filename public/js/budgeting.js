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
            initializeInsightsRefresh();

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

            console.log('[Init] Data fetched successfully:', {
                cashFlowData: cashFlowData ? 'present' : 'null',
                spendingData: spendingData ? `${spendingData.length} items` : 'null',
                goalsData: goalsData ? `${goalsData.length} items` : 'null'
            });

            console.log('[Init] Detailed spending data analysis:');
            if (spendingData && Array.isArray(spendingData)) {
                console.log(`[Init] Spending categories count: ${spendingData.length}`);
                console.log(`[Init] Spending categories:`, spendingData.map(item => item.name));
                console.log(`[Init] Spending values:`, spendingData.map(item => `$${item.value.toFixed(2)}`));
            } else {
                console.log('[Init] No spending data available or invalid format');
            }

            console.log('[Init] Rendering components...');

            if (cashFlowData) {
                console.log('[Init] Rendering cash flow chart...');
                renderCashFlowChart(cashFlowData.income, cashFlowData.expenses, cashFlowData.netIncome);
            } else {
                console.log('[Init] No cash flow data available for chart');
            }
            
            if (spendingData) {
                console.log('[Init] Rendering spending chart...');
                renderCategorizedSpendingChart(spendingData);
            } else {
                console.log('[Init] No spending data available for chart');
            }
            
            if (goalsData) {
                console.log('[Init] Rendering goals table...');
                populateGoalsTable(goalsData);
            } else {
                console.log('[Init] No goals data available for table');
            }

            console.log('[Init] Generating financial insights...');
            generateFinancialInsights(cashFlowData, spendingData, goalsData);

        } catch (error) {
            console.error('[Init] Error during data fetching and page initialization:', error);
            Swal.fire('Error', 'Could not load budgeting data. Please try again later.', 'error');
        }
    }

    // --- Financial Insights Generation ---
    function generateFinancialInsights(cashFlowData, spendingData, goalsData) {
        console.log('[Insights] Starting financial insights generation...');
        console.log('[Insights] Input data:', { 
            cashFlowData: cashFlowData ? 'present' : 'null', 
            spendingData: spendingData ? `${spendingData.length} items` : 'null', 
            goalsData: goalsData ? `${goalsData.length} items` : 'null' 
        });
        
        const insightsList = document.getElementById('insights-list');
        if (!insightsList) {
            console.error('[Insights] Insights list element not found!');
            return;
        }
        
        // Show loading state
        insightsList.innerHTML = `
            <div class="insight-loading">
                <div class="loading-spinner">
                    <i class="fa fa-spinner fa-spin"></i>
                </div>
                <p>Analyzing your financial data...</p>
            </div>`;

        const insights = [];

        // Cash Flow Insights
        if (cashFlowData && typeof cashFlowData === 'object') {
            const { income, expenses, netIncome } = cashFlowData;
            console.log(`[Insights] Cash Flow Data: Income=$${income}, Expenses=$${expenses}, Net=$${netIncome}`);
            
            if (income > 0 || expenses > 0) {
                if (netIncome > 0) {
                    const savingsRate = income > 0 ? ((netIncome / income) * 100).toFixed(1) : 0;
                    insights.push(`<strong>Positive Cash Flow:</strong> You're saving $${netIncome.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} monthly (${savingsRate}% savings rate). Excellent work!`);
                    console.log(`[Insights] Added positive cash flow insight with ${savingsRate}% savings rate`);
                } else if (netIncome < 0) {
                    insights.push(`<strong>Negative Cash Flow:</strong> You're spending $${Math.abs(netIncome).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} more than you earn. Consider reviewing your expenses.`);
                    console.log(`[Insights] Added negative cash flow insight`);
                } else {
                    insights.push(`<strong>Balanced Budget:</strong> Your income and expenses are perfectly balanced. Great job maintaining financial equilibrium!`);
                    console.log(`[Insights] Added balanced budget insight`);
                }
                
                // Add spending efficiency insight
                if (income > 0) {
                    const expenseRatio = ((expenses / income) * 100).toFixed(1);
                    if (expenseRatio > 90) {
                        insights.push(`<strong>High Expense Ratio:</strong> You're spending ${expenseRatio}% of your income. Consider ways to reduce expenses or increase income.`);
                    } else if (expenseRatio < 70) {
                        insights.push(`<strong>Excellent Expense Management:</strong> You're only spending ${expenseRatio}% of your income. Great job keeping expenses low!`);
                    }
                    console.log(`[Insights] Expense ratio: ${expenseRatio}%`);
                }
            } else {
                console.log('[Insights] No cash flow data available for insights');
            }
        } else {
            console.log('[Insights] Cash flow data is null or invalid');
        }

        // Spending Category Insights
        if (spendingData && Array.isArray(spendingData) && spendingData.length > 0) {
            console.log(`[Insights] Processing ${spendingData.length} spending categories`);
            console.log('[Insights] Raw spending data:', JSON.stringify(spendingData, null, 2));
            
            const topCategory = spendingData.reduce((prev, current) => (prev.value > current.value) ? prev : current);
            const totalSpending = spendingData.reduce((sum, item) => sum + item.value, 0);
            const topCategoryPercentage = totalSpending > 0 ? ((topCategory.value / totalSpending) * 100).toFixed(1) : 0;
            
            console.log(`[Insights] Top Spending Category: ${topCategory.name} at $${topCategory.value.toFixed(2)} (${topCategoryPercentage}%)`);
            console.log(`[Insights] Total spending across all categories: $${totalSpending.toFixed(2)}`);
            console.log('[Insights] All spending categories:', spendingData.map(item => `${item.name}: $${item.value.toFixed(2)}`));
            
            // Enhanced top category analysis
            if (topCategoryPercentage > 50) {
                insights.push(`<strong>High Concentration:</strong> "${topCategory.name}" dominates your spending at ${topCategoryPercentage}% ($${topCategory.value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}). Consider diversifying your expenses.`);
            } else if (topCategoryPercentage > 30) {
                insights.push(`<strong>Top Spending Category:</strong> "${topCategory.name}" represents ${topCategoryPercentage}% of your total spending ($${topCategory.value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}).`);
            } else {
                insights.push(`<strong>Well-Balanced Spending:</strong> Your top category "${topCategory.name}" is only ${topCategoryPercentage}% of total spending, showing excellent diversification.`);
            }
            
            // Add spending diversity insight with more detail
            console.log(`[Insights] Category count analysis: ${spendingData.length} categories found`);
            console.log(`[Insights] Category names:`, spendingData.map(item => item.name));
            
            if (spendingData.length >= 8) {
                insights.push(`<strong>Excellent Spending Diversity:</strong> You have ${spendingData.length} different spending categories, showing exceptional financial diversification and detailed tracking.`);
                console.log(`[Insights] Added excellent diverse spending insight for ${spendingData.length} categories`);
            } else if (spendingData.length >= 5) {
                insights.push(`<strong>Diverse Spending:</strong> You have ${spendingData.length} different spending categories, showing good financial diversification.`);
                console.log(`[Insights] Added diverse spending insight for ${spendingData.length} categories`);
            } else if (spendingData.length <= 2) {
                insights.push(`<strong>Concentrated Spending:</strong> You have only ${spendingData.length} spending categories. Consider tracking more detailed categories for better insights.`);
                console.log(`[Insights] Added concentrated spending insight for ${spendingData.length} categories`);
            }
            
            // Enhanced spending pattern analysis
            const highSpendingCategories = spendingData.filter(item => (item.value / totalSpending) > 0.3);
            const mediumSpendingCategories = spendingData.filter(item => (item.value / totalSpending) > 0.1 && (item.value / totalSpending) <= 0.3);
            const lowSpendingCategories = spendingData.filter(item => (item.value / totalSpending) <= 0.1);
            
            console.log(`[Insights] High spending categories (>30%):`, highSpendingCategories.map(item => `${item.name}: ${((item.value / totalSpending) * 100).toFixed(1)}%`));
            console.log(`[Insights] Medium spending categories (10-30%):`, mediumSpendingCategories.map(item => `${item.name}: ${((item.value / totalSpending) * 100).toFixed(1)}%`));
            console.log(`[Insights] Low spending categories (<10%):`, lowSpendingCategories.map(item => `${item.name}: ${((item.value / totalSpending) * 100).toFixed(1)}%`));
            
            if (highSpendingCategories.length > 0) {
                insights.push(`<strong>High Concentration Areas:</strong> ${highSpendingCategories.length} categor${highSpendingCategories.length > 1 ? 'ies' : 'y'} account${highSpendingCategories.length > 1 ? '' : 's'} for over 30% of your spending. Focus on these areas for maximum impact.`);
                console.log(`[Insights] Added high concentration insight for ${highSpendingCategories.length} categories`);
            }
            
            // Spending health analysis
            const essentialCategories = ['FOOD AND DRINK', 'TRANSPORTATION', 'PERSONAL CARE', 'LOAN PAYMENTS'];
            const discretionaryCategories = ['ENTERTAINMENT', 'TRAVEL', 'GENERAL MERCHANDISE'];
            
            const essentialSpending = spendingData
                .filter(item => essentialCategories.some(cat => item.name.includes(cat)))
                .reduce((sum, item) => sum + item.value, 0);
            
            const discretionarySpending = spendingData
                .filter(item => discretionaryCategories.some(cat => item.name.includes(cat)))
                .reduce((sum, item) => sum + item.value, 0);
            
            const essentialPercentage = totalSpending > 0 ? ((essentialSpending / totalSpending) * 100).toFixed(1) : 0;
            const discretionaryPercentage = totalSpending > 0 ? ((discretionarySpending / totalSpending) * 100).toFixed(1) : 0;
            
            console.log(`[Insights] Essential spending: $${essentialSpending.toFixed(2)} (${essentialPercentage}%)`);
            console.log(`[Insights] Discretionary spending: $${discretionarySpending.toFixed(2)} (${discretionaryPercentage}%)`);
            
            if (essentialPercentage > 80) {
                insights.push(`<strong>High Essential Spending:</strong> ${essentialPercentage}% of your spending is on essential items. Consider if there are ways to reduce these costs.`);
            } else if (discretionaryPercentage > 50) {
                insights.push(`<strong>High Discretionary Spending:</strong> ${discretionaryPercentage}% of your spending is discretionary. This gives you flexibility to adjust spending as needed.`);
            } else {
                insights.push(`<strong>Balanced Spending Mix:</strong> You have a healthy balance of essential (${essentialPercentage}%) and discretionary (${discretionaryPercentage}%) spending.`);
            }
            
            // Spending efficiency analysis
            const averageSpendingPerCategory = totalSpending / spendingData.length;
            const highValueCategories = spendingData.filter(item => item.value > averageSpendingPerCategory * 2);
            const lowValueCategories = spendingData.filter(item => item.value < averageSpendingPerCategory * 0.5);
            
            console.log(`[Insights] Average spending per category: $${averageSpendingPerCategory.toFixed(2)}`);
            console.log(`[Insights] High value categories (>2x average):`, highValueCategories.map(item => item.name));
            console.log(`[Insights] Low value categories (<0.5x average):`, lowValueCategories.map(item => item.name));
            
            if (highValueCategories.length > 0) {
                insights.push(`<strong>High-Value Categories:</strong> ${highValueCategories.length} categor${highValueCategories.length > 1 ? 'ies' : 'y'} are significantly above average spending. Review if these align with your priorities.`);
            }
            
            if (lowValueCategories.length > 0) {
                insights.push(`<strong>Low-Value Categories:</strong> ${lowValueCategories.length} categor${lowValueCategories.length > 1 ? 'ies' : 'y'} are well below average. These may be good areas for optimization.`);
            }
            
        } else {
            console.log('[Insights] No spending data available for insights');
            console.log('[Insights] Spending data type:', typeof spendingData);
            console.log('[Insights] Spending data value:', spendingData);
        }

        // Goals Insights
        if (goalsData && Array.isArray(goalsData) && goalsData.length > 0) {
            console.log(`[Insights] Processing ${goalsData.length} savings goals`);
            
            const completedGoals = goalsData.filter(g => g.currentAmount >= g.targetAmount);
            const onTrackGoals = goalsData.filter(g => g.currentAmount < g.targetAmount && (g.currentAmount / g.targetAmount) >= 0.5);
            const behindGoals = goalsData.filter(g => g.currentAmount < g.targetAmount && (g.currentAmount / g.targetAmount) < 0.5);
            
            console.log(`[Insights] Goals breakdown: ${completedGoals.length} completed, ${onTrackGoals.length} on track, ${behindGoals.length} behind`);
            
            if (completedGoals.length > 0) {
                insights.push(`<strong>Goal Achievement:</strong> Congratulations! You've completed ${completedGoals.length} savings goal${completedGoals.length > 1 ? 's' : ''}.`);
            }
            
            if (onTrackGoals.length > 0) {
                insights.push(`<strong>On Track:</strong> You're making great progress on ${onTrackGoals.length} goal${onTrackGoals.length > 1 ? 's' : ''}. Keep up the momentum!`);
            }
            
            if (behindGoals.length > 0) {
                insights.push(`<strong>Needs Attention:</strong> ${behindGoals.length} goal${behindGoals.length > 1 ? 's are' : ' is'} behind schedule. Consider increasing your savings rate.`);
            }
            
            // Add overall progress insight
            const totalProgress = goalsData.reduce((sum, goal) => sum + (goal.currentAmount / goal.targetAmount), 0) / goalsData.length * 100;
            if (totalProgress > 75) {
                insights.push(`<strong>Excellent Progress:</strong> You're ${totalProgress.toFixed(1)}% of the way to achieving all your goals!`);
            } else if (totalProgress < 25) {
                insights.push(`<strong>Early Stage:</strong> You're ${totalProgress.toFixed(1)}% of the way to your goals. Keep building momentum!`);
            }
            
            console.log(`[Insights] Overall goals progress: ${totalProgress.toFixed(1)}%`);
        } else {
            console.log('[Insights] No goals data available for insights');
        }

        // Add general financial health insight
        if (insights.length === 0) {
            insights.push(`<strong>Getting Started:</strong> Link your accounts to get personalized financial insights and track your progress!`);
        }

        console.log(`[Insights] Generated ${insights.length} insights total`);
        displayInsights(insights);
    }

    function displayInsights(insights) {
        console.log('[Insights] Displaying insights:', insights.length);
        
        // Store insights globally for deletion functionality
        window.currentInsights = insights;
        
        const insightsList = document.getElementById('insights-list');
        if (!insightsList) {
            console.error('[Insights] Insights list element not found in displayInsights!');
            return;
        }
        
        if (insights.length === 0) {
            console.log('[Insights] No insights to display, showing empty state');
            insightsList.innerHTML = `
                <div class="insight-empty">
                    <div class="insight-empty-icon">
                        <i class="fa fa-chart-line"></i>
                    </div>
                    <h5>No insights available yet</h5>
                    <p class="text-muted">Link your accounts to get personalized financial insights and track your progress!</p>
                </div>`;
            return;
        }
        
        console.log('[Insights] Rendering insights to DOM');
        insightsList.innerHTML = insights.map((insight, index) => {
            // Determine insight type and icon based on content
            let iconClass = 'info';
            let icon = 'fa-info-circle';
            
            if (insight.includes('Positive') || insight.includes('Excellent') || insight.includes('Congratulations') || insight.includes('Great')) {
                iconClass = 'success';
                icon = 'fa-check-circle';
            } else if (insight.includes('Negative') || insight.includes('behind') || insight.includes('High') || insight.includes('Needs Attention')) {
                iconClass = 'danger';
                icon = 'fa-exclamation-triangle';
            } else if (insight.includes('Consider') || insight.includes('Concentrated') || insight.includes('High Concentration')) {
                iconClass = 'warning';
                icon = 'fa-lightbulb-o';
            }
            
            return `
                <div class="insight-card" data-insight-index="${index}">
                    <button class="delete-btn" onclick="deleteInsight(${index})" title="Delete insight">×</button>
                    <div class="insight-header">
                        <div class="insight-icon ${iconClass}">
                            <i class="fa ${icon}"></i>
                        </div>
                        <div>
                            <h6 class="insight-title">Insight ${index + 1}</h6>
                        </div>
                    </div>
                    <p class="insight-content">${insight}</p>
                </div>
            `;
        }).join('');
        
        console.log('[Insights] Successfully rendered insights to DOM');
    }

    function deleteInsight(index) {
        console.log(`[Insights] Deleting insight at index ${index}`);
        
        // Remove the insight from the current insights array
        if (window.currentInsights && window.currentInsights[index]) {
            window.currentInsights.splice(index, 1);
            
            // Re-display the insights with updated indices
            displayInsights(window.currentInsights);
            
            console.log(`[Insights] Insight deleted. ${window.currentInsights.length} insights remaining`);
        }
    }

    // Make deleteInsight globally accessible
    window.deleteInsight = deleteInsight;

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
            console.log(`[Spending] Fetching categorized spending data for period: ${period}`);
            const data = await fetchApi(`/plaid/spending?period=${period}`);
            console.log(`[Spending] Received data from backend:`, data);
            console.log(`[Spending] Data type:`, typeof data);
            console.log(`[Spending] Is array:`, Array.isArray(data));
            console.log(`[Spending] Data length:`, data ? data.length : 'null');
            
            if (data && Array.isArray(data)) {
                console.log(`[Spending] Categories found:`, data.length);
                console.log(`[Spending] Category breakdown:`, data.map(item => `${item.name}: $${item.value}`));
            }
            
            return data;
        } catch (error) {
            console.error(`[Spending] Error fetching spending data for period ${period}:`, error);
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
                        try {
                            const seriesName = opts.seriesNames && opts.seriesNames[opts.seriesIndex] ? opts.seriesNames[opts.seriesIndex] : 'Series';
                            return seriesName + ': $' + parseFloat(val || 0).toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            });
                        } catch (error) {
                            console.error('[Chart] Error in tooltip formatter:', error);
                            return '$0';
                        }
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
                    try {
                        if (opts.w && opts.w.globals && opts.w.globals.seriesPercent && 
                            opts.w.globals.seriesPercent[opts.seriesIndex] && 
                            opts.w.globals.seriesPercent[opts.seriesIndex][0] !== undefined) {
                            return opts.w.globals.seriesPercent[opts.seriesIndex][0].toFixed(1) + '%';
                        } else {
                            // Fallback to calculating percentage manually
                            const total = opts.w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? (val / total * 100) : 0;
                            return percentage.toFixed(1) + '%';
                        }
                    } catch (error) {
                        console.error('[Chart] Error in dataLabels formatter:', error);
                        return '0%';
                    }
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
                                    try {
                                        return '$' + parseFloat(val || 0).toLocaleString('en-US', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        });
                                    } catch (error) {
                                        console.error('[Chart] Error in value formatter:', error);
                                        return '$0';
                                    }
                                }
                            },
                            total: {
                                show: true,
                                label: 'Total Spent',
                                fontSize: '14px',
                                fontWeight: 600,
                                formatter: function(w) {
                                    try {
                                        if (w.globals && w.globals.seriesTotals && w.globals.seriesTotals.length > 0) {
                                            const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                            return '$' + total.toLocaleString('en-US', {
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 0
                                            });
                                        } else {
                                            return '$0';
                                        }
                                    } catch (error) {
                                        console.error('[Chart] Error in total formatter:', error);
                                        return '$0';
                                    }
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
                        try {
                            return '$' + parseFloat(val || 0).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            });
                        } catch (error) {
                            console.error('[Chart] Error in spending tooltip formatter:', error);
                            return '$0.00';
                        }
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
            data.map(item => `<li class="list-group-item d-flex justify-content-between align-items-center">${item.name}<span class="badge bg-primary rounded-pill">$${parseFloat(item.value).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></li>`).join('') + 
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
            `$${parseFloat(goal.targetAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
            `$${parseFloat(goal.currentAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
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
        $('#add-goal-form').on('submit', handleAddGoal);
        $('#edit-goal-form').on('submit', handleUpdateGoal);
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
            name: $('#name').val(),
            targetAmount: parseFloat($('#targetAmount').val()),
            currentAmount: parseFloat($('#currentAmount').val()) || 0,
            endDate: $('#endDate').val()
        };

        try {
            const newGoal = await fetchApi('/api/goals', { method: 'POST', body: JSON.stringify(goalData) });
            addGoalToTable(newGoal);
            // Reset form and collapse accordion instead of hiding modal
            $('#add-goal-form')[0].reset();
            $('#collapseOne-1').collapse('hide');
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
                `$${parseFloat(goal.targetAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
                `$${parseFloat(goal.currentAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
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

    function initializeInsightsRefresh() {
        console.log('[Insights] Initializing refresh functionality...');
        const refreshButton = document.getElementById('refresh-insights');
        if (refreshButton) {
            refreshButton.addEventListener('click', async function() {
                console.log('[Insights] Refresh button clicked');
                this.disabled = true;
                this.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
                
                try {
                    // Fetch fresh data
                    const [cashFlowData, spendingData, goalsData] = await Promise.all([
                        fetchCashFlowData(),
                        fetchCategorizedSpending('monthly'),
                        fetchSavingsGoals()
                    ]);
                    
                    // Regenerate insights
                    generateFinancialInsights(cashFlowData, spendingData, goalsData);
                    
                    console.log('[Insights] Insights refreshed successfully');
                } catch (error) {
                    console.error('[Insights] Error refreshing insights:', error);
                    Swal.fire('Error', 'Could not refresh insights. Please try again.', 'error');
                } finally {
                    // Reset button
                    this.disabled = false;
                    this.innerHTML = '<i class="fa fa-refresh"></i>';
                }
            });
            console.log('[Insights] Refresh button event listener added');
        } else {
            console.error('[Insights] Refresh button not found');
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
