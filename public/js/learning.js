document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM fully loaded and parsed. Initializing learning.js...');

    const formatCurrency = (value, digits = 2) => `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
    let userFinancialData = { assets: 0, liabilities: 0 };
    let netWorthBenchmarkChart, retirementBenchmarkChart;

    console.log('Global variables initialized.');

    // --- General Inputs ---
    const annualIncomeEl = document.getElementById('annual-income');
    const monthlyHousingEl = document.getElementById('monthly-housing-cost');

    // --- Income Insights ---
    const incomeAnalysisSection = document.getElementById('income-analysis-section');
    // Emergency Fund
    const insightEmergencyFundGoal = document.getElementById('insight-emergency-fund-goal');
    const insightEmergencyFundActual = document.getElementById('insight-emergency-fund-actual');
    const insightEmergencyFundStatus = document.getElementById('insight-emergency-fund-status');
    const insightEmergencyFundProgress = document.getElementById('insight-emergency-fund-progress');
    // Housing
    const insightHousingGuideline = document.getElementById('insight-housing-guideline');
    const insightHousingActual = document.getElementById('insight-housing-actual');
    const insightHousingStatus = document.getElementById('insight-housing-status');

    function updateIncomeInsights() {
        console.log('--- Running updateIncomeInsights ---');
        const incomeStr = annualIncomeEl.value.replace(/,/g, '');
        const income = parseFloat(incomeStr) || 0;
        const housingCostStr = monthlyHousingEl.value.replace(/,/g, '');
        const housingCost = parseFloat(housingCostStr) || 0;
        console.log(`Income: ${income}, Housing Cost: ${housingCost}`);

        if (income <= 0) {
            incomeAnalysisSection.style.display = 'none';
            return;
        }
        
        incomeAnalysisSection.style.display = 'flex';

        // --- Calculations ---
        const monthlyIncome = income / 12;
        const emergencyFundGoal = monthlyIncome * 3; // 3-month goal
        const housingGuideline = monthlyIncome * 0.28;

        // --- Emergency Fund Insight ---
        insightEmergencyFundGoal.textContent = formatCurrency(emergencyFundGoal, 0);
        const liquidAssets = userFinancialData.liquidAssets || 0;
        insightEmergencyFundActual.textContent = formatCurrency(liquidAssets, 0);

        const progress = emergencyFundGoal > 0 ? Math.min((liquidAssets / emergencyFundGoal) * 100, 100) : 0;
        insightEmergencyFundProgress.style.width = `${progress}%`;
        insightEmergencyFundProgress.setAttribute('aria-valuenow', progress);
        
        let statusClass = 'danger';
        let statusText = `This is your most important financial shield. Let's start building it.`;
        if (progress >= 100) {
            statusClass = 'success';
            statusText = `Excellent! Your emergency fund is fully funded.`;
            insightEmergencyFundProgress.classList.add('bg-success');
        } else if (progress > 50) {
            statusClass = 'warning';
            statusText = `You're over halfway there! Keep up the great work.`;
            insightEmergencyFundProgress.classList.remove('bg-success');
        } else {
             insightEmergencyFundProgress.classList.remove('bg-success');
        }
        insightEmergencyFundStatus.innerHTML = `<div class="badge bg-${statusClass}-subtle text-${statusClass}">${statusText}</div>`;


        // --- Housing Guideline Insight ---
        insightHousingGuideline.textContent = `${formatCurrency(housingGuideline, 0)}/mo`;
        if (housingCost > 0) {
            insightHousingActual.textContent = formatCurrency(housingCost, 0);
            if (housingCost <= housingGuideline) {
                insightHousingStatus.innerHTML = `<div class="badge bg-success-subtle text-success">Your housing costs are within the recommended guideline.</div>`;
            } else {
                 insightHousingStatus.innerHTML = `<div class="badge bg-warning-subtle text-warning">Your housing is above the guideline. This can make other goals harder to reach.</div>`;
            }
        } else {
            insightHousingActual.innerHTML = `<span class="text-muted">(Enter cost above)</span>`;
            insightHousingStatus.innerHTML = '';
        }
        
        console.log('--- Finished updateIncomeInsights ---');
    }

    function formatMonetaryInput(event) {
        const input = event.target;
        let value = input.value.replace(/[^0-9]/g, '');
        if (value) {
            value = parseInt(value, 10).toLocaleString('en-US');
            input.value = value;
        } else {
            input.value = '';
        }
    }

    // --- Financial Health Snapshot ---
    async function fetchFinancialSnapshot() {
        console.log('Attempting to fetch financial snapshot...');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/financial-snapshot', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Failed to fetch snapshot. Status: ${response.status}`);
            const data = await response.json();
            console.log('Successfully fetched financial snapshot data:', data);

            userFinancialData = data;

            document.getElementById('snapshot-net-worth').textContent = formatCurrency(data.netWorth);
            document.getElementById('snapshot-assets').textContent = formatCurrency(data.assets);
            document.getElementById('snapshot-liabilities').textContent = formatCurrency(data.liabilities);
            
            // Now that we have data, update the income insights if income is already entered
            updateIncomeInsights();

        } catch (error) {
            console.error('Error fetching financial snapshot:', error);
        }
    }

    // --- Net Worth Simulator ---
    const simAssets = document.getElementById('sim-assets');
    const simLiabilities = document.getElementById('sim-liabilities');
    const simAssetsVal = document.getElementById('sim-assets-val');
    const simLiabilitiesVal = document.getElementById('sim-liabilities-val');
    const simResult = document.getElementById('sim-networth-result');
    const simInsight = document.getElementById('sim-networth-insight');
    const simBenchmark = document.getElementById('sim-networth-benchmark');

    function updateNetWorthSimulator() {
        console.log('--- Running updateNetWorthSimulator ---');
        const assets = parseFloat(simAssets.value) || 0;
        const liabilities = parseFloat(simLiabilities.value) || 0;
        const netWorth = assets - liabilities;
        console.log(`Assets: ${assets}, Liabilities: ${liabilities}, Net Worth: ${netWorth}`);

        simAssetsVal.textContent = assets.toLocaleString();
        simLiabilitiesVal.textContent = liabilities.toLocaleString();
        simResult.textContent = formatCurrency(netWorth);

        const incomeStr = annualIncomeEl.value.replace(/,/g, '');
        const income = parseFloat(incomeStr) || 0;
        const age = parseFloat(document.getElementById('ret-current-age').value) || 0;
        console.log(`Income: ${income}, Age: ${age} for benchmark.`);
        
        if (income > 0 && age > 0) {
            const benchmarkNetWorth = (age * income) / 10;
            const difference = netWorth - benchmarkNetWorth;
            console.log(`Calculated Benchmark Net Worth: ${benchmarkNetWorth}`);
            
            if (netWorthBenchmarkChart) {
                console.log('Updating Net Worth Benchmark Chart.');
                netWorthBenchmarkChart.updateSeries([{
                    name: 'Your Net Worth',
                    data: [netWorth]
                }, {
                    name: 'Benchmark',
                    data: [benchmarkNetWorth]
                }]);
            }

            if (difference >= 0) {
                simBenchmark.innerHTML = `<i class="fa fa-star text-success"></i> On track! You're ${formatCurrency(difference, 0)} ahead of a key benchmark.`;
                simBenchmark.classList.remove('text-danger');
                simBenchmark.classList.add('text-success');
            } else {
                simBenchmark.innerHTML = `<i class="fa fa-line-chart text-danger"></i> You're ${formatCurrency(Math.abs(difference), 0)} behind a key benchmark. Let's close the gap!`;
                simBenchmark.classList.remove('text-success');
                simBenchmark.classList.add('text-danger');
            }
        } else {
            console.log('Skipping benchmark calculation (no income/age).');
            if (netWorthBenchmarkChart) {
                 netWorthBenchmarkChart.updateSeries([{ data: [netWorth] }, { data: [0] }]);
            }
        }

        const ratio = assets > 0 ? liabilities / assets : 0;
        let insight = '';
        let vineTip = '';

        if (assets === 0 && liabilities === 0) {
            insight = "Let's get started! Use the sliders to see how assets and liabilities affect your net worth.";
            vineTip = "<b>Vine Finance Tip:</b> Connect your accounts on the <a href='/accounts.html'>My Accounts</a> page to automatically load your financial data.";
        } else if (ratio < 0.5) {
            insight = "This is a <strong>strong</strong> financial position. Your assets far outweigh your liabilities, giving you a solid foundation for wealth creation.";
            vineTip = "<b>Vine Finance Tip:</b> With a strong net worth, consider optimizing your investments. Use our <a href='/retirement.html'>Retirement Planning</a> tools to ensure you're maximizing growth.";
        } else if (ratio < 0.8) {
            insight = "You're in a <strong>healthy</strong> spot. You have a good handle on your debt relative to your assets.";
            vineTip = "<b>Vine Finance Tip:</b> To accelerate growth, use our <a href='/budgeting.html'>Budget Management</a> tool to identify savings opportunities that can be redirected to investments.";
        } else if (ratio < 1) {
            insight = "You're getting close to a 1:1 asset-to-liability ratio. It's a good time to focus on reducing high-interest debt.";
            vineTip = "<b>Vine Finance Tip:</b> Track all your debts in one place on the <a href='/accounts.html'>My Accounts</a> page. Seeing the full picture helps prioritize a paydown strategy.";
        } else {
            insight = "Your liabilities currently exceed your assets. Making a plan to reduce debt is a critical next step.";
            vineTip = "<b>Vine Finance Tip:</b> Let's build a plan. Use the <a href='/budgeting.html'>Budget Management</a> tool to find cash flow for debt repayment and track your progress.";
        }
        simInsight.innerHTML = `${insight}<br>${vineTip}`;
        console.log('--- Finished updateNetWorthSimulator ---');
    }

    // --- Savings Simulator ---
    const savingsAmount = document.getElementById('savings-amount');
    const savingsRate = document.getElementById('savings-rate');
    const savingsResult = document.getElementById('savings-result');
    const savingsInsight = document.getElementById('savings-insight');

    function calculateSavings() {
        console.log('--- Running calculateSavings ---');
        const weeklySavings = parseFloat(savingsAmount.value) || 0;
        const annualRate = parseFloat(savingsRate.value) || 0;
        console.log(`Weekly Savings: ${weeklySavings}, Annual Rate: ${annualRate}`);
        const monthlyContribution = weeklySavings * 4.345;
        const rate = annualRate / 100;
        let futureValue = 0;
        for (let i = 0; i < 120; i++) {
            futureValue = (futureValue + monthlyContribution) * (1 + rate / 12);
        }
        savingsResult.textContent = formatCurrency(futureValue);
        let insight = '', vineTip = '';
        if (futureValue < 25000) {
            insight = `Saving ${formatCurrency(weeklySavings)} per week is a great start! Consistency is key to building wealth.`;
            vineTip = "<b>Vine Finance Tip:</b> Even small increases can have a huge impact over time. Use our <a href='/budgeting.html'>Budgeting Tool</a> to find an extra $20-$50 per week.";
        } else if (futureValue < 75000) {
            insight = `You're on track to build a significant nest egg. This amount could serve as a great down payment or major investment in 10 years.`;
            vineTip = "<b>Vine Finance Tip:</b> Make sure your savings are working hard for you. Link your investment accounts on the <a href='/accounts.html'>My Accounts</a> page to track their performance against your goals.";
        } else {
            insight = "This is powerful! Your savings habits are generating substantial wealth, unlocking major financial goals in the next decade.";
            vineTip = "<b>Vine Finance Tip:</b> As your portfolio grows, sophisticated strategies become more important. Explore our <a href='/retirement.html'>Retirement</a> and <a href='/realestate.html'>Real Estate</a> tools to diversify and optimize.";
        }
        savingsInsight.innerHTML = `${insight}<br>${vineTip}`;
        console.log('--- Finished calculateSavings ---');
    }

    // --- Retirement Calculator ---
    const retInputs = ['ret-current-age', 'ret-retire-age', 'ret-current-savings', 'ret-annual-contrib', 'ret-growth-rate'];
    const retResult = document.getElementById('ret-result');
    const retInsight = document.getElementById('ret-insight');
    const retBenchmark = document.getElementById('ret-benchmark');

    function calculateRetirement() {
        console.log('--- Running calculateRetirement ---');
        const values = retInputs.map(id => parseFloat(document.getElementById(id).value) || 0);
        const [currentAge, retireAge, currentSavings, annualContrib, growthRate] = values;
        console.log(`Retirement Inputs:`, { currentAge, retireAge, currentSavings, annualContrib, growthRate });
        const yearsToGrow = retireAge - currentAge;

        // --- Pre-calculate future value to allow smarter feedback ---
        let futureValue = currentSavings;
        if (yearsToGrow > 0) {
            const rate = growthRate / 100;
            for (let i = 0; i < yearsToGrow; i++) {
                futureValue = (futureValue + annualContrib) * (1 + rate);
            }
        }
        retResult.textContent = formatCurrency(futureValue);
        const isFutureExcellent = futureValue >= 1500000;

        // --- Benchmark Calculation ---
        const incomeStr = annualIncomeEl.value.replace(/,/g, '');
        const income = parseFloat(incomeStr) || 0;
        let isBehindBenchmark = false;

        if (income > 0 && currentAge > 0) {
            const getMultiplier = (age) => {
                if (age < 30) return 0.5; if (age < 40) return 1.5; if (age < 50) return 4; if (age < 60) return 6; return 8;
            };
            const benchmarkSavings = income * getMultiplier(currentAge);
            if (retirementBenchmarkChart) {
                retirementBenchmarkChart.updateSeries([{ data: [currentSavings] }, { data: [benchmarkSavings] }]);
            }
            const difference = currentSavings - benchmarkSavings;

            if (difference >= 0) {
                retBenchmark.innerHTML = `<div class="badge bg-success-subtle text-success">You're ahead of the savings benchmark for your age!</div>`;
                isBehindBenchmark = false;
            } else { // Behind benchmark...
                isBehindBenchmark = true;
                if (isFutureExcellent) {
                    // If behind now, but future is bright, show a positive/neutral message
                    retBenchmark.innerHTML = `<div class="badge bg-info-subtle text-info">Your savings plan is strong enough to overcome a slow start.</div>`;
                } else {
                    // If behind now and future is NOT bright, show a warning.
                    retBenchmark.innerHTML = `<div class="badge bg-danger-subtle text-danger">You're behind the savings benchmark for your age.</div>`;
                }
            }
        } else {
            retBenchmark.innerHTML = ''; // No income/age, no benchmark.
            if (retirementBenchmarkChart) {
                retirementBenchmarkChart.updateSeries([{ data: [currentSavings] }, { data: [0] }]);
            }
        }
        
        // --- Insight Text Generation ---
        if (yearsToGrow <= 0) {
            retInsight.innerHTML = "You're at or past your target retirement age. The goal now is wealth preservation and generating income.<br><b>Vine Finance Tip:</b> Connect your accounts to get a holistic view of your portfolio and ensure your withdrawal strategy is sustainable.";
            return;
        }

        let insight = '', vineTip = '';
        if (futureValue < 500000) {
            insight = `Based on these numbers, you're projected to have ${formatCurrency(futureValue)} by age ${retireAge}. Let's work on boosting that!`;
            vineTip = "<b>Vine Finance Tip:</b> Use the <a href='/budgeting.html'>Budgeting Tool</a> to increase your annual contributions. Every extra dollar has decades to grow.";
        } else if (futureValue < 1500000) {
            insight = `You're on a solid path to a comfortable retirement with a projected ${formatCurrency(futureValue)}.`;
            vineTip = "<b>Vine Finance Tip:</b> To secure your position, use the <a href='/retirement.html'>Retirement Planner</a> to run more detailed scenarios and stress-test your plan.";
        } else { // isFutureExcellent is true
            if (isBehindBenchmark) {
                insight = `Even though you're starting from behind the benchmark, your strong contribution plan has you on track for an excellent retirement of ${formatCurrency(futureValue)}!`;
            } else {
                insight = `Excellent! You're ahead of the benchmark and on track for a very well-funded retirement, projected at ${formatCurrency(futureValue)}.`;
            }
            vineTip = "<b>Vine Finance Tip:</b> With a large portfolio, consider advanced strategies. Our tools can help you analyze diversification, including <a href='/realestate.html'>Real Estate</a>, to protect and grow your wealth.";
        }
        retInsight.innerHTML = `${insight}<br>${vineTip}`;
        console.log('--- Finished calculateRetirement ---');
    }

    // --- Real Estate ROI Calculator ---
    const reInputs = ['re-purchase-price', 're-down-payment', 're-monthly-rent', 're-monthly-expenses'];
    const reResult = document.getElementById('re-result');
    const reInsight = document.getElementById('re-insight');

    function calculateROI() {
        console.log('--- Running calculateROI ---');
        const values = reInputs.map(id => parseFloat(document.getElementById(id).value) || 0);
        const [price, downPayment, rent, expenses] = values;
        const annualCashFlow = (rent - expenses) * 12;
        if (downPayment <= 0) {
            reResult.textContent = '0%';
            reInsight.innerHTML = "A down payment is required to calculate your return.<br><b>Vine Finance Tip:</b> The larger your down payment, the lower your mortgage and the higher your potential cash flow.";
            return;
        }
        const roi = (annualCashFlow / downPayment) * 100;
        reResult.textContent = `${roi.toFixed(2)}%`;
        let insight = '', vineTip = '';
        if (roi < 5) {
            insight = `A ${roi.toFixed(2)}% cash-on-cash return is a starting point, but could be low depending on the market and your goals. Often, appreciation is a key factor not shown here.`;
            vineTip = "<b>Vine Finance Tip:</b> Use our <a href='/realestate.html'>Real Estate tracker</a> to log property value over time and see your total return, including appreciation.";
        } else if (roi < 10) {
            insight = `A ${roi.toFixed(2)}% return is generally considered a <strong>good</strong> cash-on-cash ROI for a rental property.`;
            vineTip = "<b>Vine Finance Tip:</b> Manage your properties efficiently. Link the associated bank accounts in Vine Finance to easily track rental income and expenses.";
        } else {
            insight = `A ${roi.toFixed(2)}% cash-on-cash ROI is <strong>excellent</strong>. This property is generating strong cash flow relative to your investment.`;
            vineTip = "<b>Vine Finance Tip:</b> With high-performing assets, consider your overall portfolio. Are you diversified? Explore other investment modules to balance your strategy.";
        }
        reInsight.innerHTML = `${insight}<br>${vineTip}`;
        console.log('--- Finished calculateROI ---');
    }

    // --- Tax Planning Module ---
    const taxFilingStatusEl = document.getElementById('tax-filing-status');
    const tax401kContribEl = document.getElementById('tax-401k-contrib');
    const taxHsaEligibleEl = document.getElementById('tax-hsa-eligible');
    const taxIraContribEl = document.getElementById('tax-ira-contrib');
    const taxCapitalGainsEl = document.getElementById('tax-capital-gains');
    const taxCharitableDonationsEl = document.getElementById('tax-charitable-donations');
    const taxScoreTextEl = document.getElementById('tax-score-text');
    const taxRecommendationsListEl = document.getElementById('tax-recommendations-list');
    let taxScoreChart;

    const TAX_CONSTANTS = {
        '2024': {
            'catchUpAge': 50,
            'catchUpAmount': 7500,
            '401kMax': 23000,
            'iraMax': 7000,
            'hsaMaxSingle': 4150,
            'hsaMaxFamily': 8300,
            'rothLimitSingle': 161000,
            'rothLimitMfj': 240000,
            'capitalLossDeduction': 3000,
            'taxBrackets': {
                'single': { 0: 0.10, 11600: 0.12, 47150: 0.22, 100525: 0.24, 191950: 0.32, 243725: 0.35, 609350: 0.37 },
                'mfj': { 0: 0.10, 23200: 0.12, 94300: 0.22, 201050: 0.24, 383900: 0.32, 487450: 0.35, 731300: 0.37 }
            }
        }
    };

    function updateTaxAnalysis() {
        console.log('--- [TAX DEBUG] Running updateTaxAnalysis ---');
        const year = '2024';
        const C = TAX_CONSTANTS[year]; // Constants for the year

        // --- Gather all inputs ---
        const income = parseFloat(annualIncomeEl.value.replace(/,/g, '')) || 0;
        const age = parseFloat(document.getElementById('ret-current-age').value) || 0;
        const filingStatus = taxFilingStatusEl.value;
        const contrib401k = parseFloat(tax401kContribEl.value.replace(/,/g, '')) || 0;
        const contribIra = parseFloat(taxIraContribEl.value.replace(/,/g, '')) || 0;
        const hsaEligible = taxHsaEligibleEl.value === 'yes';
        const capitalGainsStatus = taxCapitalGainsEl.value;
        const donations = parseFloat(taxCharitableDonationsEl.value.replace(/,/g, '')) || 0;
        console.log(`[TAX DEBUG] Inputs: income=${income}, age=${age}, status=${filingStatus}, 401k=${contrib401k}, ira=${contribIra}, hsa=${hsaEligible}, gains=${capitalGainsStatus}, donations=${donations}`);


        let score = 0;
        let recommendations = [];

        if (income === 0) {
            taxRecommendationsListEl.innerHTML = `<p class="text-muted">Enter your income and tax profile to get started.</p>`;
            updateTaxScore(0, 'Initial');
            return;
        }

        const isOver50 = age >= C.catchUpAge;
        const currentTaxRate = getTaxRate(income, filingStatus);
        console.log(`[TAX DEBUG] Prelim: isOver50=${isOver50}, taxRate=${currentTaxRate}`);

        // 1. 401(k) Analysis
        const max401k = C['401kMax'] + (isOver50 ? C.catchUpAmount : 0);
        if (contrib401k >= max401k) {
            score += 25;
            console.log(`[TAX DEBUG] 401k: Maxed out. Score +25. Current score: ${score}`);
        } else {
            const partScore = 25 * (contrib401k / max401k);
            score += partScore;
            console.log(`[TAX DEBUG] 401k: Not maxed. Part score +${partScore}. Current score: ${score}`);
            const potentialSavings = (max401k - contrib401k) * currentTaxRate;
            recommendations.push({
                title: 'Maximize Workplace Retirement Plan',
                text: `Your contribution limit is <strong>${formatCurrency(max401k, 0)}</strong>${isOver50 ? ' (including catch-up)' : ''}. By contributing an additional ${formatCurrency(max401k - contrib401k, 0)}, you could save an estimated <strong>${formatCurrency(potentialSavings, 0)}</strong> on this year's taxes.`,
                priority: 'high'
            });
        }
        
        // 2. IRA Analysis
        const maxIra = C.iraMax + (isOver50 ? 1000 : 0); // IRA catch-up is different
         if (contribIra >= maxIra) {
            score += 20;
            console.log(`[TAX DEBUG] IRA: Maxed out. Score +20. Current score: ${score}`);
        } else {
            const partScore = 20 * (contribIra / maxIra);
            score += partScore;
            console.log(`[TAX DEBUG] IRA: Not maxed. Part score +${partScore}. Current score: ${score}`);
            const rothLimit = C[filingStatus === 'single' ? 'rothLimitSingle' : 'rothLimitMfj'];
            if(income < rothLimit) {
                 recommendations.push({
                    title: 'Maximize IRA Contributions',
                    text: `You are eligible to contribute up to <strong>${formatCurrency(maxIra, 0)}</strong> to a Traditional or Roth IRA. Increasing your contribution by ${formatCurrency(maxIra - contribIra, 0)} can significantly boost your retirement savings.`,
                    priority: 'high'
                });
            }
        }

        // 3. HSA Analysis
        if (hsaEligible) {
            const hsaMax = filingStatus === 'single' ? C.hsaMaxSingle : C.hsaMaxFamily;
            const highIncomeThreshold = 200000;
            let hsaText = '';

            if (income < highIncomeThreshold) {
                hsaText = `Because you're HSA-eligible, you can contribute up to <strong>${formatCurrency(hsaMax,0)}</strong>. This account has a powerful triple tax advantage (deductible contributions, tax-free growth, tax-free medical withdrawals) and there are no income limits to contribute.`;
            } else {
                hsaText = `At your income level, an HSA is one of the most powerful retirement accounts available, often called a "stealth IRA." You can contribute up to <strong>${formatCurrency(hsaMax,0)}</strong>. Maxing it out is a high-priority strategy for building long-term, tax-free wealth, even if you don't need it for current medical expenses.`;
            }
            
            score += 20; // Full score for eligibility regardless of income
            console.log(`[TAX DEBUG] HSA: Eligible. Score +20. Current score: ${score}`);

            recommendations.push({
                title: 'Contribute to Health Savings Account (HSA)',
                text: hsaText,
                priority: 'high'
            });
        }
        
        // 4. Advanced & Situational Strategies
        const rothLimit = C[filingStatus === 'single' ? 'rothLimitSingle' : 'rothLimitMfj'];
        if (income > rothLimit) {
            score += 10;
            console.log(`[TAX DEBUG] Backdoor Roth: Eligible. Score +10. Current score: ${score}`);
            recommendations.push({
                title: 'Execute a Backdoor Roth IRA',
                text: `Your income is above the direct Roth IRA contribution limit. A Backdoor Roth IRA is a strategy used by high-income earners to access these powerful tax-free growth accounts.`,
                priority: 'medium'
            });
        }
        
        if(capitalGainsStatus === 'gain') {
            score += 10;
            console.log(`[TAX DEBUG] Cap Gains: Has gains. Score +10. Current score: ${score}`);
            recommendations.push({ title: 'Tax-Loss Harvesting', text: `You indicated you have net capital gains. Consider selling investments at a loss to offset those gains, which could reduce your tax bill significantly.`, priority: 'medium' });
        } else if (capitalGainsStatus === 'loss') {
            score += 5; // A little score for having the info
            console.log(`[TAX DEBUG] Cap Gains: Has losses. Score +5. Current score: ${score}`);
            recommendations.push({ title: 'Capital Loss Deduction', text: `You indicated a net capital loss. Remember you can deduct up to <strong>${formatCurrency(C.capitalLossDeduction,0)}</strong> of capital losses against your ordinary income per year.`, priority: 'low' });
        }
        
        if (donations > 0) {
            score += 10;
            console.log(`[TAX DEBUG] Donations: Has donations. Score +10. Current score: ${score}`);
             recommendations.push({ title: 'Optimize Charitable Giving', text: `For your ${formatCurrency(donations,0)} in donations, consider giving appreciated stock instead of cash. You can often deduct the full market value while avoiding capital gains tax on the appreciation.`, priority: 'low' });
        }


        renderTaxRecommendations(recommendations);
        updateTaxScore(Math.min(Math.round(score), 100), 'Final');
    }
    
    function getTaxRate(income, filingStatus) {
        const brackets = TAX_CONSTANTS['2024'].taxBrackets[filingStatus];
        let rate = 0;
        for (const limit in brackets) {
            if (income > limit) {
                rate = brackets[limit];
            }
        }
        return rate;
    }

    function renderTaxRecommendations(recommendations) {
        if (recommendations.length === 0) {
            taxRecommendationsListEl.innerHTML = `<p class="text-success">Based on your profile, you're already using many key tax strategies!</p>`;
            return;
        }
        
        const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        
        taxRecommendationsListEl.innerHTML = recommendations.map(rec => `
            <div class="mb-3">
                <h6 class="mb-1">${rec.title} <span class="badge bg-${rec.priority === 'high' ? 'danger' : 'info'}-subtle text-${rec.priority === 'high' ? 'danger' : 'info'}">${rec.priority} priority</span></h6>
                <p class="text-muted mb-0">${rec.text}</p>
            </div>
        `).join('');
    }

    function updateTaxScore(score, source) {
        console.log(`[TAX DEBUG] updateTaxScore called from ${source} with score: ${score}`);
        taxScoreTextEl.textContent = `${score}/100`;
        let color = '#dc3545'; // red
        if (score > 80) color = '#198754'; // green
        else if (score > 50) color = '#ffc107'; // yellow

        if (taxScoreChart) {
            taxScoreChart.updateOptions({
                series: [score],
                colors: [color]
            });
        }
    }

    // --- Chart Initialization ---
    function initializeCharts() {
        console.log('Initializing charts...');
        try {
            const globalChartOptions = (theme, yFormatter) => ({
                chart: { type: 'bar', height: 120, toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit', foreColor: theme === 'dark' ? '#adb5bd' : '#343a40' },
                plotOptions: { bar: { horizontal: false, columnWidth: '50%', distributed: true, } },
                dataLabels: { enabled: false }, stroke: { width: 0 }, grid: { show: false },
                yaxis: { show: false, labels: { formatter: (val) => yFormatter(val) } },
                xaxis: { categories: ['Your Value', 'Benchmark'], labels: { show: false } },
                legend: { show: false },
                tooltip: { theme: theme, y: { formatter: (val) => yFormatter(val) } }
            });
            const theme = document.body.getAttribute('data-bs-theme') || 'light';
            const currencyFormatter = (val) => formatCurrency(val, 0);
            
            netWorthBenchmarkChart = new ApexCharts(document.querySelector("#net-worth-benchmark-chart"), globalChartOptions(theme, currencyFormatter));
            console.log('Net worth chart object created.');
            retirementBenchmarkChart = new ApexCharts(document.querySelector("#retirement-benchmark-chart"), globalChartOptions(theme, currencyFormatter));
            console.log('Retirement chart object created.');
            
            const taxScoreOptions = {
                chart: { height: 160, type: 'radialBar' },
                series: [0],
                plotOptions: {
                    radialBar: {
                        hollow: { size: '65%' },
                        dataLabels: {
                            name: { show: false },
                            value: { show: false }
                        }
                    }
                },
                stroke: { lineCap: "round" },
            };
            taxScoreChart = new ApexCharts(document.querySelector("#tax-score-chart"), taxScoreOptions);
            console.log('Tax score chart object created.');

            netWorthBenchmarkChart.render();
            retirementBenchmarkChart.render();
            taxScoreChart.render();
            console.log('Charts rendered.');
        } catch(e) {
            console.error("!!!!!!!! CHART INITIALIZATION FAILED! !!!!!!!!", e);
            console.error("This is likely because apexcharts.min.js was not loaded before learning.js. Please check the script tags in public/learning.html.");
        }
    }

    // --- Main Initializations & Event Listeners ---
    function initialize() {
        console.log('Starting main initialization...');
        fetchFinancialSnapshot();
        initializeCharts();

        console.log('Setting up event listeners...');
        const allCalcInputs = [ ...retInputs, ...reInputs, 'annual-income', 'sim-assets', 'sim-liabilities', 'savings-amount', 'savings-rate' ];
        allCalcInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    console.log(`Input event on: #${id}`);
                    if (id === 'annual-income' || id === 'ret-current-age') {
                        if (id === 'annual-income') formatMonetaryInput(e);
                        updateIncomeInsights();
                        updateTaxAnalysis();
                    }
                    updateNetWorthSimulator();
                    calculateRetirement();
                    calculateROI();
                    calculateSavings();
                });
            } else {
                console.warn(`Element with ID #${id} not found for event listener.`);
            }
        });

        monthlyHousingEl.addEventListener('input', (e) => {
            formatMonetaryInput(e);
            updateIncomeInsights();
        });

        [taxFilingStatusEl, taxHsaEligibleEl, taxCapitalGainsEl].forEach(el => {
            el.addEventListener('change', updateTaxAnalysis);
        });
        [tax401kContribEl, taxIraContribEl, taxCharitableDonationsEl].forEach(el => {
             el.addEventListener('input', (e) => {
                formatMonetaryInput(e);
                updateTaxAnalysis();
            });
        });

        document.getElementById('load-my-data').addEventListener('click', () => {
            console.log('Load My Data button clicked.');
            simAssets.value = userFinancialData.assets;
            simLiabilities.value = userFinancialData.liabilities;
            updateNetWorthSimulator();
        });
        console.log('Event listeners setup complete.');

        // Initial calculations
        console.log('Performing initial calculations...');
        updateNetWorthSimulator();
        calculateSavings();
        calculateRetirement();
        calculateROI();
        updateTaxAnalysis();
        console.log('Initial calculations complete.');
        console.log('Initialization finished.');
    }

    initialize();
}); 