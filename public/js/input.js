// Make exportTableData function globally available
window.exportTableData = function() {
    console.log('Export function called');
    try {
        const table = $('#transactionsTable').DataTable();
        console.log('Got table instance:', table);
        
        // Get all data
        const data = table.rows().data().toArray();
        console.log('Table data:', data);
        
        // Get headers (excluding Actions column)
        const headers = table.columns().header().toArray()
            .slice(0, -1)
            .map(th => th.textContent.trim());
        console.log('Headers:', headers);
        
        // Convert to CSV
        const csvRows = data.map(row => {
            const values = Object.values(row).slice(0, -1);
            return values.map(value => {
                const cleanValue = String(value)
                    .replace(/[$,]/g, '')
                    .replace(/"/g, '""');
                return `"${cleanValue}"`;
            }).join(',');
        });
        
        const csvContent = [
            headers.join(','),
            ...csvRows
        ].join('\n');
        
        console.log('CSV content:', csvContent);
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'net-worth-data.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Export completed');
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting data: ' + error.message);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event triggered');
    let transactionsTable;
    
    // Check if table is already initialized
    if (!$.fn.DataTable.isDataTable('#transactionsTable')) {
        console.log('Initializing DataTable');
        
        // Initialize DataTable with enhanced UI settings
        transactionsTable = $('#transactionsTable').DataTable({
            responsive: true,
            autoWidth: false,
            scrollX: true,
            paging: false,
            lengthChange: false,
            order: [[0, 'desc']],
            dom: '<"row mb-4"<"col-sm-12"f>>' +
                 '<"row"<"col-sm-12"tr>>' +
                 '<"row mt-4"<"col-sm-12"i>>',
            language: {
                search: "",
                searchPlaceholder: "🔍 Search entries...",
                info: "Showing _TOTAL_ entries",
                infoEmpty: "No entries to show",
                infoFiltered: "(filtered from _MAX_ total entries)",
                emptyTable: "No data available in table",
                zeroRecords: "No matching records found"
            },
            columnDefs: [
                {
                    targets: [0], // Timestamp column
                    visible: false
                },
                {
                    targets: [1], // Date column
                    render: function(data, type, row) {
                        if (type === 'display') {
                            const date = new Date(data);
                            return `<div class="d-flex align-items-center">
                                <i class="fa fa-calendar text-muted me-2"></i>
                                ${date.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </div>`;
                        }
                        return data;
                    }
                },
                {
                    targets: [2, 3, 4, 5, 6, 7, 8, 9], // Asset columns
                    render: function(data, type, row) {
                        if (type === 'display') {
                            const value = parseFloat(data);
                            if (value === 0) return '<span class="text-muted">-</span>';
                            
                            const formattedValue = value.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            });

                            // Add trend indicator if value changed from previous row
                            const prevRow = row[0] - 1;
                            let trendHtml = '';
                            
                            if (prevRow >= 0) {
                                const prevValue = parseFloat(transactionsTable.row(prevRow).data()[this.targets[0]]);
                                const change = ((value - prevValue) / prevValue) * 100;
                                
                                if (Math.abs(change) > 0.1) { // Only show if change is significant
                                    const trendClass = change > 0 ? 'text-success' : 'text-danger';
                                    const trendIcon = change > 0 ? '↑' : '↓';
                                    trendHtml = `<small class="${trendClass} ms-1">${trendIcon} ${Math.abs(change).toFixed(1)}%</small>`;
                                }
                            }
                            
                            return `<div class="d-flex align-items-center justify-content-end">
                                <span class="text-nowrap">${formattedValue}</span>
                                ${trendHtml}
                            </div>`;
                        }
                        return data;
                    }
                },
                {
                    targets: [10], // Net Worth column
                    render: function(data, type, row) {
                        if (type === 'display') {
                            const value = parseFloat(data);
                            const formattedValue = value.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            });
                            
                            // Calculate percentage change from previous row
                            const prevRow = row[0] - 1;
                            let changeHtml = '';
                            
                            if (prevRow >= 0) {
                                const prevValue = parseFloat(transactionsTable.row(prevRow).data()[10]);
                                const change = ((value - prevValue) / prevValue) * 100;
                                
                                if (change !== 0) {
                                    const changeClass = change > 0 ? 'text-success' : 'text-danger';
                                    const changeIcon = change > 0 ? '↑' : '↓';
                                    changeHtml = `<div class="d-flex align-items-center">
                                        <span class="${changeClass} ms-2">
                                            ${changeIcon} ${Math.abs(change).toFixed(1)}%
                                        </span>
                                    </div>`;
                                }
                            }
                            
                            return `<div class="d-flex flex-column align-items-end">
                                <span class="fw-bold">${formattedValue}</span>
                                ${changeHtml}
                            </div>`;
                        }
                        return data;
                    }
                },
                {
                    targets: -1, // Actions column
                    orderable: false,
                    searchable: false,
                    render: function(data, type, row) {
                        if (type === 'display') {
                            return `
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-outline-primary" onclick="editRow(${row[0]})" title="Edit Entry">
                                        <i class="fa fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="deleteRow(${row[0]})" title="Delete Entry">
                                        <i class="fa fa-trash"></i>
                                    </button>
                                </div>
                            `;
                        }
                        return data;
                    }
                }
            ],
            initComplete: function() {
                console.log('DataTable initialization complete');
                
                // Add custom styling to search box
                $('.dataTables_filter input')
                    .addClass('form-control')
                    .wrap('<div class="position-relative"></div>')
                    .after('<i class="fa fa-search position-absolute" style="right: 1rem; top: 50%; transform: translateY(-50%); color: #6c757d;"></i>');
                
                // Add custom styling to length select
                $('.dataTables_length select')
                    .addClass('form-select')
                    .wrap('<div class="d-inline-block"></div>');
                
                // Add custom styling to pagination
                $('.dataTables_paginate').addClass('d-flex justify-content-end');
                $('.paginate_button').addClass('btn btn-sm btn-outline-secondary mx-1');
                $('.paginate_button.current').addClass('btn-primary').removeClass('btn-outline-secondary');
                
                // Add custom styling to info
                $('.dataTables_info').addClass('text-muted small');
            }
        });
    } else {
        console.log('DataTable already initialized, getting existing instance');
        transactionsTable = $('#transactionsTable').DataTable();
    }
}); 