function getToken() {
    return localStorage.getItem('token');
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
    return user._id;
}

async function renderTopChart() {
    try {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch('/entries', { headers });

        if (!response.ok) {
            if (response.status == 401) {
                redirectToLogin();
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const entries = await response.json();
        if (!Array.isArray(entries)) {
            throw new Error('Expected an array of entries for charts');
        }

        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        const dates = entries.map(entry => new Date(entry.date).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short' }));

        const cash = entries.map(entry => entry.cash || 0);
        const investments = entries.map(entry => entry.investments || 0);
        const realEstate = entries.map(entry => entry.realEstate || 0);
        const retirementAccounts = entries.map(entry => entry.retirementAccounts || 0);
        const vehicles = entries.map(entry => entry.vehicles || 0);
        const personalProperty = entries.map(entry => entry.personalProperty || 0);
        const otherAssets = entries.map(entry => entry.otherAssets || 0);

        const liabilities = entries.map(entry => entry.liabilities || 0);

        const totalAssets = cash.map((c, i) => {
            const total = c + investments[i] + realEstate[i] + retirementAccounts[i] + vehicles[i] + personalProperty[i] + otherAssets[i];
            return total;
        });

        const netWorths = totalAssets.map((total, i) => total - liabilities[i]);

        const options = {
            chart: {
                height: window.innerWidth < 768 ? 300 : 425,
                type: 'line',
                stacked: true,
                toolbar: {
                    show: false
                },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                    dynamicAnimation: {
                        enabled: true,
                        speed: 350
                    }
                }
            },
            stroke: {
                width: window.innerWidth < 768 ? [3, 1.5, 1.5] : [4, 2, 2],
                curve: 'smooth'
            },
            plotOptions: {
                bar: {
                    columnWidth: window.innerWidth < 768 ? '85%' : '70%',
                    borderRadius: 5
                }
            },
            colors: ['#FFC72C', '#003087', '#009cde'],
            series: [{
                name: 'Net Worth',
                type: 'line',
                data: netWorths,
                fill: {
                    type: 'gradient',
                    gradient: {
                        shade: 'light',
                        type: 'vertical',
                        shadeIntensity: 0.5,
                        gradientToColors: ['#FFEB99'],
                        inverseColors: false,
                        opacityFrom: 0.25,
                        opacityTo: 0.55,
                        stops: [0, 90, 100]
                    }
                }
            }, {
                name: 'Assets',
                type: 'bar',
                data: totalAssets,
                color: '#003087'
            }, {
                name: 'Liabilities',
                type: 'bar',
                data: liabilities.map(l => -l),
                color: '#009cde'
            }],
            fill: {
                opacity: [1, .85, .85],
                gradient: {
                    inverseColors: false,
                    shade: 'light',
                    type: 'vertical',
                    opacityFrom: .85,
                    opacityTo: .55,
                    stops: [0, 100, 100, 100]
                }
            },
            labels: dates,
            markers: {
                size: window.innerWidth < 768 ? 0 : 0
            },
            xaxis: {
                type: 'dates',
                labels: {
                    show: false,
                    style: {
                        fontSize: window.innerWidth < 768 ? '10px' : '12px'
                    }
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                }
            },
            yaxis: [{
                labels: {
                    formatter: function(val) {
                        return "$" + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    },
                    style: {
                        fontSize: window.innerWidth < 768 ? '10px' : '12px'
                    }
                }
            }],
            tooltip: {
                shared: true,
                intersect: false,
                y: {
                    formatter: function(val) {
                        if (val) {
                            return "$ " + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                        }
                        return val;
                    }
                },
                style: {
                    fontSize: window.innerWidth < 768 ? '11px' : '13px'
                }
            },
            grid: {
                borderColor: '#f1f1f1',
                padding: {
                    bottom: window.innerWidth < 768 ? 10 : 15
                },
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
            legend: {
                show: false,
                position: window.innerWidth < 768 ? 'bottom' : 'top',
                horizontalAlign: 'center',
                fontSize: window.innerWidth < 768 ? '11px' : '13px',
                markers: {
                    width: window.innerWidth < 768 ? 8 : 10,
                    height: window.innerWidth < 768 ? 8 : 10
                }
            },
            responsive: [{
                breakpoint: 768,
                options: {
                    chart: {
                        height: 300
                    },
                    legend: {
                        show: true,
                        position: 'bottom',
                        offsetY: 0,
                        height: 40
                    }
                }
            }]
        };

        const chart = new ApexCharts(document.querySelector("#assetsLiabilitiesChart"), options);
        chart.render();

    } catch (error) {
        console.error('Error rendering chart:', error);
    }
}

async function renderBarCharts() {
    try {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch('/entries', { headers });

        if (!response.ok) {
            if (response.status == 401) {
                redirectToLogin();
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const entries = await response.json();
        if (!Array.isArray(entries)) {
            throw new Error('Expected an array of entries for charts');
        }

        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        const dates = entries.map(entry => new Date(entry.date).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short' }));
        const realEstateData = entries.map(entry => entry.realEstate);
        const cashData = entries.map(entry => entry.cash);

        const equitiesData = entries.map(entry => 
            (entry.investments || 0) +
            (entry.retirementAccounts || 0) +
            (entry.vehicles || 0) +
            (entry.personalProperty || 0) +
            (entry.otherAssets || 0)
        );

        const commonOptions = {
            chart: {
                type: 'line',
                height: 350,
                toolbar: {
                    show: false
                }
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'dark',
                    type: 'vertical',
                    shadeIntensity: 0.3,
                    gradientToColors: ['#00aaff', '#66ccff', '#b3e6ff'],
                    inverseColors: false,
                    opacityFrom: 0.5,
                    opacityTo: 0.8,
                    stops: [0, 100]
                }
            },
            grid: {
                show: false
            },
            xaxis: {
                categories: dates,
                labels: {
                    show: false
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                },
                title: {
                    text: ''
                }
            },
            yaxis: {
                labels: {
                    formatter: function(val) {
                        return "$" + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    }
                }
            },
            tooltip: {
                y: {
                    formatter: function(val) {
                        return "$ " + val.toLocaleString();
                    }
                }
            }
        };

        const realEstateOptions = {
            ...commonOptions,
            series: [{
                name: 'Real Estate',
                data: realEstateData,
                fill: {
                    type: 'gradient',
                    gradient: {
                        shade: 'dark',
                        type: 'vertical',
                        shadeIntensity: 0.5,
                        gradientToColors: ['#00aaff', '#66ccff'],
                        inverseColors: false,
                        opacityFrom: 0.5,
                        opacityTo: 0.8,
                        stops: [0, 100]
                    }
                }
            }],
            colors: ['#00aaff']
        };

        const equitiesOptions = {
            ...commonOptions,
            series: [{
                name: 'Equities',
                data: equitiesData,
                fill: {
                    type: 'gradient',
                    gradient: {
                        shade: 'dark',
                        type: 'vertical',
                        shadeIntensity: 0.5,
                        gradientToColors: ['#66ccff', '#b3e6ff'],
                        inverseColors: false,
                        opacityFrom: 0.5,
                        opacityTo: 0.8,
                        stops: [0, 100]
                    }
                }
            }],
            colors: ['#66ccff']
        };

        const cashOptions = {
            ...commonOptions,
            series: [{
                name: 'Cash',
                data: cashData,
                fill: {
                    type: 'gradient',
                    gradient: {
                        shade: 'dark',
                        type: 'vertical',
                        shadeIntensity: 0.5,
                        gradientToColors: ['#b3e6ff', '#e6f7ff'],
                        inverseColors: false,
                        opacityFrom: 0.5,
                        opacityTo: 0.8,
                        stops: [0, 100]
                    }
                }
            }],
            colors: ['#b3e6ff']
        };

        const realEstateChart = new ApexCharts(document.querySelector("#realEstateChart"), realEstateOptions);
        realEstateChart.render();

        const equitiesChart = new ApexCharts(document.querySelector("#equitiesChart"), equitiesOptions);
        equitiesChart.render();

        const cashChart = new ApexCharts(document.querySelector("#cashChart"), cashOptions);
        cashChart.render();

    } catch (error) {
        console.error('Error rendering line charts:', error);
    }
}

async function populateMetrics() {
    try {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch('/entries', { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const entries = await response.json();
        if (!Array.isArray(entries)) {
            throw new Error('Expected an array of entries for metrics');
        }

        // Sort entries by date in ascending order
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        const netWorths = entries.map(entry => {
            const totalAssets = entry.cash + entry.investments + entry.realEstate + entry.retirementAccounts + entry.vehicles + entry.personalProperty + entry.otherAssets;
            const totalLiabilities = entry.liabilities + entry.customFields.filter(field => field.type === 'liability').reduce((a, b) => a + b.amount, 0);
            return {
                date: new Date(entry.date),
                netWorth: totalAssets - totalLiabilities,
                totalLiabilities: totalLiabilities,
                cash: entry.cash,
                totalAssets: totalAssets
            };
        });

        // Calculate Current Growth Rate (Month-to-Month)
        let currentGrowthRate = 0;
        if (netWorths.length >= 2) {
            const latestEntry = netWorths[netWorths.length - 1];
            const previousEntry = netWorths[netWorths.length - 2];

            if (previousEntry.netWorth > 0) {
                currentGrowthRate = ((latestEntry.netWorth - previousEntry.netWorth) / previousEntry.netWorth) * 100;
            }
        }

        // Update Current Growth Rate Element
        const growthRateElement = document.getElementById('currentGrowthRate');
        if (currentGrowthRate > 0) {
            growthRateElement.className = 'badge text-success me-1';
            growthRateElement.innerHTML = `<i class="fa fa-arrow-up me-1"></i>${currentGrowthRate.toFixed(2)}%`;
        } else if (currentGrowthRate < 0) {
            growthRateElement.className = 'badge text-danger me-1';
            growthRateElement.innerHTML = `<i class="fa fa-arrow-down me-1"></i>${currentGrowthRate.toFixed(2)}%`;
        } else {
            growthRateElement.className = 'badge text-warning me-1';
            growthRateElement.innerHTML = `<i class="fa fa-minus me-1"></i>0%`;
        }

        // Calculate Average Annual Growth using CAGR
        const netWorthByYear = {};
        netWorths.forEach(entry => {
            const year = entry.date.getFullYear();
            if (!netWorthByYear[year] || entry.date > netWorthByYear[year].date) {
                netWorthByYear[year] = entry;
            }
        });

        const years = Object.keys(netWorthByYear).sort();
        let averageAnnualGrowth = 0;

        if (years.length >= 2) {
            const firstYear = years[0];
            const lastYear = years[years.length - 1];
            const firstNetWorth = netWorthByYear[firstYear].netWorth;
            const lastNetWorth = netWorthByYear[lastYear].netWorth;
            const numberOfYears = years.length - 1;

            if (firstNetWorth > 0) {
                // CAGR formula: (End Value / Start Value)^(1/number of years) - 1
                averageAnnualGrowth = (Math.pow(lastNetWorth / firstNetWorth, 1/numberOfYears) - 1) * 100;
            }
        }

        const latestEntry = netWorths[netWorths.length - 1];
        const totalNetWorth = latestEntry.netWorth;
        const totalLiabilities = latestEntry.totalLiabilities;
        const cash = latestEntry.cash;
        const totalAssets = latestEntry.totalAssets;
        const cashPercentage = (cash / totalNetWorth) * 100;
        const liquidityRatio = (cash / totalLiabilities) * 100;

        document.getElementById('totalNetWorth').textContent = `$${totalNetWorth.toLocaleString()}`;
        document.getElementById('annualGrowth').textContent = `${averageAnnualGrowth.toFixed(2)}%`;
        document.getElementById('totalLiabilities').textContent = `$${totalLiabilities.toLocaleString()}`;
        document.getElementById('totalCash').textContent = `${cashPercentage.toFixed(2)}%`;

        // Update Liquidity Ratio Element
        const liquidityRatioElement = document.getElementById('liquidityRatio');
        if (liquidityRatio > 0) {
            liquidityRatioElement.className = 'badge text-success me-1';
            liquidityRatioElement.innerHTML = `<i class="fa fa-arrow-up me-1"></i>${liquidityRatio.toFixed(2)}%`;
        } else if (liquidityRatio < 0) {
            liquidityRatioElement.className = 'badge text-danger me-1';
            liquidityRatioElement.innerHTML = `<i class="fa fa-arrow-down me-1"></i>${liquidityRatio.toFixed(2)}%`;
        } else {
            liquidityRatioElement.className = 'badge text-warning me-1';
            liquidityRatioElement.innerHTML = `<i class="fa fa-minus me-1"></i>0%`;
        }

    } catch (error) {
        console.error('Error populating metrics:', error);
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

async function renderNetWorthComparisonChart(ageBracket) {
    try {
        const data = await fetchNetWorthComparison(ageBracket);
        console.log('Rendering net worth comparison chart with data:', data);

        const { userNetWorth, ageGroupAverage } = data;
        if (userNetWorth === undefined || ageGroupAverage === undefined) {
            throw new Error('Data is not in the expected format');
        }

        let percentage = (userNetWorth / ageGroupAverage) * 100;
        percentage = parseFloat(percentage.toFixed(2));

        const options = {
            chart: {
                type: 'radialBar',
                height: 320,
                offsetY: 0
            },
            series: [percentage],
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 225,
                    hollow: {
                        margin: 10,
                        size: '80%',
                        background: 'transparent',
                        image: undefined,
                    },
                    track: {
                        background: '#f2f2f2',
                        strokeWidth: '97%',
                        margin: 5,
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
                        show: true,
                        name: {
                            fontSize: '18px',
                            color: '#888',
                            offsetY: -10
                        },
                        value: {
                            formatter: function (val) {
                                return val + "%";
                            },
                            color: '#111',
                            fontSize: '32px',
                            show: true,
                            offsetY: 16,
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
                    gradientToColors: ['#003087', '#009cde', '#f2c500'],
                    inverseColors: false,
                    opacityFrom: 1,
                    opacityTo: 1,
                    stops: [0, 50, 100]
                }
            },
            stroke: {
                lineCap: 'round'
            },
            labels: ['Top 10% Benchmark']
        };

        const chart = new ApexCharts(document.querySelector("#netWorthComparisonChart"), options);
        chart.render();
    } catch (error) {
        console.error('Error rendering net worth comparison chart:', error);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const token = getToken();
    if (!token) {
        redirectToLogin();
        return;
    }
    await renderTopChart();
    await renderBarCharts();
    await populateMetrics();

    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        new bootstrap.Tooltip(tooltipTriggerEl)
    });
});