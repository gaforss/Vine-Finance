const mapLegacyDataToSchema = (row) => {
    let date;
    
    // Try different date parsing methods
    if (typeof row.Date === 'string' || row.Date instanceof String) {
        date = new Date(row.Date);
    } else if (typeof row.Date === 'number') {
        date = new Date((row.Date - (25567 + 2)) * 86400 * 1000);
    } else {
        date = new Date(row.Date);
    }
    
    const formattedDate = isNaN(date) ? null : date.toISOString().slice(0, 7);
    
    if (!formattedDate) {
        console.error('Invalid date format:', row.Date);
    }

    return {
        date: formattedDate,
        cash: parseFloat(row['Checking Account'] || 0) + parseFloat(row['Savings Account'] || 0) + parseFloat(row['Money Market Account'] || 0),
        investments: parseFloat(row['Brokerage Account'] || 0) + parseFloat(row['Mutual Funds'] || 0) + parseFloat(row['Stocks'] || 0) + parseFloat(row['Bonds'] || 0) + parseFloat(row['Exchange-Traded Funds (ETFs)'] || 0) + parseFloat(row['Certificates of Deposit (CDs)'] || 0) + parseFloat(row['Treasury Bonds'] || 0),
        realEstate: parseFloat(row['Primary Residence'] || 0) + parseFloat(row['Rental Properties'] || 0) + parseFloat(row['Vacation Home'] || 0) + parseFloat(row['Commercial Real Estate'] || 0),
        retirementAccounts: parseFloat(row['401(k)'] || 0) + parseFloat(row['403(b)'] || 0) + parseFloat(row['Traditional IRA'] || 0) + parseFloat(row['Roth IRA'] || 0) + parseFloat(row['SEP IRA'] || 0) + parseFloat(row['SIMPLE IRA'] || 0) + parseFloat(row['Pension'] || 0) + parseFloat(row['Annuities'] || 0) + parseFloat(row['Thrift Savings Plan (TSP)'] || 0) + parseFloat(row['Rollover IRA'] || 0),
        vehicles: parseFloat(row['Cars'] || 0) + parseFloat(row['Motorcycles'] || 0) + parseFloat(row['Boats'] || 0) + parseFloat(row['Recreational Vehicles (RVs)'] || 0) + parseFloat(row['Airplanes'] || 0),
        personalProperty: parseFloat(row['Jewelry'] || 0) + parseFloat(row['Art'] || 0) + parseFloat(row['Antiques'] || 0) + parseFloat(row['Collectibles'] || 0) + parseFloat(row['Electronics'] || 0) + parseFloat(row['Furniture'] || 0),
        otherAssets: parseFloat(row['Business Ownership'] || 0) + parseFloat(row['Intellectual Property'] || 0) + parseFloat(row['Cryptocurrency'] || 0) + parseFloat(row['Livestock'] || 0) + parseFloat(row['Equipment and Machinery'] || 0),
        liabilities: parseFloat(row['Mortgage'] || 0) + parseFloat(row['Mortgage2'] || 0) + parseFloat(row['Home Equity Line of Credit (HELOC)'] || 0) + parseFloat(row['Car Loans'] || 0) + parseFloat(row['Student Loans'] || 0) + parseFloat(row['Credit Card Debt'] || 0) + parseFloat(row['Personal Loans'] || 0) + parseFloat(row['Medical Debt'] || 0) + parseFloat(row['Business Loans'] || 0),
        customFields: [],
        user: row.user // This should be replaced with the actual user ID from the session
    };
};

module.exports = mapLegacyDataToSchema;