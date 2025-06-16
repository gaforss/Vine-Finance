// Retirement lifestyle templates
const retirementTemplates = {
    conservative: {
        mortgage: 25,        // Higher housing allocation
        cars: 5,            // Higher car budget
        healthCare: 15,     // Higher healthcare focus
        foodAndDrinks: 12,  // Moderate food budget
        travelAndEntertainment: 18, // Lower lifestyle spending
        reinvestedFunds: 25  // Strong reinvestment
    },
    moderate: {
        mortgage: 22,        // Standard housing
        cars: 3,            // Standard car budget
        healthCare: 12,     // Standard healthcare
        foodAndDrinks: 10,  // Standard food budget
        travelAndEntertainment: 28, // Active lifestyle
        reinvestedFunds: 25  // Steady reinvestment
    },
    aggressive: {
        mortgage: 20,        // Lower housing
        cars: 2,            // Lower car budget
        healthCare: 10,     // Basic healthcare
        foodAndDrinks: 8,   // Lower food budget
        travelAndEntertainment: 35, // Higher lifestyle spending
        reinvestedFunds: 25  // Maintained reinvestment
    }
};

document.addEventListener('DOMContentLoaded', async () => {

    await fetchRetirementGoals();
    setupPercentageListeners();
    calculateValues();
    const { goalMet } = await renderRetirementChart();
    await fetchAssumedMonthlyBudget();
    await renderNetWorthComparisonChart(goalMet);

    // <a href="/retirement#openRetirementGoals">Review Your Retirement Goals</a>

    // Check if the URL contains a hash to open the modal
    if (window.location.hash === '#openRetirementGoals') {
        const modal = new bootstrap.Modal(document.getElementById('retirementGoalsModal'));
        modal.show();
    }



    // Templates
    document.querySelectorAll('.apply-template').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent any default button behavior
            const templateName = e.target.closest('.apply-template').dataset.template;
            console.log('Template button clicked:', templateName); // Debug log
            if (templateName) {
                applyRetirementTemplate(templateName);
            }
        });
    });

    // Export
    document.getElementById('exportPDF')?.addEventListener('click', exportToPDF);
    document.getElementById('exportCSV')?.addEventListener('click', exportToCSV);

    // Form validation
    document.getElementById('retirementForm')?.addEventListener('input', (e) => {
        if (e.target.id === 'currentAge' || e.target.id === 'retirementAge') {
            const currentAge = parseInt(document.getElementById('currentAge').value) || 0;
            const retirementAge = parseInt(document.getElementById('retirementAge').value) || 0;
            
            if (retirementAge <= currentAge) {
                e.target.setCustomValidity('Retirement age must be greater than current age');
            } else {
                e.target.setCustomValidity('');
            }
        }
    });

    // Reset to defaults
    document.getElementById('resetToDefaults')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset to default values?')) {
            const defaults = {
                currentAge: 25,
                retirementAge: 60,
                monthlySpend: 7500,
                mortgage: 22,
                cars: 3,
                healthCare: 12,
                foodAndDrinks: 10,
                travelAndEntertainment: 28,
                reinvestedFunds: 25
            };
            
            Object.entries(defaults).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('input'));
                }
            });
        }
    });

    // Save as draft
    document.getElementById('saveAsDraft')?.addEventListener('click', async () => {
        const form = document.getElementById('retirementForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.userId = await getUserId();
        data.isDraft = true;
        
        try {
            const response = await fetch('/retirement/goals/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error('Failed to save draft');
            
            alert('Draft saved successfully');
        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Error saving draft. Please try again.');
        }
    });

    // Save Goals
    document.getElementById('retirementGoalsForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const goals = Object.fromEntries(formData.entries());
        goals.userId = await getUserId();

        const totalPercentage = ['mortgage', 'cars', 'healthCare', 'foodAndDrinks', 'travelAndEntertainment', 'reinvestedFunds']
            .reduce((sum, key) => sum + (parseFloat(goals[key]) || 0), 0);

        if (Math.round(totalPercentage) !== 100) {
            alert('The total percentage of all categories must be exactly 100%. Please adjust the sliders.');
            return;
        }

        try {
            const response = await fetch('/retirement/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goals)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save retirement goals.');
            }

            const modalElement = document.getElementById('retirementGoalsModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }

            alert('Retirement goals saved successfully!');

            // Refresh all data and charts
            await fetchRetirementGoals();
            await calculateValues();
            await renderRetirementChart();
            await renderNetWorthComparisonChart();

        } catch (error) {
            console.error('Error saving retirement goals:', error);
            alert(`Error: ${error.message}`);
        }
    });

    // Template hover preview functionality
    document.querySelectorAll('.template-card').forEach(card => {
        const templateName = card.dataset.template;
        const preview = card.querySelector('.template-preview');
        const description = card.querySelector('.template-description');
        
        card.addEventListener('mouseenter', () => {
            // Get current values
            const currentValues = {
                mortgage: parseFloat(document.getElementById('mortgage').value) || 0,
                cars: parseFloat(document.getElementById('cars').value) || 0,
                healthCare: parseFloat(document.getElementById('healthCare').value) || 0,
                foodAndDrinks: parseFloat(document.getElementById('foodAndDrinks').value) || 0,
                travelAndEntertainment: parseFloat(document.getElementById('travelAndEntertainment').value) || 0,
                reinvestedFunds: parseFloat(document.getElementById('reinvestedFunds').value) || 0
            };
            
            const templateValues = retirementTemplates[templateName];
            const changes = Object.entries(templateValues).map(([category, value]) => {
                const diff = value - currentValues[category];
                return {
                    category,
                    diff,
                    isPositive: diff > 0,
                    newValue: value
                };
            }).filter(change => change.diff !== 0);
            
            if (changes.length > 0) {
                const previewContent = changes.map(change => `
                    <div class="d-flex justify-content-between mb-1">
                        <span>${formatCategoryName(change.category)}:</span>
                        <span class="${change.isPositive ? 'text-success' : 'text-danger'}">
                            ${change.isPositive ? '+' : ''}${change.diff}% (${change.newValue}%)
                        </span>
                    </div>
                `).join('');
                
                preview.innerHTML = `
                    <h6 class="mb-2">Preview Changes:</h6>
                    <div class="small">
                        ${previewContent}
                    </div>
                    <div class="mt-2 small text-muted">
                        <i class="fa fa-info-circle me-1"></i>
                        ${getTemplateDescription(templateName)}
                    </div>
                `;
            } else {
                preview.innerHTML = `
                    <h6 class="mb-2">Current Settings</h6>
                    <div class="small text-muted">
                        <i class="fa fa-check-circle me-1"></i>
                        This matches your current allocation
                    </div>
                `;
            }
            
            description.classList.add('d-none');
            preview.classList.remove('d-none');
        });
        
        card.addEventListener('mouseleave', () => {
            description.classList.remove('d-none');
            preview.classList.add('d-none');
        });
    });

    // Template Application Function
    function applyRetirementTemplate(templateName) {
        console.log('Applying template:', templateName);
        const template = retirementTemplates[templateName];
        if (!template) {
            console.error('Template not found:', templateName);
            return;
        }

        // Store current values for comparison
        const currentValues = {
            mortgage: parseFloat(document.getElementById('mortgage').value) || 0,
            cars: parseFloat(document.getElementById('cars').value) || 0,
            healthCare: parseFloat(document.getElementById('healthCare').value) || 0,
            foodAndDrinks: parseFloat(document.getElementById('foodAndDrinks').value) || 0,
            travelAndEntertainment: parseFloat(document.getElementById('travelAndEntertainment').value) || 0,
            reinvestedFunds: parseFloat(document.getElementById('reinvestedFunds').value) || 0
        };

        // Update all percentage inputs
        Object.entries(template).forEach(([category, value]) => {
            console.log(`Updating ${category} to ${value}%`);
            const input = document.getElementById(category);
            if (input) {
                // Set the slider value
                input.value = value;
                
                // Update the percentage display
                const percentElement = document.getElementById(`${category}Percent`);
                if (percentElement) {
                    percentElement.textContent = `${value}%`;
                }
                
                // Update the value input
                const valueInput = document.getElementById(`${category}ValueInput`);
                if (valueInput) {
                    const monthlySpend = parseFloat(document.getElementById('monthlySpend').value) || 0;
                    const categoryValue = (monthlySpend * value / 100).toFixed(2);
                    valueInput.value = `$${parseFloat(categoryValue).toLocaleString('en-US')}`;
                }

                // Update the main display value
                const displayValue = document.getElementById(`${category}Value`);
                if (displayValue) {
                    const monthlySpend = parseFloat(document.getElementById('monthlySpend').value) || 0;
                    const categoryValue = (monthlySpend * value / 100).toFixed(2);
                    displayValue.textContent = `$${parseFloat(categoryValue).toLocaleString('en-US')}`;
                }

                // Trigger input event to ensure all listeners are notified
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                console.error(`Input element not found for category: ${category}`);
            }
        });

        // Update the main display values
        updatePercentageDisplays();
        calculateValues();
        validateTotalPercentage();

        // Show detailed feedback
        const changes = Object.entries(template).map(([category, value]) => {
            const diff = value - currentValues[category];
            return {
                category: formatCategoryName(category),
                diff,
                isPositive: diff > 0,
                newValue: value
            };
        }).filter(change => change.diff !== 0);

        const feedback = document.createElement('div');
        feedback.className = 'alert alert-success mt-2';
        feedback.innerHTML = `
            <h6 class="mb-2">${templateName.charAt(0).toUpperCase() + templateName.slice(1)} Template Applied</h6>
            <div class="small">
                ${changes.map(change => `
                    <div class="d-flex justify-content-between mb-1">
                        <span>${change.category}:</span>
                        <span class="${change.isPositive ? 'text-success' : 'text-danger'}">
                            ${change.isPositive ? '+' : ''}${change.diff}% (${change.newValue}%)
                        </span>
                    </div>
                `).join('')}
            </div>
            <div class="mt-2">
                <small class="text-muted">
                    <i class="fa fa-info-circle me-1"></i>
                    ${getTemplateDescription(templateName)}
                </small>
            </div>
            <div class="mt-2">
                <small class="text-muted">
                    <i class="fa fa-sliders me-1"></i>
                    You can fine-tune these values using the sliders above.
                </small>
            </div>
        `;

        const templateCard = document.querySelector(`[data-template="${templateName}"]`).closest('.card-body');
        if (templateCard) {
            templateCard.appendChild(feedback);
            setTimeout(() => feedback.remove(), 5000);
        }
    }

    // Helper function to get template description
    function getTemplateDescription(templateName) {
        const descriptions = {
            conservative: "Focuses on essential expenses and financial security",
            moderate: "Balances essential expenses with lifestyle spending",
            aggressive: "Prioritizes lifestyle spending and experiences"
        };
        return descriptions[templateName] || "";
    }

    // Helper function to format category names
    function formatCategoryName(category) {
        const names = {
            mortgage: 'Mortgage',
            cars: 'Cars',
            healthCare: 'Healthcare',
            foodAndDrinks: 'Food & Drinks',
            travelAndEntertainment: 'Entertainment',
            reinvestedFunds: 'Reinvested'
        };
        return names[category] || category;
    }
});

async function fetchRetirementProjections() {
    try {
        const userId = await getUserId();
        console.log(`Fetching projections for User ID: ${userId}`);
        const response = await fetch(`/retirement/projections?userId=${userId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch retirement projections');
        }
        const data = await response.json();
        console.log('Fetched Projections:', data);

        // Update the DOM with intersection age or shortfall message
        const outcomeElement = document.getElementById('retirement-outcome');
        if (data.goalMet) {
            outcomeElement.innerHTML = `
                <div class="card text-center border-success">
                    <div class="card-body">
                        <i class="fa fa-check-circle text-success fa-3x mb-3"></i>
                        <h4 class="card-title">You're On Track for Retirement!</h4>
                        <p class="card-text fs-5">Based on your current plan, you can retire by age</p>
                        <h1 class="display-1 text-success">${data.intersectionAge}</h1>
                    </div>
                    <div class="card-footer text-muted">
                        Keep up the great work! Consider reviewing your goals periodically to stay on course.
                    </div>
                </div>
            `;
        } else {
            outcomeElement.innerHTML = `
                <div class="alert alert-warning">
                    <h5 class="alert-heading">You're Not Quite on Track</h5>
                    <p>Based on your current plan, you're projected to have a shortfall of <strong class="text-danger">$${Math.round(data.shortfall).toLocaleString()}</strong> by your target retirement age.</p>
                    <hr>
                    <p class="mb-0">Here are some ways you can close the gap:</p>
                    <ul>
                        <li><strong>Increase your annual savings:</strong> Even small increases can make a big difference over time.</li>
                        <li><strong>Adjust your retirement spending:</strong> Re-evaluating your budget can lower your required savings.</li>
                        <li><strong>Consider a later retirement date:</strong> A few more years of growth and savings can have a major impact.</li>
                    </ul>
                </div>`;
        }

        return data;
    } catch (error) {
        console.error('Error fetching retirement projections:', error);
        return { projections: [], currentNetWorth: 0, intersectionAge: 'N/A' };
    }
}

async function renderRetirementChart() {
    try {
        const { projections, currentNetWorth, intersectionAge, goalMet, shortfall, requiredSavings: apiRequiredSavings } = await fetchRetirementProjections();
        if (projections.length === 0) {
            return;
        }

        const userId = await getUserId();
        const response = await fetch(`/retirement/goals?userId=${userId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch retirement goals');
        }
        const goals = await response.json();

        const monthlySpend = goals.monthlySpend || 0;
        const retirementAge = goals.retirementAge || 65;
        const currentAge = goals.currentAge || 30;

        const currentYear = new Date().getFullYear();
        const yearsUntilRetirement = retirementAge - currentAge;
        const retirementDuration = Math.max(30, 85 - retirementAge);
        const annualSpend = monthlySpend * 12;
        const requiredSavings = apiRequiredSavings || (annualSpend * retirementDuration);

        console.log(`Rendering chart with the following data:`);
        console.log(`Current Age: ${currentAge}`);
        console.log(`Retirement Age: ${retirementAge}`);
        console.log(`Monthly Spend: ${monthlySpend}`);
        console.log(`Current Net Worth: ${currentNetWorth}`);
        console.log(`Required Savings: ${requiredSavings}`);
        console.log(`Intersection Age: ${intersectionAge}`);

        const seriesData = projections.map(p => {
            if (!p.data || p.data.length === 0) {
                console.error(`No data available for rate: ${p.rate}%`);
                return null;
            }

            const dataPoints = p.data.map(d => ({
                x: d.year,
                y: Math.round(d.value)
            }));

            return {
                name: `${Math.round(p.rate)}% Growth`,
                data: dataPoints,
                type: p.rate === 5 ? 'area' : 'line',
                dashArray: p.rate === 5 ? 0 : 5 // Use dash array for dotted lines for 7%, 9%, and 11%
            };
        }).filter(series => series !== null);

        const options = {
            chart: {
                type: 'area',
                height: 400,
                toolbar: {
                    show: false
                },
                dropShadow: {
                    enabled: true,
                    top: 3,
                    left: 3,
                    blur: 4,
                    opacity: 0.2
                }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.9,
                    stops: [0, 90, 100]
                }
            },
            series: seriesData,
            xaxis: {
                type: 'category',
                title: {
                    text: 'My Age',
                    style: {
                        fontSize: '14px',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        color: '#9aa0ac'
                    }
                },
                labels: {
                    style: {
                        fontSize: '12px',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        colors: ['#9aa0ac']
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        fontSize: '12px',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        colors: ['#9aa0ac']
                    },
                    formatter: function (val) {
                        return `$${Math.round(val).toLocaleString('en-US')}`;
                    }
                }
            },
            tooltip: {
                theme: 'dark',
                x: {
                    formatter: function (val) {
                        return `Year ${val}`;
                    }
                },
                y: {
                    formatter: function (val) {
                        return `$${Math.round(val).toLocaleString('en-US')}`;
                    }
                },
                style: {
                    fontSize: '12px',
                    fontFamily: 'Helvetica, Arial, sans-serif'
                }
            },
            annotations: {
                yaxis: [
                    {
                        y: requiredSavings,
                        borderColor: '#FFC72C',
                        opacity: 0.5,
                        label: {
                            borderColor: '#003087',
                            style: {
                                color: '#fff',
                                background: '#003087',
                                fontSize: '12px',
                                fontFamily: 'Helvetica, Arial, sans-serif'
                            },
                            text: `Required Savings: $${requiredSavings.toLocaleString('en-US')}`
                        }
                    }
                ]
            },
            grid: {
                borderColor: '#e7e7e7',
                show: false
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            markers: {
                size: 0 // Remove the white dots
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: 'vertical',
                    shadeIntensity: 0.5,
                    gradientToColors: ['#003087', '#009cde', '#FFC72C'],
                    inverseColors: false,
                    opacityFrom: 1,
                    opacityTo: 0.6,
                    stops: [0, 90, 100]
                }
            },
            legend: {
                show: false
            },
            theme: {
                mode: 'light',
                palette: 'palette1'
            },
            colors: ['#003087', '#009cde', '#FFC72C'],
            dataLabels: {
                enabled: false
            }
        };

        const chart = new ApexCharts(document.querySelector("#retirementChart"), options);
        await chart.render();

        return { goalMet };

        // Display the intersection age
        document.getElementById('intersectionAge').textContent = intersectionAge.toLocaleString('en-US');

    } catch (error) {
        console.error('Error rendering retirement chart:', error);
        return { goalMet: false };
    }
}

async function fetchAssumedMonthlyBudget() {
    try {
        const userId = await getUserId();
        const response = await fetch(`/retirement/goals?userId=${userId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch retirement goals');
        }
        const goals = await response.json();
        const monthlySpend = goals.monthlySpend || 0;

        // Update the monthly budget values
        const formatMonthlyValue = (value) => {
            if (isNaN(value) || value === undefined) return '$0';
            return `$${Math.round(value).toLocaleString('en-US')}`;
        };

        // Update all monthly budget categories using the correct property names from the database
        const categories = [
            { id: 'mortgageValue', percentage: goals.mortgage || 0 },
            { id: 'carsValue', percentage: goals.cars || 0 },
            { id: 'healthCareValue', percentage: goals.healthCare || 0 },
            { id: 'foodAndDrinksValue', percentage: goals.foodAndDrinks || 0 },
            { id: 'travelAndEntertainmentValue', percentage: goals.travelAndEntertainment || 0 },
            { id: 'reinvestedFundsValue', percentage: goals.reinvestedFunds || 0 }
        ];

        // Calculate total percentage to ensure it's 100%
        const totalPercentage = categories.reduce((sum, cat) => sum + (cat.percentage || 0), 0);
        if (totalPercentage !== 100) {
            console.warn(`Total percentage is ${totalPercentage}%, should be 100%`);
        }

        // Update all category values
        categories.forEach(category => {
            const value = monthlySpend * ((category.percentage || 0) / 100);
            const element = document.getElementById(category.id);
            if (element) {
                element.textContent = formatMonthlyValue(value);
            }
        });

        // Update the input fields in the modal
        const updateInputField = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        };

        updateInputField('mortgage', goals.mortgage || 0);
        updateInputField('cars', goals.cars || 0);
        updateInputField('healthCare', goals.healthCare || 0);
        updateInputField('foodAndDrinks', goals.foodAndDrinks || 0);
        updateInputField('travelAndEntertainment', goals.travelAndEntertainment || 0);
        updateInputField('reinvestedFunds', goals.reinvestedFunds || 0);

        // Update the percentage displays
        updatePercentageDisplays();
    } catch (error) {
        console.error('Error fetching assumed monthly budget:', error);
    }
}

async function fetchNetWorthComparison() {
    try {
        const userId = await getUserId();
        console.log('Fetching net worth comparison for user ID:', userId);

        const response = await fetch(`/retirement/networth/comparison?userId=${userId}`);
        console.log('Fetch response:', response);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Fetch response text:', errorText);
            throw new Error('Failed to fetch net worth comparison');
        }

        const data = await response.json();
        console.log('Fetched net worth comparison data:', data);
        return data;
    } catch (error) {
        console.error('Error in fetchNetWorthComparison:', error);
        throw error;
    }
}

async function renderNetWorthComparisonChart(goalMet, ageBracket) {
    try {
        const data = await fetchNetWorthComparison(ageBracket);
        console.log('Rendering net worth comparison chart with data:', data);

        const { userNetWorth, ageGroupAverage } = data;
        if (userNetWorth === undefined || ageGroupAverage === undefined) {
            throw new Error('Data is not in the expected format');
        }

        let percentage = (userNetWorth / ageGroupAverage) * 100;
        percentage = Math.min(percentage, 100); // Cap the percentage at 100
        percentage = parseFloat(percentage.toFixed(2));

        const insightsContainer = document.getElementById('comparisonInsights');
        let insightMessage = '';
        let insightColorClass = '';

        if (goalMet) {
            if (percentage > 100) {
                insightMessage = `Excellent! You're exceeding the top 10% of your peers and are on track to meet your retirement goals. Your financial planning is outstanding.`;
                insightColorClass = 'text-success';
            } else if (percentage >= 75) {
                insightMessage = `You're doing great, ranking in the top 25% of your peers and on track for your retirement goals. Keep up the great work!`;
                insightColorClass = 'text-info';
            } else {
                insightMessage = `You're on track to meet your retirement goals! While you're currently tracking behind some peers, your personal plan is solid.`;
                insightColorClass = 'text-primary';
            }
        } else {
            if (percentage > 100) {
                insightMessage = `You are ahead of your peers, which is great, but you are not on track to meet your ambitious retirement goals. Let's adjust your plan to close the gap.`;
                insightColorClass = 'text-warning';
            } else if (percentage >= 50) {
                insightMessage = `You're tracking with your peers, but your current plan shows a shortfall for your retirement goals. Let's focus on increasing your savings rate.`;
                insightColorClass = 'text-warning';
            } else {
                insightMessage = `There is a significant gap compared to your peers, and you are not on track to meet your retirement goals. It's time to take action and revise your financial strategy.`;
                insightColorClass = 'text-danger';
            }
        }

        insightsContainer.innerHTML = `<p class="${insightColorClass}">${insightMessage}</p>`;

        const options = {
            chart: {
                type: 'radialBar',
                height: 275,
                offsetY: 0,
                toolbar: {
                    show: false
                }
            },
            series: [percentage],
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 225,
                    hollow: {
                        margin: 5,
                        size: '80%',
                        background: 'transparent',
                        image: undefined,
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
                            show: false,
                        },
                        value: {
                            fontSize: '32px',
                            offsetY: 10,
                            formatter: function (val) {
                                return val + "%";
                            }
                        }
                    },
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: 'horizontal',
                    shadeIntensity: 0.5,
                    gradientToColors: ['#003087', '#009cde', '#f2c500'],
                    inverseColors: false,
                    opacityFrom: 1,
                    opacityTo: 1,
                    stops: [0, 50, 100]
                }
            },
            stroke: {
                lineCap: 'round',
                width: 15  // Increase the width of the stroke to make the bar thicker
            },
            labels: ['Top 10% Benchmark']
        };

        const chart = new ApexCharts(document.querySelector("#netWorthComparisonChart"), options);
        chart.render();
    } catch (error) {
        console.error('Error rendering net worth comparison chart:', error);
    }
}

async function fetchRetirementGoals() {
    try {
        const userId = await getUserId();
        console.log('User ID:', userId);
        const response = await fetch(`/retirement/goals?userId=${userId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch retirement goals');
        }
        const goals = await response.json();
        console.log('Retirement goals:', goals);

        // Set values from goals or defaults if not provided
        document.getElementById('currentAge').value = goals.currentAge;
        document.getElementById('retirementAge').value = goals.retirementAge;
        document.getElementById('monthlySpend').value = goals.monthlySpend;
        document.getElementById('mortgage').value = goals.mortgage;
        document.getElementById('cars').value = goals.cars;
        document.getElementById('healthCare').value = goals.healthCare;
        document.getElementById('foodAndDrinks').value = goals.foodAndDrinks;
        document.getElementById('travelAndEntertainment').value = goals.travelAndEntertainment;
        document.getElementById('reinvestedFunds').value = goals.reinvestedFunds;

        updatePercentageDisplays();
        calculateValues();
    } catch (error) {
        console.error('Error fetching retirement goals:', error);
    }
}

document.getElementById('retirementForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    if (!validateTotalPercentage()) {
        alert('The total percentage of all categories must equal 100%.');
        return;
    }

    const form = document.getElementById('retirementForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.userId = await getUserId();

    try {
        console.log('Saving retirement goals:', data);
        const response = await fetch('/retirement/goals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save retirement goals');
        }

        alert('Retirement goals saved successfully');

        // Clear the form
        form.reset();

        // Close the modal
        const modal = new bootstrap.Modal(document.getElementById('retirementGoalsModal'));
        modal.hide();

        // Refresh the page
        window.location.reload();
    } catch (error) {
        console.error('Error saving retirement goals:', error);
        alert('Error saving retirement goals: ' + error.message);
    }
});

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
    console.log('Fetched user:', user);
    return user._id;
}

function setupPercentageListeners() {
    const percentageFields = document.querySelectorAll('.percentage-field');
    percentageFields.forEach(field => {
        field.addEventListener('input', () => {
            updatePercentageDisplays();
            calculateValues();
            validateTotalPercentage();
        });
    });

    document.getElementById('monthlySpend').addEventListener('input', calculateValues);
}

function updatePercentageDisplays() {
    const categories = [
        'mortgage',
        'cars',
        'healthCare',
        'foodAndDrinks',
        'travelAndEntertainment',
        'reinvestedFunds'
    ];

    categories.forEach(category => {
        const value = document.getElementById(category).value;
        document.getElementById(`${category}Percent`).textContent = `${value}%`;
    });
}

function calculateValues() {
    const monthlySpend = parseFloat(document.getElementById('monthlySpend').value) || 0;

    const categories = [
        'mortgage',
        'cars',
        'healthCare',
        'foodAndDrinks',
        'travelAndEntertainment',
        'reinvestedFunds'
    ];

    categories.forEach(category => {
        const percentage = parseFloat(document.getElementById(category).value) || 0;
        const value = (monthlySpend * (percentage / 100)).toFixed(2);
        document.getElementById(`${category}Value`).value = `$${value.toLocaleString('en-US')}`;
    });

    validateTotalPercentage();
}

function validateTotalPercentage() {
    const categories = [
        'mortgage',
        'cars',
        'healthCare',
        'foodAndDrinks',
        'travelAndEntertainment',
        'reinvestedFunds'
    ];

    let totalPercentage = 0;
    categories.forEach(category => {
        totalPercentage += parseFloat(document.getElementById(category).value) || 0;
    });

    const percentageIndicator = document.getElementById('percentageIndicator');
    const saveButton = document.getElementById('saveGoalsButton');
    if (totalPercentage !== 100) {
        percentageIndicator.textContent = `${totalPercentage}% (must equal 100%)`;
        percentageIndicator.style.width = `${totalPercentage}%`;
        percentageIndicator.classList.remove('bg-success');
        percentageIndicator.classList.add('bg-danger');
        saveButton.disabled = true;
        return false;
    } else {
        percentageIndicator.textContent = `${totalPercentage}%`;
        percentageIndicator.style.width = `${totalPercentage}%`;
        percentageIndicator.classList.remove('bg-danger');
        percentageIndicator.classList.add('bg-success');
        saveButton.disabled = false;
        return true;
    }
}



// Export Functions
async function exportToPDF() {
    let exportButton;
    let originalText;
    
    try {
        // Get the export button and show loading state
        exportButton = document.getElementById('exportPDF');
        if (!exportButton) {
            throw new Error('Export button not found');
        }
        originalText = exportButton.innerHTML;
        exportButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating PDF...';
        exportButton.disabled = true;

        // Fetch the data
        console.log('Fetching retirement data...');
        const userId = await getUserId();
        const goals = await fetch(`/retirement/goals?userId=${userId}`).then(r => {
            if (!r.ok) throw new Error('Failed to fetch retirement goals');
            return r.json();
        });
        const { projections, currentNetWorth, intersectionAge } = await fetchRetirementProjections();
        console.log('Data fetched successfully');

        // Create a formatted date string
        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Create a temporary container for the PDF content
        console.log('Creating PDF content...');
        const container = document.createElement('div');
        container.id = 'pdf-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 800px;
            padding: 40px;
            background: white;
            z-index: 9999;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            transform: translateX(-100%);
        `;
        
        // Create the PDF content with minimal styling
        container.innerHTML = `
            <div style="font-family: Arial, sans-serif;">
                <h1 style="color: #003087; font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #003087; padding-bottom: 10px;">
                    Retirement Plan - ${date}
                </h1>
                
                <div style="margin-bottom: 20px; border: 1px solid #ccc; padding: 15px;">
                    <h2 style="color: #003087; font-size: 20px; margin-bottom: 15px;">Current Status</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;"><strong>Current Age:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">${goals.currentAge}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;"><strong>Planned Retirement Age:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">${goals.retirementAge}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;"><strong>Current Net Worth:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">$${currentNetWorth.toLocaleString('en-US')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;"><strong>Projected Retirement Date:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">Age ${intersectionAge}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="margin-bottom: 20px; border: 1px solid #ccc; padding: 15px;">
                    <h2 style="color: #003087; font-size: 20px; margin-bottom: 15px;">Monthly Budget</h2>
                    <p style="margin-bottom: 15px;"><strong>Total Monthly Spend:</strong> $${goals.monthlySpend.toLocaleString('en-US')}</p>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="background-color: #f5f5f5;">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ccc;">Category</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ccc;">Percentage</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ccc;">Monthly Amount</th>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">Mortgages</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">${goals.mortgage}%</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">$${(goals.monthlySpend * goals.mortgage / 100).toLocaleString('en-US')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">Cars</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">${goals.cars}%</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">$${(goals.monthlySpend * goals.cars / 100).toLocaleString('en-US')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">Health Care</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">${goals.healthCare}%</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">$${(goals.monthlySpend * goals.healthCare / 100).toLocaleString('en-US')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">Food & Drinks</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">${goals.foodAndDrinks}%</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">$${(goals.monthlySpend * goals.foodAndDrinks / 100).toLocaleString('en-US')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">Travel & Entertainment</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">${goals.travelAndEntertainment}%</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">$${(goals.monthlySpend * goals.travelAndEntertainment / 100).toLocaleString('en-US')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ccc;">Reinvested Funds</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">${goals.reinvestedFunds}%</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">$${(goals.monthlySpend * goals.reinvestedFunds / 100).toLocaleString('en-US')}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="margin-bottom: 20px; border: 1px solid #ccc; padding: 15px;">
                    <h2 style="color: #003087; font-size: 20px; margin-bottom: 15px;">Projections</h2>
                    <p style="margin-bottom: 15px;">Based on different growth rates:</p>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="background-color: #f5f5f5;">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ccc;">Growth Rate</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ccc;">Value at Retirement</th>
                        </tr>
                        ${projections.map(p => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ccc;">${p.rate}% Growth</td>
                                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ccc;">$${p.data[p.data.length - 1].value.toLocaleString('en-US')}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            </div>
        `;

        // Add the container to the document
        document.body.appendChild(container);
        
        // Wait for the content to be rendered
        await new Promise(resolve => setTimeout(resolve, 100));

        // Configure PDF options
        const opt = {
            margin: 0.5,
            filename: `retirement-plan-${date}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: true,
                letterRendering: true,
                allowTaint: true,
                foreignObjectRendering: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 800,
                windowHeight: container.offsetHeight
            },
            jsPDF: { 
                unit: 'in', 
                format: 'letter', 
                orientation: 'portrait'
            }
        };

        try {
            // Generate and download the PDF
            await html2pdf().set(opt).from(container).save();
            
            // Show success message
            const successAlert = document.createElement('div');
            successAlert.className = 'alert alert-success mt-2';
            successAlert.innerHTML = '<i class="fa fa-check-circle me-2"></i>PDF generated successfully!';
            exportButton.parentNode.appendChild(successAlert);
            setTimeout(() => successAlert.remove(), 3000);
        } catch (error) {
            console.error('Error during PDF generation:', error);
            throw error;
        } finally {
            // Clean up
            document.body.removeChild(container);
            if (exportButton) {
                exportButton.innerHTML = originalText;
                exportButton.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error in exportToPDF:', error);
        const errorAlert = document.createElement('div');
        errorAlert.className = 'alert alert-danger mt-2';
        errorAlert.innerHTML = `<i class="fa fa-exclamation-circle me-2"></i>${error.message || 'Error generating PDF. Please try again.'}`;
        if (exportButton) {
            exportButton.parentNode.appendChild(errorAlert);
            setTimeout(() => errorAlert.remove(), 5000);
        } else {
            alert(error.message || 'Error generating PDF. Please try again.');
        }
    }
}

async function exportToCSV() {
    try {
        const userId = await getUserId();
        const goals = await fetch(`/retirement/goals?userId=${userId}`).then(r => r.json());
        const { projections } = await fetchRetirementProjections();

        // Create CSV content
        const headers = ['Category', 'Value', 'Details'];
        const rows = [
            ['Current Age', goals.currentAge, ''],
            ['Retirement Age', goals.retirementAge, ''],
            ['Annual Savings', `$${(goals.annualSavings || 0).toLocaleString()}`, ''],
            ['Monthly Spend', `$${goals.monthlySpend.toLocaleString()}`, '100%'],
            ['Mortgages', `$${(goals.monthlySpend * goals.mortgage / 100).toLocaleString()}`, `${goals.mortgage}%`],
            ['Cars', `$${(goals.monthlySpend * goals.cars / 100).toLocaleString()}`, `${goals.cars}%`],
            ['Health Care', `$${(goals.monthlySpend * goals.healthCare / 100).toLocaleString()}`, `${goals.healthCare}%`],
            ['Food & Drinks', `$${(goals.monthlySpend * goals.foodAndDrinks / 100).toLocaleString()}`, `${goals.foodAndDrinks}%`],
            ['Travel & Entertainment', `$${(goals.monthlySpend * goals.travelAndEntertainment / 100).toLocaleString()}`, `${goals.travelAndEntertainment}%`],
            ['Reinvested Funds', `$${(goals.monthlySpend * goals.reinvestedFunds / 100).toLocaleString()}`, `${goals.reinvestedFunds}%`]
        ];

        // Add projections
        rows.push(['', '', '']);
        rows.push(['Projections', '', '']);
        projections.forEach(p => {
            rows.push([`${p.rate}% Growth`, '', p.data[p.data.length - 1].value]);
        });
        
        // Convert to CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // Create and download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `retirement-plan-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error exporting to CSV:', error);
        alert('Error generating CSV. Please try again.');
    }
}