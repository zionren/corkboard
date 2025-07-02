/**
 * Charts Configuration and Management for Admin Dashboard
 * Handles Chart.js initialization and data visualization
 */

class ChartsManager {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#6c5ce7',
            secondary: '#74b9ff',
            success: '#00b894',
            warning: '#fdcb6e',
            danger: '#e17055',
            info: '#0984e3',
            sunset: ['#ff7b54', '#ff9a8b', '#6c5ce7', '#74b9ff', '#fdcb6e']
        };
    }

    /**
     * Initialize all charts
     */
    async initializeCharts() {
        try {
            // Wait for Chart.js to be available
            if (typeof Chart === 'undefined') {
                throw new Error('Chart.js not loaded');
            }

            // Configure Chart.js defaults
            this.configureChartDefaults();

            // Initialize individual charts
            this.initializeMainsChart();
            this.initializeTimelineChart();

        } catch (error) {
            console.error('Error initializing charts:', error);
        }
    }

    /**
     * Configure Chart.js default settings
     */
    configureChartDefaults() {
        Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.color = '#636e72';
        Chart.defaults.plugins.legend.display = true;
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(45, 52, 54, 0.9)';
        Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
        Chart.defaults.plugins.tooltip.bodyColor = '#ffffff';
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.elements.arc.borderWidth = 0;
        Chart.defaults.elements.bar.borderRadius = 4;
        Chart.defaults.elements.line.tension = 0.4;
    }

    /**
     * Initialize the mains distribution pie chart
     */
    initializeMainsChart() {
        const ctx = document.getElementById('mains-chart');
        if (!ctx) return;

        this.charts.mains = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Main 1', 'Main 2', 'Main 3', 'Main 4', 'Council'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: this.colors.sunset,
                    hoverBackgroundColor: this.colors.sunset.map(color => this.lightenColor(color, 20)),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} posts (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '50%',
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }

    /**
     * Initialize the timeline bar chart (horizontal)
     */
    initializeTimelineChart() {
        const ctx = document.getElementById('timeline-chart');
        if (!ctx) return;

        // Generate hour labels
        const hourLabels = Array.from({length: 24}, (_, i) => {
            const hour = i.toString().padStart(2, '0');
            return `${hour}:00`;
        });

        this.charts.timeline = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    label: 'Posts',
                    data: Array(24).fill(0),
                    backgroundColor: 'rgba(108, 92, 231, 0.8)',
                    borderColor: 'rgba(108, 92, 231, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                    barThickness: 12,
                    maxBarThickness: 15,
                    categoryPercentage: 0.6,
                    barPercentage: 0.7
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(108, 92, 231, 0.1)',
                            borderColor: 'rgba(108, 92, 231, 0.2)'
                        },
                        ticks: {
                            color: '#636e72',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#636e72',
                            font: {
                                size: 11
                            }
                        },
                        barThickness: 12,
                        maxBarThickness: 15
                    }
                },
                elements: {
                    bar: {
                        borderRadius: 4
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return `Hour: ${context[0].label}`;
                            },
                            label: function(context) {
                                const value = context.parsed.x;
                                return `${value} post${value !== 1 ? 's' : ''}`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    /**
     * Update charts with new data
     */
    updateCharts(analyticsData, dateRange = {}) {
        if (!analyticsData) return;

        this.updateMainsChart(analyticsData.mainCounts);
        this.updateTimelineChart(analyticsData, dateRange);
    }

    /**
     * Update the mains distribution chart
     */
    updateMainsChart(mainCounts) {
        if (!this.charts.mains || !mainCounts) return;

        const data = [
            mainCounts['1'] || 0,
            mainCounts['2'] || 0,
            mainCounts['3'] || 0,
            mainCounts['4'] || 0,
            mainCounts['council'] || 0
        ];

        this.charts.mains.data.datasets[0].data = data;
        this.charts.mains.update('active');
    }

    /**
     * Update the timeline chart
     */
    updateTimelineChart(analyticsData, dateRange = {}) {
        if (!this.charts.timeline || !analyticsData) return;

        let labels, data, label;
        
        // Check if we should show daily cumulative data
        if (dateRange.cumulative && analyticsData.dailyData) {
            // Daily cumulative data
            const sortedDates = Object.keys(analyticsData.dailyData).sort();
            labels = sortedDates.map(date => {
                const d = new Date(date);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            data = analyticsData.hourlyData; // This contains cumulative values
            label = 'Cumulative Posts';
            
            // Change chart to horizontal bar for better date display
            this.charts.timeline.config.options.indexAxis = 'y';
        } else {
            // Hourly data (default)
            labels = Array.from({length: 24}, (_, i) => {
                const hour = i.toString().padStart(2, '0');
                return `${hour}:00`;
            });
            data = analyticsData.hourlyData || Array(24).fill(0);
            label = 'Posts';
            
            // Set chart to horizontal bar
            this.charts.timeline.config.options.indexAxis = 'y';
        }
        
        this.charts.timeline.data.labels = labels;
        this.charts.timeline.data.datasets[0].data = data;
        this.charts.timeline.data.datasets[0].label = label;
        
        // Update chart styling based on mode
        if (dateRange.cumulative && analyticsData.dailyData) {
            this.charts.timeline.data.datasets[0].backgroundColor = 'rgba(116, 185, 255, 0.8)';
            this.charts.timeline.data.datasets[0].borderColor = 'rgba(116, 185, 255, 1)';
        } else {
            this.charts.timeline.data.datasets[0].backgroundColor = 'rgba(108, 92, 231, 0.8)';
            this.charts.timeline.data.datasets[0].borderColor = 'rgba(108, 92, 231, 1)';
        }
        
        this.charts.timeline.update('active');
    }

    /**
     * Refresh all charts
     */
    refreshCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }

    /**
     * Destroy all charts
     */
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }

    /**
     * Lighten a hex color by a percentage
     */
    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const B = (num >> 8 & 0x00FF) + amt;
        const G = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
                      (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + 
                      (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
    }

    /**
     * Get chart instance by name
     */
    getChart(name) {
        return this.charts[name];
    }

    /**
     * Check if charts are initialized
     */
    areChartsInitialized() {
        return Object.keys(this.charts).length > 0;
    }

    /**
     * Export chart as image
     */
    exportChart(chartName, filename) {
        const chart = this.charts[chartName];
        if (!chart) return;

        const url = chart.toBase64Image();
        const link = document.createElement('a');
        link.download = filename || `${chartName}-chart.png`;
        link.href = url;
        link.click();
    }

    /**
     * Animate chart entrance
     */
    animateChartEntrance(chartName) {
        const chart = this.charts[chartName];
        if (!chart) return;

        chart.update('active');
    }

    /**
     * Set chart theme (for potential dark mode)
     */
    setChartTheme(theme = 'light') {
        const isDark = theme === 'dark';
        const textColor = isDark ? '#ffffff' : '#636e72';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(108, 92, 231, 0.1)';

        Object.values(this.charts).forEach(chart => {
            if (chart && chart.options) {
                // Update text colors
                if (chart.options.plugins && chart.options.plugins.legend) {
                    chart.options.plugins.legend.labels.color = textColor;
                }
                
                // Update scale colors
                if (chart.options.scales) {
                    Object.values(chart.options.scales).forEach(scale => {
                        if (scale.ticks) scale.ticks.color = textColor;
                        if (scale.grid) scale.grid.color = gridColor;
                    });
                }
                
                chart.update();
            }
        });
    }
}

// Create global instance
const chartsManager = new ChartsManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartsManager;
}
