// Enhanced Learning Center JavaScript with comprehensive functionality
$(document).ready(function() {
    console.log('Learning Center initialized');

    // Check authentication status first
    checkAuthenticationStatus();

    // Initialize all modules
    initializeFinancialSnapshot();
    initializeEducationalArticles();
    initializeInteractiveTools();
    initializeLearningModules();
    initializeTaxPlanning();
    initializeBehavioralFinance();
    initializeMarketEducation();

    // Track page view
    if (typeof mixpanel !== 'undefined') {
        mixpanel.track('Learning Center Page View');
    }
});

// Authentication check function
function checkAuthenticationStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('User not authenticated');
        // Show login prompt in the financial snapshot section
        $('#snapshot-net-worth').text('$0');
        $('#snapshot-assets').text('$0');
        $('#snapshot-liabilities').text('$0');
        
        // Add login prompt
        $('.card-body').first().append(`
            <div class="alert alert-info mt-3">
                <i class="fa fa-info-circle me-2"></i>
                <strong>Login Required:</strong> Please <a href="/login" class="alert-link">log in</a> to view your financial data and get personalized insights.
            </div>
        `);
    } else {
        console.log('User is authenticated');
    }
}

// Financial Snapshot Module
function initializeFinancialSnapshot() {
    console.log('Initializing Financial Snapshot');
    
    // Load user's financial data
    loadUserFinancialData();
    
    // Update snapshot when data changes
    $('#annual-income, #monthly-housing-cost').on('input', function() {
        updateFinancialVitals();
    });
}

function loadUserFinancialData() {
    console.log('Loading user financial data');
    
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No authentication token found');
        updateSnapshotDisplay({
            netWorth: 0,
            assets: 0,
            liabilities: 0
        });
        return;
    }
    
    // Fetch user's financial snapshot data
    $.ajax({
        url: '/api/financial-snapshot',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        success: function(data) {
            console.log('Financial snapshot data loaded:', data);
            updateSnapshotDisplay(data);
        },
        error: function(xhr, status, error) {
            console.log('Error loading financial snapshot data:', error);
            console.log('Status:', xhr.status);
            console.log('Response:', xhr.responseText);
            
            if (xhr.status === 401) {
                console.log('User not authenticated');
                showToast('Please log in to view your financial data', 'warning');
            } else if (xhr.status === 404) {
                console.log('No financial data found');
                showToast('No financial data found. Please add your first net worth entry.', 'info');
            } else {
                console.log('Server error occurred');
                showToast('Unable to load financial data. Please try again later.', 'warning');
            }
            
            // Use default values if no data available
            updateSnapshotDisplay({
                netWorth: 0,
                assets: 0,
                liabilities: 0
            });
        }
    });
}

function updateSnapshotDisplay(data) {
    $('#snapshot-net-worth').text(formatCurrency(data.netWorth || 0));
    $('#snapshot-assets').text(formatCurrency(data.assets || 0));
    $('#snapshot-liabilities').text(formatCurrency(data.liabilities || 0));
    
    // Show income analysis if we have data
    if (data.netWorth !== undefined) {
        $('#income-analysis-section').show();
        updateFinancialVitals();
    }
}

function updateFinancialVitals() {
    const annualIncome = parseFloat($('#annual-income').val().replace(/,/g, '')) || 0;
    const monthlyHousingCost = parseFloat($('#monthly-housing-cost').val().replace(/,/g, '')) || 0;
    
    if (annualIncome > 0) {
        // Emergency fund calculation (3-6 months of expenses)
        const monthlyIncome = annualIncome / 12;
        const emergencyFundGoal = monthlyIncome * 6;
        const currentEmergencyFund = parseFloat($('#snapshot-assets').text().replace(/[$,]/g, '')) || 0;
        const emergencyFundPercentage = Math.min((currentEmergencyFund / emergencyFundGoal) * 100, 100);
        
        $('#insight-emergency-fund-goal').text(formatCurrency(emergencyFundGoal));
        $('#insight-emergency-fund-actual').text(formatCurrency(currentEmergencyFund));
        $('#insight-emergency-fund-progress').css('width', emergencyFundPercentage + '%');
        
        if (emergencyFundPercentage >= 100) {
            $('#insight-emergency-fund-progress').removeClass().addClass('progress-bar bg-success');
            $('#insight-emergency-fund-status').html('<span class="text-success"><i class="fa fa-check-circle"></i> Excellent emergency fund!</span>');
        } else if (emergencyFundPercentage >= 50) {
            $('#insight-emergency-fund-progress').removeClass().addClass('progress-bar bg-warning');
            $('#insight-emergency-fund-status').html('<span class="text-warning"><i class="fa fa-exclamation-triangle"></i> Good progress, keep building!</span>');
        } else {
            $('#insight-emergency-fund-progress').removeClass().addClass('progress-bar bg-danger');
            $('#insight-emergency-fund-status').html('<span class="text-danger"><i class="fa fa-times-circle"></i> Priority: Build emergency fund</span>');
        }
        
        // Housing affordability (28% rule)
        const housingGuideline = monthlyIncome * 0.28;
        $('#insight-housing-guideline').text(formatCurrency(housingGuideline));
        
        if (monthlyHousingCost > 0) {
            $('#insight-housing-actual').text(formatCurrency(monthlyHousingCost));
            
            if (monthlyHousingCost <= housingGuideline) {
                $('#insight-housing-status').html('<span class="text-success"><i class="fa fa-check-circle"></i> Housing cost is within guidelines</span>');
            } else {
                $('#insight-housing-status').html('<span class="text-warning"><i class="fa fa-exclamation-triangle"></i> Housing cost exceeds 28% guideline</span>');
            }
        }
    }
}

// Educational Articles Module
function initializeEducationalArticles() {
    console.log('Initializing Educational Articles');
    
    // Load article status on page load
    updateArticleStatusIndicators();
    updateLearningProgress();
    
    // Handle article clicks
    $('[data-article]').on('click', function(e) {
        e.preventDefault();
        const articleId = $(this).data('article');
        console.log('Article clicked:', articleId);
        
        // Track article view
        if (typeof mixpanel !== 'undefined') {
            mixpanel.track('Article View', {
                article_id: articleId,
                difficulty_level: getArticleDifficulty(articleId)
            });
        }
        
        // Show article content (in a modal or new section)
        showArticleContent(articleId);
    });
}

function getArticleDifficulty(articleId) {
    const beginnerArticles = ['budgeting-basics', 'emergency-fund', 'debt-management', 'credit-score'];
    const intermediateArticles = ['investing-101', 'retirement-planning', 'tax-optimization', 'real-estate'];
    const advancedArticles = ['portfolio-optimization', 'estate-planning', 'alternative-investments', 'tax-advanced'];
    
    if (beginnerArticles.includes(articleId)) return 'beginner';
    if (intermediateArticles.includes(articleId)) return 'intermediate';
    if (advancedArticles.includes(articleId)) return 'advanced';
    return 'beginner';
}

function showArticleContent(articleId) {
    // Get article content
    const articleContent = getArticleContent(articleId);
    
    // Create modal with article content
    const modalHtml = `
        <div class="modal fade" id="articleModal" tabindex="-1" aria-labelledby="articleModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content bg-dark">
                    <div class="modal-header border-bottom border-light">
                        <h5 class="modal-title text-light" id="articleModalLabel">${articleContent.title}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="article-content text-light">
                            ${articleContent.content}
                        </div>
                    </div>
                    <div class="modal-footer border-top border-light">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="markArticleAsRead('${articleId}')">
                            <i class="fa fa-check me-2"></i>Mark as Read
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    $('#articleModal').remove();
    
    // Add modal to body
    $('body').append(modalHtml);
    
    // Show modal
    $('#articleModal').modal('show');
}

function getArticleContent(articleId) {
    const articles = {
        'budgeting-basics': {
            title: 'Budgeting Basics: Your First Steps to Financial Freedom',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-success mb-2">Beginner</div>
                    <p class="text-light-50">Reading time: 8 minutes</p>
                </div>
                
                <h4>What is Budgeting?</h4>
                <p>A budget is your financial roadmap—a plan that helps you track income and expenses to achieve your financial goals. Think of it as giving every dollar a job before the month begins.</p>
                
                <h4>The 50/30/20 Rule</h4>
                <p>This popular budgeting method divides your after-tax income into three categories:</p>
                <ul>
                    <li><strong>50% for Needs:</strong> Housing, utilities, food, transportation, insurance</li>
                    <li><strong>30% for Wants:</strong> Entertainment, dining out, shopping, hobbies</li>
                    <li><strong>20% for Savings:</strong> Emergency fund, retirement, debt repayment</li>
                </ul>
                
                <h4>Step-by-Step Budgeting Process</h4>
                <ol>
                    <li><strong>Track Your Income:</strong> Include all sources—salary, side hustles, investments</li>
                    <li><strong>List All Expenses:</strong> Use bank statements and receipts to capture everything</li>
                    <li><strong>Categorize Spending:</strong> Group expenses into needs, wants, and savings</li>
                    <li><strong>Set Spending Limits:</strong> Allocate amounts to each category</li>
                    <li><strong>Monitor and Adjust:</strong> Review weekly and adjust as needed</li>
                </ol>
                
                <h4>Budgeting Tools</h4>
                <p>Choose the method that works best for you:</p>
                <ul>
                    <li><strong>Apps:</strong> Mint, YNAB, Personal Capital</li>
                    <li><strong>Spreadsheets:</strong> Excel or Google Sheets</li>
                    <li><strong>Envelope System:</strong> Physical cash in labeled envelopes</li>
                    <li><strong>Zero-Based Budgeting:</strong> Every dollar has a purpose</li>
                </ul>
                
                <h4>Common Budgeting Mistakes to Avoid</h4>
                <ul>
                    <li>Setting unrealistic goals</li>
                    <li>Forgetting irregular expenses</li>
                    <li>Not tracking small purchases</li>
                    <li>Giving up after one bad month</li>
                </ul>
                
                <div class="alert alert-info">
                    <h6><i class="fa fa-lightbulb-o me-2"></i>Pro Tip</h6>
                    <p>Start with a simple budget and gradually add complexity. The perfect budget is the one you'll actually stick to!</p>
                </div>
            `
        },
        
        'emergency-fund': {
            title: 'Building Your Emergency Fund: Financial Safety Net 101',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-success mb-2">Beginner</div>
                    <p class="text-light-50">Reading time: 6 minutes</p>
                </div>
                
                <h4>Why You Need an Emergency Fund</h4>
                <p>An emergency fund is your financial safety net—money set aside for unexpected expenses like medical bills, car repairs, or job loss. It prevents you from going into debt when life throws curveballs.</p>
                
                <h4>How Much Should You Save?</h4>
                <p><strong>General Rule:</strong> 3-6 months of living expenses</p>
                <ul>
                    <li><strong>3 months:</strong> If you have stable income and low expenses</li>
                    <li><strong>6 months:</strong> If you're self-employed or have variable income</li>
                    <li><strong>9-12 months:</strong> If you're in a high-cost area or have dependents</li>
                </ul>
                
                <h4>Where to Keep Your Emergency Fund</h4>
                <ul>
                    <li><strong>High-Yield Savings Account:</strong> Best option—FDIC insured, earns interest</li>
                    <li><strong>Money Market Account:</strong> Slightly higher interest, check-writing privileges</li>
                    <li><strong>Avoid:</strong> Checking accounts (low interest), investments (risk of loss)</li>
                </ul>
                
                <h4>Building Your Fund: Step-by-Step</h4>
                <ol>
                    <li><strong>Start Small:</strong> Aim for $1,000 first</li>
                    <li><strong>Automate Savings:</strong> Set up automatic transfers</li>
                    <li><strong>Use Windfalls:</strong> Tax refunds, bonuses, gifts</li>
                    <li><strong>Cut Expenses:</strong> Find areas to reduce spending</li>
                    <li><strong>Increase Income:</strong> Side hustles, overtime, selling items</li>
                </ol>
                
                <h4>What Qualifies as an Emergency?</h4>
                <p><strong>Yes:</strong></p>
                <ul>
                    <li>Medical emergencies</li>
                    <li>Car repairs (if needed for work)</li>
                    <li>Home repairs (leaks, broken HVAC)</li>
                    <li>Job loss</li>
                    <li>Family emergencies</li>
                </ul>
                
                <p><strong>No:</strong></p>
                <ul>
                    <li>Vacations</li>
                    <li>Holiday shopping</li>
                    <li>Electronics upgrades</li>
                    <li>Entertainment</li>
                </ul>
                
                <div class="alert alert-success">
                    <h6><i class="fa fa-check-circle me-2"></i>Success Story</h6>
                    <p>Sarah built her emergency fund by saving $50/week. After 2 years, she had $5,200—enough to cover 4 months of expenses when she was unexpectedly laid off.</p>
                </div>
            `
        },
        
        'debt-management': {
            title: 'Understanding and Managing Debt: A Complete Guide',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-success mb-2">Beginner</div>
                    <p class="text-light-50">Reading time: 10 minutes</p>
                </div>
                
                <h4>Types of Debt</h4>
                <p><strong>Good Debt:</strong> Investments that increase in value or generate income</p>
                <ul>
                    <li>Mortgage (builds equity)</li>
                    <li>Student loans (increases earning potential)</li>
                    <li>Business loans (generates income)</li>
                </ul>
                
                <p><strong>Bad Debt:</strong> Consumer debt for depreciating assets</p>
                <ul>
                    <li>Credit card debt</li>
                    <li>Car loans (for expensive cars)</li>
                    <li>Personal loans for vacations</li>
                </ul>
                
                <h4>Debt Payoff Strategies</h4>
                
                <h5>1. Snowball Method</h5>
                <p>Pay off debts from smallest to largest balance. Builds momentum and motivation.</p>
                <ul>
                    <li><strong>Pros:</strong> Quick wins, psychological boost</li>
                    <li><strong>Cons:</strong> May cost more in interest</li>
                </ul>
                
                <h5>2. Avalanche Method</h5>
                <p>Pay off debts from highest to lowest interest rate. Saves the most money.</p>
                <ul>
                    <li><strong>Pros:</strong> Saves money on interest</li>
                    <li><strong>Cons:</strong> Takes longer to see progress</li>
                </ul>
                
                <h4>Debt Consolidation Options</h4>
                <ul>
                    <li><strong>Balance Transfer:</strong> Move high-interest debt to 0% card</li>
                    <li><strong>Personal Loan:</strong> Consolidate multiple debts into one payment</li>
                    <li><strong>Home Equity Loan:</strong> Use home equity (risky)</li>
                    <li><strong>Debt Management Plan:</strong> Work with credit counseling agency</li>
                </ul>
                
                <h4>Preventing Future Debt</h4>
                <ol>
                    <li>Build an emergency fund</li>
                    <li>Live below your means</li>
                    <li>Use credit cards responsibly</li>
                    <li>Save for major purchases</li>
                    <li>Track your spending</li>
                </ol>
                
                <h4>When to Seek Help</h4>
                <p>Consider professional help if:</p>
                <ul>
                    <li>You're only making minimum payments</li>
                    <li>Debt exceeds 40% of your income</li>
                    <li>You're using credit to pay for basics</li>
                    <li>You're getting calls from collectors</li>
                </ul>
                
                <div class="alert alert-warning">
                    <h6><i class="fa fa-exclamation-triangle me-2"></i>Warning</h6>
                    <p>Avoid payday loans and title loans—they often have interest rates over 400% and can trap you in a cycle of debt.</p>
                </div>
            `
        },
        
        'credit-score': {
            title: 'Credit Score Fundamentals: Building and Maintaining Good Credit',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-success mb-2">Beginner</div>
                    <p class="text-light-50">Reading time: 8 minutes</p>
                </div>
                
                <h4>What is a Credit Score?</h4>
                <p>A credit score is a three-digit number (300-850) that represents your creditworthiness. Lenders use it to determine loan approval and interest rates.</p>
                
                <h4>Credit Score Ranges</h4>
                <ul>
                    <li><strong>Excellent (800-850):</strong> Best rates and terms</li>
                    <li><strong>Very Good (740-799):</strong> Good rates, easy approval</li>
                    <li><strong>Good (670-739):</strong> Standard rates</li>
                    <li><strong>Fair (580-669):</strong> Higher rates, some denials</li>
                    <li><strong>Poor (300-579):</strong> High rates, frequent denials</li>
                </ul>
                
                <h4>Factors That Affect Your Score</h4>
                <ol>
                    <li><strong>Payment History (35%):</strong> On-time payments are crucial</li>
                    <li><strong>Credit Utilization (30%):</strong> Keep below 30% of available credit</li>
                    <li><strong>Length of Credit History (15%):</strong> Longer is better</li>
                    <li><strong>Credit Mix (10%):</strong> Different types of credit</li>
                    <li><strong>New Credit (10%):</strong> Avoid too many new accounts</li>
                </ol>
                
                <h4>Building Good Credit</h4>
                <ul>
                    <li><strong>Get a Credit Card:</strong> Start with a secured card if needed</li>
                    <li><strong>Make On-Time Payments:</strong> Set up automatic payments</li>
                    <li><strong>Keep Balances Low:</strong> Use less than 30% of your limit</li>
                    <li><strong>Don't Close Old Accounts:</strong> Keep them open to maintain history</li>
                    <li><strong>Limit New Applications:</strong> Only apply when necessary</li>
                </ul>
                
                <h4>Checking Your Credit</h4>
                <p><strong>Free Options:</strong></p>
                <ul>
                    <li>AnnualCreditReport.com (free yearly reports)</li>
                    <li>Credit card statements (FICO scores)</li>
                    <li>Banking apps (VantageScore)</li>
                </ul>
                
                <h4>Fixing Bad Credit</h4>
                <ol>
                    <li>Pay all bills on time</li>
                    <li>Pay down high balances</li>
                    <li>Dispute errors on your report</li>
                    <li>Consider credit counseling</li>
                    <li>Be patient—improvement takes time</li>
                </ol>
                
                <h4>Credit Score Myths</h4>
                <ul>
                    <li><strong>Myth:</strong> Checking your score hurts it</li>
                    <li><strong>Fact:</strong> Soft inquiries don't affect your score</li>
                    <li><strong>Myth:</strong> Closing accounts improves your score</li>
                    <li><strong>Fact:</strong> Closing accounts can hurt your score</li>
                    <li><strong>Myth:</strong> You need to carry a balance</li>
                    <li><strong>Fact:</strong> Paying in full is better</li>
                </ul>
                
                <div class="alert alert-info">
                    <h6><i class="fa fa-info-circle me-2"></i>Did You Know?</h6>
                    <p>Your credit score can affect more than just loans—it can impact insurance rates, rental applications, and even job opportunities.</p>
                </div>
            `
        },
        
        'investing-101': {
            title: 'Investing 101: Getting Started with Building Wealth',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-warning mb-2">Intermediate</div>
                    <p class="text-light-50">Reading time: 12 minutes</p>
                </div>
                
                <h4>Why Invest?</h4>
                <p>Investing is essential for building long-term wealth. While saving money is important, investing allows your money to grow through compound interest and market appreciation.</p>
                
                <h4>Investment Basics</h4>
                <ul>
                    <li><strong>Stocks:</strong> Ownership in a company</li>
                    <li><strong>Bonds:</strong> Loans to companies or governments</li>
                    <li><strong>Mutual Funds:</strong> Pooled investments in multiple securities</li>
                    <li><strong>ETFs:</strong> Exchange-traded funds that track indexes</li>
                    <li><strong>Real Estate:</strong> Property investments</li>
                </ul>
                
                <h4>Risk vs. Return</h4>
                <p>Generally, higher potential returns come with higher risk:</p>
                <ul>
                    <li><strong>Low Risk:</strong> Savings accounts, CDs, government bonds (2-4% returns)</li>
                    <li><strong>Medium Risk:</strong> Corporate bonds, dividend stocks (4-8% returns)</li>
                    <li><strong>High Risk:</strong> Growth stocks, small-cap stocks (8-12%+ returns)</li>
                </ul>
                
                <h4>Getting Started</h4>
                <ol>
                    <li><strong>Pay Off High-Interest Debt:</strong> Credit cards first</li>
                    <li><strong>Build Emergency Fund:</strong> 3-6 months of expenses</li>
                    <li><strong>Start with Retirement Accounts:</strong> 401(k), IRA</li>
                    <li><strong>Choose Your Investment Style:</strong> DIY or robo-advisor</li>
                    <li><strong>Start Small:</strong> Begin with index funds</li>
                </ol>
                
                <h4>Investment Accounts</h4>
                <ul>
                    <li><strong>401(k):</strong> Employer-sponsored, tax-advantaged</li>
                    <li><strong>IRA:</strong> Individual retirement account</li>
                    <li><strong>Roth IRA:</strong> Tax-free withdrawals in retirement</li>
                    <li><strong>Brokerage Account:</strong> Regular investment account</li>
                </ul>
                
                <h4>Diversification</h4>
                <p>Don't put all your eggs in one basket:</p>
                <ul>
                    <li>Spread money across different asset classes</li>
                    <li>Invest in different industries and countries</li>
                    <li>Consider your age and risk tolerance</li>
                    <li>Rebalance periodically</li>
                </ul>
                
                <h4>Common Investment Mistakes</h4>
                <ul>
                    <li>Trying to time the market</li>
                    <li>Investing without a plan</li>
                    <li>Letting emotions drive decisions</li>
                    <li>Not diversifying enough</li>
                    <li>Paying high fees</li>
                </ul>
                
                <div class="alert alert-success">
                    <h6><i class="fa fa-chart-line me-2"></i>Investment Tip</h6>
                    <p>Time in the market beats timing the market. Start investing early and stay invested for the long term.</p>
                </div>
            `
        },
        
        'retirement-planning': {
            title: 'Retirement Planning Strategies: Securing Your Future',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-warning mb-2">Intermediate</div>
                    <p class="text-light-50">Reading time: 15 minutes</p>
                </div>
                
                <h4>Why Plan for Retirement?</h4>
                <p>Retirement planning ensures you can maintain your lifestyle when you stop working. With longer life expectancies and uncertain Social Security benefits, personal savings are crucial.</p>
                
                <h4>How Much Do You Need?</h4>
                <p><strong>General Rule:</strong> 70-80% of pre-retirement income</p>
                <ul>
                    <li><strong>Conservative:</strong> 80-90% (if you plan to travel extensively)</li>
                    <li><strong>Moderate:</strong> 70-80% (maintain current lifestyle)</li>
                    <li><strong>Aggressive:</strong> 60-70% (downsize and simplify)</li>
                </ul>
                
                <h4>Retirement Accounts</h4>
                <h5>Employer-Sponsored Plans</h5>
                <ul>
                    <li><strong>401(k):</strong> Traditional and Roth options</li>
                    <li><strong>403(b):</strong> For non-profit employees</li>
                    <li><strong>457(b):</strong> For government employees</li>
                </ul>
                
                <h5>Individual Plans</h5>
                <ul>
                    <li><strong>Traditional IRA:</strong> Tax-deductible contributions</li>
                    <li><strong>Roth IRA:</strong> Tax-free withdrawals</li>
                    <li><strong>SEP IRA:</strong> For self-employed individuals</li>
                </ul>
                
                <h4>Social Security</h4>
                <ul>
                    <li><strong>Full Retirement Age:</strong> 66-67 (depending on birth year)</li>
                    <li><strong>Early Benefits:</strong> Available at 62 (reduced amount)</li>
                    <li><strong>Delayed Benefits:</strong> Up to age 70 (increased amount)</li>
                    <li><strong>Spousal Benefits:</strong> Up to 50% of spouse's benefit</li>
                </ul>
                
                <h4>Investment Strategies by Age</h4>
                <h5>20s-30s: Aggressive Growth</h5>
                <ul>
                    <li>80-90% stocks, 10-20% bonds</li>
                    <li>Focus on growth investments</li>
                    <li>Maximize retirement contributions</li>
                </ul>
                
                <h5>40s-50s: Balanced Approach</h5>
                <ul>
                    <li>60-70% stocks, 30-40% bonds</li>
                    <li>Increase bond allocation</li>
                    <li>Consider catch-up contributions</li>
                </ul>
                
                <h5>60s+: Conservative</h5>
                <ul>
                    <li>40-50% stocks, 50-60% bonds</li>
                    <li>Focus on capital preservation</li>
                    <li>Plan for required minimum distributions</li>
                </ul>
                
                <h4>Healthcare in Retirement</h4>
                <ul>
                    <li><strong>Medicare:</strong> Starts at age 65</li>
                    <li><strong>Medigap:</strong> Supplemental insurance</li>
                    <li><strong>Long-term Care:</strong> Consider insurance</li>
                    <li><strong>Health Savings Account:</strong> Tax-advantaged healthcare savings</li>
                </ul>
                
                <h4>Retirement Income Sources</h4>
                <ol>
                    <li>Social Security benefits</li>
                    <li>Retirement account withdrawals</li>
                    <li>Pension (if available)</li>
                    <li>Part-time work</li>
                    <li>Rental income</li>
                    <li>Investment dividends</li>
                </ol>
                
                <div class="alert alert-warning">
                    <h6><i class="fa fa-exclamation-triangle me-2"></i>Important</h6>
                    <p>Don't forget about inflation! Your retirement savings need to grow faster than inflation to maintain purchasing power.</p>
                </div>
            `
        },
        
        'tax-optimization': {
            title: 'Tax Optimization Basics: Keeping More of What You Earn',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-warning mb-2">Intermediate</div>
                    <p class="text-light-50">Reading time: 10 minutes</p>
                </div>
                
                <h4>Understanding Tax Optimization</h4>
                <p>Tax optimization is legally reducing your tax burden through strategic planning and use of available deductions and credits.</p>
                
                <h4>Tax-Advantaged Accounts</h4>
                <h5>Retirement Accounts</h5>
                <ul>
                    <li><strong>Traditional 401(k)/IRA:</strong> Tax-deductible contributions</li>
                    <li><strong>Roth 401(k)/IRA:</strong> Tax-free withdrawals</li>
                    <li><strong>HSA:</strong> Triple tax advantage for healthcare</li>
                </ul>
                
                <h5>Education Accounts</h5>
                <ul>
                    <li><strong>529 Plans:</strong> Tax-free growth for education</li>
                    <li><strong>Coverdell ESA:</strong> Education savings account</li>
                </ul>
                
                <h4>Common Deductions</h4>
                <ul>
                    <li><strong>Standard Deduction:</strong> $12,950 (single), $25,900 (married)</li>
                    <li><strong>Itemized Deductions:</strong> Mortgage interest, state taxes, charitable giving</li>
                    <li><strong>Above-the-Line:</strong> Student loan interest, HSA contributions</li>
                </ul>
                
                <h4>Tax Credits</h4>
                <ul>
                    <li><strong>Child Tax Credit:</strong> Up to $2,000 per child</li>
                    <li><strong>Earned Income Tax Credit:</strong> For low-income workers</li>
                    <li><strong>American Opportunity Credit:</strong> For college expenses</li>
                    <li><strong>Saver's Credit:</strong> For retirement contributions</li>
                </ul>
                
                <h4>Investment Tax Strategies</h4>
                <ul>
                    <li><strong>Tax-Loss Harvesting:</strong> Sell losing investments to offset gains</li>
                    <li><strong>Long-term Capital Gains:</strong> Hold investments for 1+ years</li>
                    <li><strong>Municipal Bonds:</strong> Tax-free interest income</li>
                    <li><strong>Index Funds:</strong> Lower turnover, fewer taxable events</li>
                </ul>
                
                <h4>Business Tax Strategies</h4>
                <ul>
                    <li><strong>Home Office Deduction:</strong> For self-employed individuals</li>
                    <li><strong>Business Expenses:</strong> Travel, meals, equipment</li>
                    <li><strong>Depreciation:</strong> Spread asset costs over time</li>
                    <li><strong>Pass-through Deduction:</strong> 20% deduction for business income</li>
                </ul>
                
                <h4>Year-End Tax Planning</h4>
                <ol>
                    <li>Maximize retirement contributions</li>
                    <li>Consider charitable giving</li>
                    <li>Review investment gains/losses</li>
                    <li>Prepay deductible expenses</li>
                    <li>Defer income if possible</li>
                </ol>
                
                <h4>Tax-Efficient Investing</h4>
                <ul>
                    <li>Put tax-inefficient investments in retirement accounts</li>
                    <li>Use tax-efficient funds in taxable accounts</li>
                    <li>Consider asset location strategies</li>
                    <li>Minimize portfolio turnover</li>
                </ul>
                
                <div class="alert alert-info">
                    <h6><i class="fa fa-info-circle me-2"></i>Tax Tip</h6>
                    <p>Keep good records throughout the year. You can't claim deductions without proper documentation.</p>
                </div>
            `
        },
        
        'real-estate': {
            title: 'Real Estate Investment Guide: Building Wealth Through Property',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-warning mb-2">Intermediate</div>
                    <p class="text-light-50">Reading time: 14 minutes</p>
                </div>
                
                <h4>Why Invest in Real Estate?</h4>
                <ul>
                    <li><strong>Cash Flow:</strong> Monthly rental income</li>
                    <li><strong>Appreciation:</strong> Property value increases over time</li>
                    <li><strong>Tax Benefits:</strong> Depreciation, mortgage interest deduction</li>
                    <li><strong>Leverage:</strong> Use borrowed money to buy assets</li>
                    <li><strong>Diversification:</strong> Different from stocks and bonds</li>
                </ul>
                
                <h4>Types of Real Estate Investments</h4>
                <h5>Residential Properties</h5>
                <ul>
                    <li><strong>Single-family homes:</strong> Easiest to manage</li>
                    <li><strong>Multi-family:</strong> Apartments, duplexes</li>
                    <li><strong>Condos:</strong> Lower maintenance, HOA fees</li>
                </ul>
                
                <h5>Commercial Properties</h5>
                <ul>
                    <li><strong>Office buildings:</strong> Longer leases, higher returns</li>
                    <li><strong>Retail spaces:</strong> Shopping centers, strip malls</li>
                    <li><strong>Industrial:</strong> Warehouses, manufacturing</li>
                </ul>
                
                <h5>Alternative Investments</h5>
                <ul>
                    <li><strong>REITs:</strong> Real estate investment trusts</li>
                    <li><strong>Crowdfunding:</strong> Pool money with other investors</li>
                    <li><strong>Real estate funds:</strong> Managed portfolios</li>
                </ul>
                
                <h4>Key Investment Metrics</h4>
                <ul>
                    <li><strong>Cap Rate:</strong> Net operating income ÷ property value</li>
                    <li><strong>Cash-on-Cash Return:</strong> Annual cash flow ÷ cash invested</li>
                    <li><strong>ROI:</strong> Total return ÷ total investment</li>
                    <li><strong>Cash Flow:</strong> Rental income minus expenses</li>
                </ul>
                
                <h4>Financing Options</h4>
                <ul>
                    <li><strong>Conventional Loans:</strong> 20-25% down payment</li>
                    <li><strong>FHA Loans:</strong> 3.5% down (owner-occupied)</li>
                    <li><strong>VA Loans:</strong> 0% down (veterans)</li>
                    <li><strong>Hard Money:</strong> Short-term, higher interest</li>
                    <li><strong>Private Money:</strong> Individual lenders</li>
                </ul>
                
                <h4>Property Analysis</h4>
                <h5>Location Factors</h5>
                <ul>
                    <li>School district quality</li>
                    <li>Crime rates</li>
                    <li>Employment opportunities</li>
                    <li>Transportation access</li>
                    <li>Future development plans</li>
                </ul>
                
                <h5>Property Factors</h5>
                <ul>
                    <li>Age and condition</li>
                    <li>Square footage</li>
                    <li>Number of bedrooms/bathrooms</li>
                    <li>Lot size</li>
                    <li>Renovation needs</li>
                </ul>
                
                <h4>Rental Property Management</h4>
                <ul>
                    <li><strong>Tenant Screening:</strong> Credit checks, background checks</li>
                    <li><strong>Lease Agreements:</strong> Clear terms and conditions</li>
                    <li><strong>Maintenance:</strong> Regular upkeep and repairs</li>
                    <li><strong>Insurance:</strong> Landlord and liability coverage</li>
                    <li><strong>Property Management:</strong> Professional management services</li>
                </ul>
                
                <h4>Tax Benefits</h4>
                <ul>
                    <li><strong>Depreciation:</strong> Deduct property value over 27.5 years</li>
                    <li><strong>Mortgage Interest:</strong> Deduct interest payments</li>
                    <li><strong>Property Taxes:</strong> Deductible business expense</li>
                    <li><strong>1031 Exchange:</strong> Defer capital gains taxes</li>
                </ul>
                
                <h4>Common Mistakes to Avoid</h4>
                <ul>
                    <li>Not doing proper due diligence</li>
                    <li>Underestimating expenses</li>
                    <li>Overpaying for properties</li>
                    <li>Poor tenant screening</li>
                    <li>Inadequate cash reserves</li>
                </ul>
                
                <div class="alert alert-success">
                    <h6><i class="fa fa-home me-2"></i>Success Story</h6>
                    <p>Mike started with one rental property in 2010. Through strategic purchases and good management, he now owns 15 properties generating $15,000/month in passive income.</p>
                </div>
            `
        },
        
        'portfolio-optimization': {
            title: 'Portfolio Optimization: Advanced Investment Strategies',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-danger mb-2">Advanced</div>
                    <p class="text-light-50">Reading time: 18 minutes</p>
                </div>
                
                <h4>Modern Portfolio Theory</h4>
                <p>Developed by Harry Markowitz, Modern Portfolio Theory (MPT) shows how to construct portfolios that maximize expected return for a given level of risk.</p>
                
                <h4>Key Concepts</h4>
                <ul>
                    <li><strong>Efficient Frontier:</strong> Optimal portfolios for each risk level</li>
                    <li><strong>Diversification:</strong> Reducing risk through asset correlation</li>
                    <li><strong>Risk-Return Tradeoff:</strong> Higher returns require higher risk</li>
                    <li><strong>Capital Asset Pricing Model (CAPM):</strong> Expected return based on risk</li>
                </ul>
                
                <h4>Asset Allocation Strategies</h4>
                <h5>Strategic Asset Allocation</h5>
                <ul>
                    <li>Long-term target allocations</li>
                    <li>Based on risk tolerance and goals</li>
                    <li>Rebalanced periodically</li>
                    <li>Passive approach</li>
                </ul>
                
                <h5>Tactical Asset Allocation</h5>
                <ul>
                    <li>Short-term adjustments</li>
                    <li>Based on market conditions</li>
                    <li>More active management</li>
                    <li>Higher transaction costs</li>
                </ul>
                
                <h4>Risk Management Techniques</h4>
                <ul>
                    <li><strong>Position Sizing:</strong> Limit individual position risk</li>
                    <li><strong>Stop Losses:</strong> Automatic sell orders</li>
                    <li><strong>Hedging:</strong> Offset potential losses</li>
                    <li><strong>Options Strategies:</strong> Protective puts, covered calls</li>
                </ul>
                
                <h4>Factor Investing</h4>
                <p>Targeting specific risk factors that drive returns:</p>
                <ul>
                    <li><strong>Value:</strong> Undervalued stocks</li>
                    <li><strong>Momentum:</strong> Trending securities</li>
                    <li><strong>Size:</strong> Small-cap premium</li>
                    <li><strong>Quality:</strong> Strong fundamentals</li>
                    <li><strong>Low Volatility:</strong> Stable returns</li>
                </ul>
                
                <h4>Alternative Investments</h4>
                <ul>
                    <li><strong>Private Equity:</strong> Private company investments</li>
                    <li><strong>Hedge Funds:</strong> Alternative strategies</li>
                    <li><strong>Commodities:</strong> Gold, oil, agricultural products</li>
                    <li><strong>Cryptocurrencies:</strong> Digital assets</li>
                    <li><strong>Structured Products:</strong> Complex derivatives</li>
                </ul>
                
                <h4>Tax-Efficient Portfolio Management</h4>
                <ul>
                    <li><strong>Asset Location:</strong> Place assets in optimal accounts</li>
                    <li><strong>Tax-Loss Harvesting:</strong> Offset gains with losses</li>
                    <li><strong>Lot Selection:</strong> Choose specific shares to sell</li>
                    <li><strong>Charitable Giving:</strong> Donate appreciated securities</li>
                </ul>
                
                <h4>Performance Measurement</h4>
                <ul>
                    <li><strong>Sharpe Ratio:</strong> Risk-adjusted returns</li>
                    <li><strong>Alpha:</strong> Excess return vs. benchmark</li>
                    <li><strong>Beta:</strong> Market sensitivity</li>
                    <li><strong>Information Ratio:</strong> Active return per unit of risk</li>
                </ul>
                
                <div class="alert alert-warning">
                    <h6><i class="fa fa-exclamation-triangle me-2"></i>Advanced Warning</h6>
                    <p>These strategies require significant knowledge and experience. Consider consulting with a financial advisor before implementing advanced techniques.</p>
                </div>
            `
        },
        
        'estate-planning': {
            title: 'Estate Planning Essentials: Protecting Your Legacy',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-danger mb-2">Advanced</div>
                    <p class="text-light-50">Reading time: 16 minutes</p>
                </div>
                
                <h4>What is Estate Planning?</h4>
                <p>Estate planning is the process of arranging for the management and disposal of your assets during your life and after your death. It's about protecting your family and ensuring your wishes are carried out.</p>
                
                <h4>Essential Documents</h4>
                <h5>Will</h5>
                <ul>
                    <li>Distributes assets after death</li>
                    <li>Names guardians for minor children</li>
                    <li>Appoints executor</li>
                    <li>Must be witnessed and notarized</li>
                </ul>
                
                <h5>Trust</h5>
                <ul>
                    <li>Manages assets during life and after death</li>
                    <li>Avoids probate</li>
                    <li>Provides privacy</li>
                    <li>Can reduce estate taxes</li>
                </ul>
                
                <h5>Power of Attorney</h5>
                <ul>
                    <li>Financial POA: Manages finances</li>
                    <li>Healthcare POA: Makes medical decisions</li>
                    <li>Can be limited or comprehensive</li>
                    <li>Becomes effective when you're incapacitated</li>
                </ul>
                
                <h5>Living Will</h5>
                <ul>
                    <li>End-of-life medical decisions</li>
                    <li>Life support preferences</li>
                    <li>Organ donation wishes</li>
                    <li>Also called advance directive</li>
                </ul>
                
                <h4>Estate Tax Planning</h4>
                <p><strong>Current Exemption:</strong> $12.92 million per person (2023)</p>
                <ul>
                    <li><strong>Gift Tax:</strong> $17,000 annual exclusion</li>
                    <li><strong>Charitable Giving:</strong> Reduces taxable estate</li>
                    <li><strong>Life Insurance Trusts:</strong> Removes proceeds from estate</li>
                    <li><strong>Family Limited Partnerships:</strong> Discounts asset values</li>
                </ul>
                
                <h4>Trust Types</h4>
                <h5>Revocable Living Trust</h5>
                <ul>
                    <li>Can be changed during your lifetime</li>
                    <li>Avoids probate</li>
                    <li>No tax benefits</li>
                    <li>Most common type</li>
                </ul>
                
                <h5>Irrevocable Trust</h5>
                <ul>
                    <li>Cannot be changed once created</li>
                    <li>Asset protection benefits</li>
                    <li>Estate tax benefits</li>
                    <li>Loss of control</li>
                </ul>
                
                <h5>Special Needs Trust</h5>
                <ul>
                    <li>For disabled beneficiaries</li>
                    <li>Preserves government benefits</li>
                    <li>Provides supplemental care</li>
                    <li>Must be carefully structured</li>
                </ul>
                
                <h4>Business Succession Planning</h4>
                <ul>
                    <li><strong>Buy-Sell Agreements:</strong> Defines transfer terms</li>
                    <li><strong>Key Person Insurance:</strong> Protects against loss</li>
                    <li><strong>Family Limited Partnerships:</strong> Transfer ownership gradually</li>
                    <li><strong>Employee Stock Ownership Plans:</strong> Sell to employees</li>
                </ul>
                
                <h4>Digital Estate Planning</h4>
                <ul>
                    <li><strong>Digital Assets:</strong> Social media, email, cryptocurrency</li>
                    <li><strong>Password Management:</strong> Secure storage of credentials</li>
                    <li><strong>Digital Executor:</strong> Manages online accounts</li>
                    <li><strong>Legacy Contacts:</strong> Facebook, Google account access</li>
                </ul>
                
                <h4>International Considerations</h4>
                <ul>
                    <li><strong>Foreign Assets:</strong> Different tax treatment</li>
                    <li><strong>Dual Citizenship:</strong> Multiple legal systems</li>
                    <li><strong>Treaty Benefits:</strong> Avoid double taxation</li>
                    <li><strong>Local Counsel:</strong> Foreign legal advice</li>
                </ul>
                
                <h4>Common Mistakes</h4>
                <ul>
                    <li>Not updating documents regularly</li>
                    <li>Forgetting digital assets</li>
                    <li>Not considering tax implications</li>
                    <li>Choosing wrong executor or trustee</li>
                    <li>Not planning for incapacity</li>
                </ul>
                
                <div class="alert alert-info">
                    <h6><i class="fa fa-info-circle me-2"></i>Professional Advice</h6>
                    <p>Estate planning involves complex legal and tax issues. Always consult with qualified attorneys and tax professionals.</p>
                </div>
            `
        },
        
        'alternative-investments': {
            title: 'Alternative Investments: Beyond Stocks and Bonds',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-danger mb-2">Advanced</div>
                    <p class="text-light-50">Reading time: 20 minutes</p>
                </div>
                
                <h4>What Are Alternative Investments?</h4>
                <p>Alternative investments are financial assets that don't fall into conventional categories like stocks, bonds, or cash. They offer diversification and potentially higher returns but come with unique risks.</p>
                
                <h4>Private Equity</h4>
                <p>Investments in private companies not listed on public exchanges.</p>
                <ul>
                    <li><strong>Venture Capital:</strong> Early-stage companies</li>
                    <li><strong>Buyout Funds:</strong> Mature companies</li>
                    <li><strong>Growth Equity:</strong> Expanding companies</li>
                    <li><strong>Distressed Debt:</strong> Troubled companies</li>
                </ul>
                
                <h5>Pros and Cons</h5>
                <ul>
                    <li><strong>Pros:</strong> High potential returns, low correlation with markets</li>
                    <li><strong>Cons:</strong> Illiquid, high fees, long lock-up periods</li>
                </ul>
                
                <h4>Hedge Funds</h4>
                <p>Pooled investment funds that use various strategies to generate returns.</p>
                <h5>Common Strategies</h5>
                <ul>
                    <li><strong>Long/Short:</strong> Buy undervalued, sell overvalued</li>
                    <li><strong>Global Macro:</strong> Economic trend bets</li>
                    <li><strong>Event-Driven:</strong> Merger arbitrage, distressed securities</li>
                    <li><strong>Quantitative:</strong> Algorithm-based trading</li>
                </ul>
                
                <h4>Real Assets</h4>
                <h5>Commodities</h5>
                <ul>
                    <li><strong>Precious Metals:</strong> Gold, silver, platinum</li>
                    <li><strong>Energy:</strong> Oil, natural gas, coal</li>
                    <li><strong>Agriculture:</strong> Corn, wheat, soybeans</li>
                    <li><strong>Livestock:</strong> Cattle, hogs</li>
                </ul>
                
                <h5>Infrastructure</h5>
                <ul>
                    <li><strong>Transportation:</strong> Roads, bridges, airports</li>
                    <li><strong>Utilities:</strong> Power plants, water systems</li>
                    <li><strong>Communications:</strong> Fiber networks, cell towers</li>
                    <li><strong>Social:</strong> Schools, hospitals, prisons</li>
                </ul>
                
                <h4>Cryptocurrencies</h4>
                <p>Digital or virtual currencies using cryptography for security.</p>
                <ul>
                    <li><strong>Bitcoin:</strong> First and largest cryptocurrency</li>
                    <li><strong>Ethereum:</strong> Smart contract platform</li>
                    <li><strong>Altcoins:</strong> Alternative cryptocurrencies</li>
                    <li><strong>DeFi:</strong> Decentralized finance protocols</li>
                </ul>
                
                <h5>Investment Methods</h5>
                <ul>
                    <li><strong>Direct Purchase:</strong> Buy and hold</li>
                    <li><strong>Mining:</strong> Validate transactions</li>
                    <li><strong>Staking:</strong> Earn rewards for validation</li>
                    <li><strong>Yield Farming:</strong> Provide liquidity</li>
                </ul>
                
                <h4>Collectibles</h4>
                <ul>
                    <li><strong>Art:</strong> Paintings, sculptures, prints</li>
                    <li><strong>Wine:</strong> Fine wines and spirits</li>
                    <li><strong>Coins:</strong> Rare and precious metals</li>
                    <li><strong>Stamps:</strong> Philatelic investments</li>
                    <li><strong>Sports Memorabilia:</strong> Cards, jerseys, equipment</li>
                </ul>
                
                <h4>Structured Products</h4>
                <p>Complex financial instruments with customized risk-return profiles.</p>
                <ul>
                    <li><strong>Principal-Protected Notes:</strong> Guarantee return of principal</li>
                    <li><strong>Reverse Convertibles:</strong> Bond with embedded put option</li>
                    <li><strong>Leveraged ETFs:</strong> Amplified market exposure</li>
                    <li><strong>Collateralized Debt Obligations:</strong> Pooled debt securities</li>
                </ul>
                
                <h4>Due Diligence Requirements</h4>
                <ul>
                    <li><strong>Manager Track Record:</strong> Historical performance</li>
                    <li><strong>Strategy Understanding:</strong> How returns are generated</li>
                    <li><strong>Risk Assessment:</strong> Downside potential</li>
                    <li><strong>Liquidity Analysis:</strong> Exit strategies</li>
                    <li><strong>Fee Structure:</strong> Management and performance fees</li>
                </ul>
                
                <h4>Portfolio Allocation</h4>
                <p><strong>General Guidelines:</strong></p>
                <ul>
                    <li><strong>Conservative:</strong> 5-10% of portfolio</li>
                    <li><strong>Moderate:</strong> 10-20% of portfolio</li>
                    <li><strong>Aggressive:</strong> 20-30% of portfolio</li>
                </ul>
                
                <div class="alert alert-danger">
                    <h6><i class="fa fa-exclamation-triangle me-2"></i>Risk Warning</h6>
                    <p>Alternative investments are complex and risky. They're typically suitable only for sophisticated investors with high risk tolerance and long time horizons.</p>
                </div>
            `
        },
        
        'tax-advanced': {
            title: 'Advanced Tax Strategies: Maximizing Wealth Preservation',
            content: `
                <div class="article-header mb-4">
                    <div class="badge bg-danger mb-2">Advanced</div>
                    <p class="text-light-50">Reading time: 22 minutes</p>
                </div>
                
                <h4>Advanced Tax Planning Concepts</h4>
                <p>Advanced tax strategies go beyond basic deductions and credits to optimize your overall tax position through sophisticated planning techniques.</p>
                
                <h4>Business Tax Strategies</h4>
                <h5>Entity Selection</h5>
                <ul>
                    <li><strong>Sole Proprietorship:</strong> Simple but limited benefits</li>
                    <li><strong>LLC:</strong> Flexibility and liability protection</li>
                    <li><strong>S-Corporation:</strong> Avoid self-employment tax</li>
                    <li><strong>C-Corporation:</strong> Lower corporate rates, double taxation</li>
                </ul>
                
                <h5>Pass-Through Deduction</h5>
                <ul>
                    <li>20% deduction on qualified business income</li>
                    <li>Phase-out for high-income taxpayers</li>
                    <li>Specified service businesses limited</li>
                    <li>Complex calculation requirements</li>
                </ul>
                
                <h4>Retirement Tax Strategies</h4>
                <h5>Roth Conversion Ladder</h5>
                <ul>
                    <li>Convert traditional IRA to Roth gradually</li>
                    <li>Pay taxes at lower rates</li>
                    <li>Access funds early without penalty</li>
                    <li>Requires 5-year waiting period</li>
                </ul>
                
                <h5>Backdoor Roth IRA</h5>
                <ul>
                    <li>Contribute to traditional IRA</li>
                    <li>Convert to Roth immediately</li>
                    <li>Bypass income limits</li>
                    <li>Watch out for pro-rata rule</li>
                </ul>
                
                <h4>Estate Tax Planning</h4>
                <h5>Grantor Retained Annuity Trust (GRAT)</h5>
                <ul>
                    <li>Transfer assets to trust</li>
                    <li>Receive annuity payments</li>
                    <li>Remaining assets pass to beneficiaries</li>
                    <li>Minimal gift tax if structured properly</li>
                </ul>
                
                <h5>Intentionally Defective Grantor Trust (IDGT)</h5>
                <ul>
                    <li>Grantor pays trust income taxes</li>
                    <li>Assets grow tax-free</li>
                    <li>Removes assets from estate</li>
                    <li>Complex legal structure required</li>
                </ul>
                
                <h4>Investment Tax Strategies</h4>
                <h5>Tax-Loss Harvesting</h5>
                <ul>
                    <li>Sell losing investments</li>
                    <li>Offset capital gains</li>
                    <li>Replace with similar investments</li>
                    <li>Avoid wash sale rules</li>
                </ul>
                
                <h5>Asset Location</h5>
                <ul>
                    <li>Tax-inefficient assets in retirement accounts</li>
                    <li>Tax-efficient assets in taxable accounts</li>
                    <li>Consider state tax implications</li>
                    <li>Rebalance across accounts</li>
                </ul>
                
                <h4>International Tax Planning</h4>
                <h5>Foreign Tax Credit</h5>
                <ul>
                    <li>Credit for foreign taxes paid</li>
                    <li>Prevents double taxation</li>
                    <li>Complex calculation rules</li>
                    <li>Carryforward and carryback options</li>
                </ul>
                
                <h5>Offshore Accounts</h5>
                <ul>
                    <li>FBAR filing requirements</li>
                    <li>FATCA reporting obligations</li>
                    <li>Penalties for non-compliance</li>
                    <li>Voluntary disclosure programs</li>
                </ul>
                
                <h4>Charitable Giving Strategies</h4>
                <h5>Donor-Advised Funds</h5>
                <ul>
                    <li>Immediate tax deduction</li>
                    <li>Grow assets tax-free</li>
                    <li>Flexible giving schedule</li>
                    <li>Simplified administration</li>
                </ul>
                
                <h5>Charitable Remainder Trust</h5>
                <ul>
                    <li>Receive income for life</li>
                    <li>Charity gets remainder</li>
                    <li>Immediate partial deduction</li>
                    <li>Avoid capital gains tax</li>
                </ul>
                
                <h4>Real Estate Tax Strategies</h4>
                <h5>1031 Exchange</h5>
                <ul>
                    <li>Defer capital gains tax</li>
                    <li>Like-kind property requirement</li>
                    <li>Strict timing rules</li>
                    <li>Qualified intermediary required</li>
                </ul>
                
                <h5>Cost Segregation</h5>
                <ul>
                    <li>Accelerate depreciation</li>
                    <li>Reduce current tax liability</li>
                    <li>Engineering study required</li>
                    <li>Available for commercial property</li>
                </ul>
                
                <h4>Advanced Deduction Strategies</h4>
                <ul>
                    <li><strong>Home Office Deduction:</strong> Simplified or actual expense method</li>
                    <li><strong>Vehicle Deduction:</strong> Standard mileage vs. actual expenses</li>
                    <li><strong>Meal Deductions:</strong> 50% limitation, business purpose required</li>
                    <li><strong>Travel Expenses:</strong> Transportation, lodging, meals</li>
                </ul>
                
                <div class="alert alert-warning">
                    <h6><i class="fa fa-exclamation-triangle me-2"></i>Professional Required</h6>
                    <p>These strategies involve complex tax rules and legal requirements. Always work with qualified tax professionals and attorneys.</p>
                </div>
            `
        }
    };
    
    return articles[articleId] || {
        title: 'Article Not Found',
        content: '<p>This article is coming soon. Please check back later!</p>'
    };
}

function markArticleAsRead(articleId) {
    console.log('Marking article as read:', articleId);
    
    // Track article completion
    if (typeof mixpanel !== 'undefined') {
        mixpanel.track('Article Completed', {
            article_id: articleId,
            difficulty_level: getArticleDifficulty(articleId)
        });
    }
    
    // Update UI to show article as read
    $(`[data-article="${articleId}"]`).find('i').removeClass('fa-circle text-warning fa-circle text-danger').addClass('fa-check-circle text-success');
    
    // Store in localStorage
    const readArticles = JSON.parse(localStorage.getItem('readArticles') || '[]');
    if (!readArticles.includes(articleId)) {
        readArticles.push(articleId);
        localStorage.setItem('readArticles', JSON.stringify(readArticles));
    }
    
    // Update learning progress
    updateLearningProgress();
    
    // Show success message
    showToast('Article marked as read! Your progress has been saved.', 'success');
    
    // Close modal
    $('#articleModal').modal('hide');
}

function updateLearningProgress() {
    const readArticles = JSON.parse(localStorage.getItem('readArticles') || '[]');
    const totalArticles = 12; // Total number of articles
    const progressPercentage = Math.round((readArticles.length / totalArticles) * 100);
    
    // Update progress bar
    $('.progress-bar').css('width', progressPercentage + '%').attr('aria-valuenow', progressPercentage);
    $('.progress-bar').next().text(progressPercentage + '% Complete');
    
    // Update level based on progress
    let level = 'Beginner';
    if (progressPercentage >= 75) level = 'Expert';
    else if (progressPercentage >= 50) level = 'Advanced';
    else if (progressPercentage >= 25) level = 'Intermediate';
    
    $('.bg-white.bg-opacity-20.rounded-circle').next().text(level + ' Achiever');
    
    // Update article status indicators
    updateArticleStatusIndicators();
}

function updateArticleStatusIndicators() {
    const readArticles = JSON.parse(localStorage.getItem('readArticles') || '[]');
    
    // Update all article links
    $('[data-article]').each(function() {
        const articleId = $(this).data('article');
        const icon = $(this).find('i');
        
        if (readArticles.includes(articleId)) {
            icon.removeClass('fa-circle text-warning fa-circle text-danger').addClass('fa-check-circle text-success');
        }
    });
}

// Interactive Tools Module
function initializeInteractiveTools() {
    console.log('Initializing Interactive Tools');
    
    // Debt Payoff Calculator
    initializeDebtCalculator();
    
    // Portfolio Analyzer
    initializePortfolioAnalyzer();
}

function initializeDebtCalculator() {
    $('#add-debt-account').on('click', function() {
        const newDebtHtml = `
            <div class="debt-account mb-3 p-3 bg-dark rounded">
                <div class="row">
                    <div class="col-6">
                        <input type="text" class="form-control form-control-sm mb-2" placeholder="Debt Name">
                        <input type="number" class="form-control form-control-sm" placeholder="Balance">
                    </div>
                    <div class="col-6">
                        <input type="number" class="form-control form-control-sm mb-2" placeholder="Interest %">
                        <input type="number" class="form-control form-control-sm" placeholder="Min Payment">
                    </div>
                </div>
                <button class="btn btn-outline-danger btn-sm mt-2 remove-debt">
                    <i class="fa fa-trash me-1"></i>Remove
                </button>
            </div>
        `;
        $('#debt-accounts-container').append(newDebtHtml);
    });
    
    $(document).on('click', '.remove-debt', function() {
        $(this).closest('.debt-account').remove();
    });
    
    $('#calculate-debt-payoff').on('click', function() {
        calculateDebtPayoff();
    });
}

function calculateDebtPayoff() {
    const monthlyPayment = parseFloat($('#debt-monthly-payment').val()) || 0;
    const debts = [];
    
    $('.debt-account').each(function() {
        const inputs = $(this).find('input');
        const debt = {
            name: inputs.eq(0).val() || 'Debt',
            balance: parseFloat(inputs.eq(1).val()) || 0,
            interest: parseFloat(inputs.eq(2).val()) || 0,
            minPayment: parseFloat(inputs.eq(3).val()) || 0
        };
        if (debt.balance > 0) debts.push(debt);
    });
    
    if (debts.length === 0 || monthlyPayment === 0) {
        showToast('Please enter debt information and monthly payment', 'warning');
        return;
    }
    
    // Calculate snowball method (pay smallest balance first)
    const snowballDebts = [...debts].sort((a, b) => a.balance - b.balance);
    const snowballMonths = calculatePayoffTime(snowballDebts, monthlyPayment);
    
    // Calculate avalanche method (pay highest interest first)
    const avalancheDebts = [...debts].sort((a, b) => b.interest - a.interest);
    const avalancheMonths = calculatePayoffTime(avalancheDebts, monthlyPayment);
    
    $('#snowball-time').text(snowballMonths + ' months');
    $('#avalanche-time').text(avalancheMonths + ' months');
    $('#debt-results').show();
    
    // Track calculation
    if (typeof mixpanel !== 'undefined') {
        mixpanel.track('Debt Payoff Calculation', {
            debt_count: debts.length,
            total_debt: debts.reduce((sum, debt) => sum + debt.balance, 0),
            monthly_payment: monthlyPayment
        });
    }
}

function calculatePayoffTime(debts, monthlyPayment) {
    let remainingPayment = monthlyPayment;
    let months = 0;
    const debtCopies = debts.map(debt => ({...debt}));
    
    while (debtCopies.some(debt => debt.balance > 0) && months < 600) { // Max 50 years
        months++;
        
        // Add interest to all debts
        debtCopies.forEach(debt => {
            if (debt.balance > 0) {
                debt.balance += (debt.balance * debt.interest / 100) / 12;
            }
        });
        
        // Pay minimum payments first
        debtCopies.forEach(debt => {
            if (debt.balance > 0) {
                const payment = Math.min(debt.minPayment, debt.balance);
                debt.balance -= payment;
                remainingPayment -= payment;
            }
        });
        
        // Apply remaining payment to first debt with balance
        for (let debt of debtCopies) {
            if (debt.balance > 0 && remainingPayment > 0) {
                const payment = Math.min(remainingPayment, debt.balance);
                debt.balance -= payment;
                remainingPayment -= payment;
            }
        }
    }
    
    return months;
}

function initializePortfolioAnalyzer() {
    $('#analyze-portfolio').on('click', function() {
        analyzePortfolio();
    });
}

function analyzePortfolio() {
    const age = parseInt($('#portfolio-age').val()) || 30;
    const riskTolerance = $('#portfolio-risk').val();
    const stocks = parseInt($('#allocation-stocks').val()) || 0;
    const bonds = parseInt($('#allocation-bonds').val()) || 0;
    const cash = parseInt($('#allocation-cash').val()) || 0;
    const realEstate = parseInt($('#allocation-realestate').val()) || 0;
    
    const total = stocks + bonds + cash + realEstate;
    if (total !== 100) {
        showToast('Allocation percentages must total 100%', 'warning');
        return;
    }
    
    // Get recommended allocation based on age and risk tolerance
    const recommendations = getPortfolioRecommendations(age, riskTolerance);
    
    // Analyze current allocation
    const analysis = analyzeAllocation(stocks, bonds, cash, realEstate, recommendations);
    
    // Display results
    $('#portfolio-recommendations').html(analysis);
    $('#portfolio-results').show();
    
    // Track analysis
    if (typeof mixpanel !== 'undefined') {
        mixpanel.track('Portfolio Analysis', {
            age: age,
            risk_tolerance: riskTolerance,
            current_allocation: {stocks, bonds, cash, realEstate}
        });
    }
}

function getPortfolioRecommendations(age, riskTolerance) {
    const baseStocks = Math.max(100 - age, 20); // At least 20% stocks
    
    switch (riskTolerance) {
        case 'conservative':
            return {
                stocks: Math.min(baseStocks - 20, 40),
                bonds: Math.max(baseStocks + 20, 50),
                cash: 10,
                realEstate: 0
            };
        case 'aggressive':
            return {
                stocks: Math.min(baseStocks + 20, 80),
                bonds: Math.max(baseStocks - 20, 10),
                cash: 5,
                realEstate: 5
            };
        default: // moderate
            return {
                stocks: baseStocks,
                bonds: Math.max(100 - baseStocks - 10, 20),
                cash: 10,
                realEstate: 0
            };
    }
}

function analyzeAllocation(stocks, bonds, cash, realEstate, recommendations) {
    let analysis = '<ul class="list-unstyled">';
    
    // Compare with recommendations
    const stockDiff = stocks - recommendations.stocks;
    const bondDiff = bonds - recommendations.bonds;
    const cashDiff = cash - recommendations.cash;
    
    if (Math.abs(stockDiff) <= 10) {
        analysis += '<li class="text-success"><i class="fa fa-check-circle"></i> Stock allocation is well-balanced</li>';
    } else if (stockDiff > 10) {
        analysis += '<li class="text-warning"><i class="fa fa-exclamation-triangle"></i> Consider reducing stock allocation</li>';
    } else {
        analysis += '<li class="text-info"><i class="fa fa-info-circle"></i> Consider increasing stock allocation</li>';
    }
    
    if (Math.abs(bondDiff) <= 10) {
        analysis += '<li class="text-success"><i class="fa fa-check-circle"></i> Bond allocation is appropriate</li>';
    } else if (bondDiff > 10) {
        analysis += '<li class="text-warning"><i class="fa fa-exclamation-triangle"></i> Consider reducing bond allocation</li>';
    } else {
        analysis += '<li class="text-info"><i class="fa fa-info-circle"></i> Consider increasing bond allocation</li>';
    }
    
    if (cash > 20) {
        analysis += '<li class="text-warning"><i class="fa fa-exclamation-triangle"></i> High cash allocation may reduce long-term returns</li>';
    } else if (cash < 5) {
        analysis += '<li class="text-warning"><i class="fa fa-exclamation-triangle"></i> Low cash allocation may increase risk</li>';
    } else {
        analysis += '<li class="text-success"><i class="fa fa-check-circle"></i> Cash allocation is appropriate</li>';
    }
    
    analysis += '</ul>';
    
    return analysis;
}

// Learning Modules
function initializeLearningModules() {
    console.log('Initializing Learning Modules');
    
    // Net Worth Simulator
    initializeNetWorthSimulator();
    
    // Savings Simulator
    initializeSavingsSimulator();
    
    // Retirement Calculator
    initializeRetirementCalculator();
    
    // Real Estate ROI Calculator
    initializeRealEstateCalculator();
}

function initializeNetWorthSimulator() {
    $('#sim-assets').on('input', function() {
        const value = $(this).val();
        $('#sim-assets-val').text(formatCurrency(value));
        updateNetWorthSimulation();
    });
    
    $('#sim-liabilities').on('input', function() {
        const value = $(this).val();
        $('#sim-liabilities-val').text(formatCurrency(value));
        updateNetWorthSimulation();
    });
    
    $('#load-my-data').on('click', function() {
        loadUserDataForSimulation();
    });
}

function updateNetWorthSimulation() {
    const assets = parseInt($('#sim-assets').val()) || 0;
    const liabilities = parseInt($('#sim-liabilities').val()) || 0;
    const netWorth = assets - liabilities;
    
    $('#sim-networth-result').text(formatCurrency(netWorth));
    
    // Get benchmark data
    getNetWorthBenchmark(netWorth);
}

function getNetWorthBenchmark(netWorth) {
    // Age-based net worth benchmarks (simplified)
    const age = 30; // Could be user input
    const expectedNetWorth = age * 10000; // $10k per year of age
    
    const percentage = (netWorth / expectedNetWorth) * 100;
    
    if (percentage >= 100) {
        $('#sim-networth-benchmark').html('<span class="text-success">Excellent! Above average for your age</span>');
        $('#sim-networth-insight').text('You\'re building wealth faster than most people your age.');
    } else if (percentage >= 75) {
        $('#sim-networth-benchmark').html('<span class="text-warning">Good! Close to average for your age</span>');
        $('#sim-networth-insight').text('You\'re on the right track. Focus on increasing savings and investments.');
    } else {
        $('#sim-networth-benchmark').html('<span class="text-danger">Below average for your age</span>');
        $('#sim-networth-insight').text('Focus on reducing debt and increasing savings to catch up.');
    }
    
    // Create benchmark chart
    createNetWorthBenchmarkChart(netWorth, expectedNetWorth);
}

function createNetWorthBenchmarkChart(actual, expected) {
    const options = {
        series: [{
            name: 'Your Net Worth',
            data: [actual]
        }, {
            name: 'Expected for Age',
            data: [expected]
        }],
        chart: {
            type: 'bar',
            height: 200,
            background: 'transparent'
        },
        colors: ['#007bff', '#6c757d'],
        plotOptions: {
            bar: {
                horizontal: true,
                dataLabels: {
                    position: 'top',
                },
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function (val) {
                return formatCurrency(val);
            },
            style: {
                fontSize: '12px',
                colors: ['#fff']
            }
        },
        xaxis: {
            categories: ['Net Worth'],
            labels: {
                style: {
                    colors: '#fff'
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#fff'
                }
            }
        },
        legend: {
            labels: {
                colors: '#fff'
            }
        }
    };
    
    if ($('#net-worth-benchmark-chart').length) {
        new ApexCharts(document.querySelector("#net-worth-benchmark-chart"), options).render();
    }
}

function initializeSavingsSimulator() {
    $('#savings-amount, #savings-rate').on('input', function() {
        calculateSavingsGrowth();
    });
}

function calculateSavingsGrowth() {
    const weeklyAmount = parseFloat($('#savings-amount').val()) || 0;
    const annualRate = parseFloat($('#savings-rate').val()) || 0;
    const years = 10;
    
    if (weeklyAmount > 0 && annualRate > 0) {
        const monthlyRate = annualRate / 100 / 12;
        const monthlyAmount = weeklyAmount * 4.33; // Average weeks per month
        const months = years * 12;
        
        let futureValue = 0;
        for (let i = 0; i < months; i++) {
            futureValue = (futureValue + monthlyAmount) * (1 + monthlyRate);
        }
        
        $('#savings-result').text(formatCurrency(futureValue));
        
        const totalContributed = monthlyAmount * months;
        const interestEarned = futureValue - totalContributed;
        
        $('#savings-insight').html(`
            <small class="text-muted">
                Total contributed: ${formatCurrency(totalContributed)}<br>
                Interest earned: ${formatCurrency(interestEarned)}
            </small>
        `);
    }
}

function initializeRetirementCalculator() {
    $('#ret-current-age, #ret-retire-age, #ret-current-savings, #ret-annual-contrib, #ret-growth-rate').on('input', function() {
        calculateRetirementProjection();
    });
}

function calculateRetirementProjection() {
    const currentAge = parseInt($('#ret-current-age').val()) || 0;
    const retireAge = parseInt($('#ret-retire-age').val()) || 0;
    const currentSavings = parseFloat($('#ret-current-savings').val()) || 0;
    const annualContrib = parseFloat($('#ret-annual-contrib').val()) || 0;
    const growthRate = parseFloat($('#ret-growth-rate').val()) || 0;
    
    if (currentAge > 0 && retireAge > currentAge && growthRate > 0) {
        const years = retireAge - currentAge;
        const monthlyRate = growthRate / 100 / 12;
        const monthlyContrib = annualContrib / 12;
        const months = years * 12;
        
        let futureValue = currentSavings;
        for (let i = 0; i < months; i++) {
            futureValue = (futureValue + monthlyContrib) * (1 + monthlyRate);
        }
        
        $('#ret-result').text(formatCurrency(futureValue));
        
        // Retirement benchmark (25x annual expenses rule)
        const annualIncome = parseFloat($('#annual-income').val().replace(/,/g, '')) || 75000;
        const targetRetirementSavings = annualIncome * 25;
        
        const percentage = (futureValue / targetRetirementSavings) * 100;
        
        if (percentage >= 100) {
            $('#ret-benchmark').html('<span class="text-success">Excellent! On track for retirement</span>');
            $('#ret-insight').text('You\'re saving enough to maintain your lifestyle in retirement.');
        } else if (percentage >= 75) {
            $('#ret-benchmark').html('<span class="text-warning">Good progress! Consider increasing savings</span>');
            $('#ret-insight').text('You\'re close to your retirement goal. Small increases in savings can help.');
        } else {
            $('#ret-benchmark').html('<span class="text-danger">Below target for retirement</span>');
            $('#ret-insight').text('Consider increasing your retirement contributions to reach your goal.');
        }
        
        createRetirementBenchmarkChart(futureValue, targetRetirementSavings);
    }
}

function createRetirementBenchmarkChart(actual, target) {
    const options = {
        series: [{
            name: 'Your Savings',
            data: [actual]
        }, {
            name: 'Target (25x expenses)',
            data: [target]
        }],
        chart: {
            type: 'bar',
            height: 200,
            background: 'transparent'
        },
        colors: ['#ffc107', '#6c757d'],
        plotOptions: {
            bar: {
                horizontal: true,
                dataLabels: {
                    position: 'top',
                },
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function (val) {
                return formatCurrency(val);
            },
            style: {
                fontSize: '12px',
                colors: ['#fff']
            }
        },
        xaxis: {
            categories: ['Retirement Savings'],
            labels: {
                style: {
                    colors: '#fff'
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#fff'
                }
            }
        },
        legend: {
            labels: {
                colors: '#fff'
            }
        }
    };
    
    if ($('#retirement-benchmark-chart').length) {
        new ApexCharts(document.querySelector("#retirement-benchmark-chart"), options).render();
    }
}

function initializeRealEstateCalculator() {
    $('#re-purchase-price, #re-down-payment, #re-monthly-rent, #re-monthly-expenses').on('input', function() {
        calculateRealEstateROI();
    });
}

function calculateRealEstateROI() {
    const purchasePrice = parseFloat($('#re-purchase-price').val()) || 0;
    const downPayment = parseFloat($('#re-down-payment').val()) || 0;
    const monthlyRent = parseFloat($('#re-monthly-rent').val()) || 0;
    const monthlyExpenses = parseFloat($('#re-monthly-expenses').val()) || 0;
    
    if (purchasePrice > 0 && downPayment > 0 && monthlyRent > 0) {
        const annualRent = monthlyRent * 12;
        const annualExpenses = monthlyExpenses * 12;
        const annualCashFlow = annualRent - annualExpenses;
        const cashOnCashROI = (annualCashFlow / downPayment) * 100;
        
        $('#re-result').text(cashOnCashROI.toFixed(2) + '%');
        
        if (cashOnCashROI >= 8) {
            $('#re-insight').html('<span class="text-success">Excellent ROI! This is a strong investment.</span>');
        } else if (cashOnCashROI >= 5) {
            $('#re-insight').html('<span class="text-warning">Good ROI. Consider the property carefully.</span>');
        } else {
            $('#re-insight').html('<span class="text-danger">Low ROI. May not be the best investment.</span>');
        }
    }
}

// Tax Planning Module
function initializeTaxPlanning() {
    console.log('Initializing Tax Planning');
    
    // Handle tax profile changes
    $('select, input').on('change input', function() {
        calculateTaxEfficiency();
    });
    
    // Initial calculation
    calculateTaxEfficiency();
}

function calculateTaxEfficiency() {
    const filingStatus = $('#tax-filing-status').val();
    const income401k = parseFloat($('#tax-401k-contrib').val().replace(/,/g, '')) || 0;
    const hsaEligible = $('#tax-hsa-eligible').val();
    const iraContrib = parseFloat($('#tax-ira-contrib').val().replace(/,/g, '')) || 0;
    const capitalGains = $('#tax-capital-gains').val();
    const charitableDonations = parseFloat($('#tax-charitable-donations').val().replace(/,/g, '')) || 0;
    
    let score = 50; // Base score
    let recommendations = [];
    
    // 401(k) contribution analysis
    const max401k = 22500; // 2024 limit
    if (income401k >= max401k) {
        score += 20;
        recommendations.push('<li class="text-success"><i class="fa fa-check-circle"></i> Maximizing 401(k) contributions</li>');
    } else if (income401k >= max401k * 0.8) {
        score += 15;
        recommendations.push('<li class="text-warning"><i class="fa fa-exclamation-triangle"></i> Consider increasing 401(k) to reach maximum</li>');
    } else {
        score += 5;
        recommendations.push('<li class="text-info"><i class="fa fa-info-circle"></i> Increase 401(k) contributions for tax savings</li>');
    }
    
    // HSA analysis
    if (hsaEligible === 'yes') {
        score += 15;
        recommendations.push('<li class="text-success"><i class="fa fa-check-circle"></i> HSA eligible - great tax-advantaged savings option</li>');
    } else {
        recommendations.push('<li class="text-info"><i class="fa fa-info-circle"></i> Consider HSA-eligible health plans for tax benefits</li>');
    }
    
    // IRA contribution analysis
    const maxIRA = 7000; // 2024 limit
    if (iraContrib >= maxIRA) {
        score += 15;
        recommendations.push('<li class="text-success"><i class="fa fa-check-circle"></i> Maximizing IRA contributions</li>');
    } else if (iraContrib > 0) {
        score += 10;
        recommendations.push('<li class="text-warning"><i class="fa fa-exclamation-triangle"></i> Consider increasing IRA to reach maximum</li>');
    } else {
        recommendations.push('<li class="text-info"><i class="fa fa-info-circle"></i> Start IRA contributions for additional tax benefits</li>');
    }
    
    // Capital gains analysis
    if (capitalGains === 'loss') {
        score += 10;
        recommendations.push('<li class="text-success"><i class="fa fa-check-circle"></i> Tax-loss harvesting opportunities available</li>');
    } else if (capitalGains === 'gain') {
        recommendations.push('<li class="text-info"><i class="fa fa-info-circle"></i> Consider tax-loss harvesting to offset gains</li>');
    }
    
    // Charitable donations analysis
    if (charitableDonations > 0) {
        score += 5;
        recommendations.push('<li class="text-success"><i class="fa fa-check-circle"></i> Charitable donations provide tax deductions</li>');
    }
    
    // Update display
    updateTaxScoreDisplay(score);
    $('#tax-recommendations-list').html('<ul class="list-unstyled">' + recommendations.join('') + '</ul>');
}

function updateTaxScoreDisplay(score) {
    let scoreText = '';
    let scoreClass = '';
    
    if (score >= 80) {
        scoreText = 'Excellent';
        scoreClass = 'text-success';
    } else if (score >= 60) {
        scoreText = 'Good';
        scoreClass = 'text-warning';
    } else {
        scoreText = 'Needs Improvement';
        scoreClass = 'text-danger';
    }
    
    $('#tax-score-text').html(`<span class="${scoreClass}">${scoreText} (${score}/100)</span>`);
    
    // Create gauge chart
    createTaxScoreChart(score);
}

function createTaxScoreChart(score) {
    const options = {
        series: [score],
        chart: {
            type: 'radialBar',
            height: 200,
            background: 'transparent'
        },
        plotOptions: {
            radialBar: {
                startAngle: -135,
                endAngle: 135,
                hollow: {
                    margin: 15,
                    size: '70%',
                },
                track: {
                    background: '#e7e7e7',
                    strokeWidth: '97%',
                    margin: 5,
                },
                dataLabels: {
                    name: {
                        show: false,
                    },
                    value: {
                        offsetY: 10,
                        color: '#fff',
                        fontSize: '22px',
                        show: true,
                        formatter: function (val) {
                            return val + '/100';
                        }
                    }
                }
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'horizontal',
                shadeIntensity: 0.5,
                gradientToColors: ['#007bff'],
                inverseColors: true,
                opacityFrom: 1,
                opacityTo: 1,
                stops: [0, 100]
            }
        },
        stroke: {
            lineCap: 'round'
        }
    };
    
    if ($('#tax-score-chart').length) {
        new ApexCharts(document.querySelector("#tax-score-chart"), options).render();
    }
}

// Behavioral Finance Module
function initializeBehavioralFinance() {
    console.log('Initializing Behavioral Finance');
    // Content is static, no additional functionality needed
}

// Market Education Module
function initializeMarketEducation() {
    console.log('Initializing Market Education');
    // Content is static, no additional functionality needed
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function showToast(message, type = 'info') {
    // Create toast notification
    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    // Remove existing toasts
    $('.toast').remove();
    
    // Add new toast
    $('body').append(toastHtml);
    
    // Show toast
    const toast = new bootstrap.Toast(document.querySelector('.toast'));
    toast.show();
}

function loadUserDataForSimulation() {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Please log in to load your financial data', 'warning');
        return;
    }
    
    // Load user's actual financial data for simulation
    $.ajax({
        url: '/api/financial-snapshot',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        success: function(data) {
            if (data.assets !== undefined) {
                $('#sim-assets').val(data.assets);
                $('#sim-assets-val').text(formatCurrency(data.assets));
            }
            if (data.liabilities !== undefined) {
                $('#sim-liabilities').val(data.liabilities);
                $('#sim-liabilities-val').text(formatCurrency(data.liabilities));
            }
            updateNetWorthSimulation();
            showToast('Your financial data loaded successfully!', 'success');
        },
        error: function(xhr, status, error) {
            console.log('Error loading user data for simulation:', error);
            console.log('Status:', xhr.status);
            
            if (xhr.status === 401) {
                showToast('Please log in to load your financial data', 'warning');
            } else if (xhr.status === 404) {
                showToast('No financial data found. Please add your first net worth entry.', 'info');
            } else {
                showToast('Unable to load your financial data', 'warning');
            }
        }
    });
} 