/**
 * Admin Dashboard Logic for Sunset Corkboard
 * Handles authentication, analytics, and post management
 */

class AdminDashboard {
    constructor() {
        this.isAuthenticated = false;
        this.currentTab = 'dashboard';
        this.posts = [];
        this.filteredPosts = [];
        this.selectedPosts = new Set();
        this.analyticsData = null;
        
        // Date range for analytics
        this.dateRange = {
            preset: 'today',
            startDate: null,
            endDate: null,
            cumulative: false
        };
        
        // Filters for posts management
        this.filters = {
            search: '',
            main: '',
            sort: 'newest'
        };
        
        // DOM elements
        this.elements = {};
    }

    /**
     * Initialize the admin dashboard
     */
    async initialize() {
        try {
            // Cache DOM elements
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize Supabase client
            await supabaseClient.initialize();
            
            // Show login screen
            this.showLoginScreen();
            
            console.log('Admin dashboard initialized');
        } catch (error) {
            console.error('Failed to initialize admin dashboard:', error);
            this.showError('Failed to initialize dashboard. Please refresh the page.');
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Login elements
            loginScreen: document.getElementById('login-screen'),
            loginForm: document.getElementById('login-form'),
            usernameInput: document.getElementById('username'),
            passwordInput: document.getElementById('password'),
            
            // Dashboard elements
            adminDashboard: document.getElementById('admin-dashboard'),
            logoutBtn: document.getElementById('logout-btn'),
            refreshData: document.getElementById('refresh-data'),
            
            // Navigation
            navButtons: document.querySelectorAll('.nav-btn'),
            
            // Tab contents
            dashboardTab: document.getElementById('dashboard-tab'),
            postsTab: document.getElementById('posts-tab'),
            
            // Stats elements
            totalPosts: document.getElementById('total-posts'),
            uniqueUsers: document.getElementById('unique-users'),
            recentPosts: document.getElementById('recent-posts'),
            
            // Date controls
            datePresetBtns: document.querySelectorAll('.date-preset-btn'),
            startDate: document.getElementById('start-date'),
            endDate: document.getElementById('end-date'),
            applyDateRange: document.getElementById('apply-date-range'),
            cumulativeMode: document.getElementById('cumulative-mode'),
            mainsChartTitle: document.getElementById('mains-chart-title'),
            timelineChartTitle: document.getElementById('timeline-chart-title'),
            
            // Posts management elements
            adminMainFilter: document.getElementById('admin-main-filter'),
            adminSortFilter: document.getElementById('admin-sort-filter'),
            adminSearch: document.getElementById('admin-search'),
            selectAll: document.getElementById('select-all'),
            deleteSelected: document.getElementById('delete-selected'),
            exportPdf: document.getElementById('export-pdf'),
            adminLoading: document.getElementById('admin-loading'),
            adminEmptyState: document.getElementById('admin-empty-state'),
            adminPostsContainer: document.getElementById('admin-posts-container'),
            
            // Modal elements
            adminConfirmModal: document.getElementById('admin-confirm-modal'),
            adminConfirmMessage: document.getElementById('admin-confirm-message'),
            adminConfirmAction: document.getElementById('admin-confirm-action'),
            
            // Toast elements
            adminErrorToast: document.getElementById('admin-error-toast'),
            adminSuccessToast: document.getElementById('admin-success-toast'),
            adminErrorMessage: document.getElementById('admin-error-message'),
            adminSuccessMessage: document.getElementById('admin-success-message')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Login form
        this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Logout and refresh
        this.elements.logoutBtn.addEventListener('click', () => this.logout());
        this.elements.refreshData.addEventListener('click', () => this.refreshData());
        
        // Navigation tabs
        this.elements.navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Date controls
        this.elements.datePresetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleDatePreset(e.target.dataset.preset));
        });
        this.elements.applyDateRange.addEventListener('click', () => this.applyCustomDateRange());
        this.elements.cumulativeMode.addEventListener('change', (e) => this.toggleCumulativeMode(e.target.checked));
        
        // Posts management filters
        this.elements.adminMainFilter.addEventListener('change', (e) => this.handleFilterChange('main', e.target.value));
        this.elements.adminSortFilter.addEventListener('change', (e) => this.handleFilterChange('sort', e.target.value));
        this.elements.adminSearch.addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        // Posts management actions
        this.elements.selectAll.addEventListener('click', () => this.toggleSelectAll());
        this.elements.deleteSelected.addEventListener('click', () => this.confirmDeleteSelected());
        this.elements.exportPdf.addEventListener('click', () => this.exportToPdf());
        
        // Modal close handlers
        this.elements.adminConfirmModal.addEventListener('click', (e) => {
            if (e.target === this.elements.adminConfirmModal) {
                this.closeAdminConfirmModal();
            }
        });
    }

    /**
     * Show login screen
     */
    showLoginScreen() {
        this.elements.loginScreen.classList.remove('hidden');
        this.elements.adminDashboard.classList.add('hidden');
        this.elements.usernameInput.focus();
    }

    /**
     * Handle login form submission
     */
    async handleLogin(e) {
        e.preventDefault();
        
        const username = this.elements.usernameInput.value.trim();
        const password = this.elements.passwordInput.value;
        
        if (!username || !password) {
            this.showError('Please enter both username and password');
            return;
        }

        try {
            // Disable form
            const submitBtn = this.elements.loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            
            // Authenticate with server using environment variables
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.isAuthenticated = true;
                this.showDashboard();
                this.showSuccess('Login successful');
            } else {
                this.showError('Invalid username or password');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
        } finally {
            // Re-enable form
            const submitBtn = this.elements.loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        }
    }

    /**
     * Show admin dashboard
     */
    async showDashboard() {
        this.elements.loginScreen.classList.add('hidden');
        this.elements.adminDashboard.classList.remove('hidden');
        
        // Switch to dashboard tab
        this.switchTab('dashboard');
        
        // Initialize charts if available
        if (typeof chartsManager !== 'undefined') {
            await chartsManager.initializeCharts();
        }
        
        // Load dashboard analytics
        await this.loadDashboardAnalytics();
        
        // Load posts data
        await this.loadPostsData();
    }

    /**
     * Logout admin
     */
    logout() {
        this.isAuthenticated = false;
        this.currentTab = 'dashboard';
        this.posts = [];
        this.filteredPosts = [];
        this.selectedPosts.clear();
        this.analyticsData = null;
        
        // Reset date range
        this.dateRange = {
            preset: 'today',
            startDate: null,
            endDate: null,
            cumulative: false
        };
        
        // Reset forms
        this.elements.loginForm.reset();
        
        // Destroy charts
        if (typeof chartsManager !== 'undefined') {
            chartsManager.destroyCharts();
        }
        
        // Show login screen
        this.showLoginScreen();
        
        this.showSuccess('Logged out successfully');
    }

    /**
     * Switch between dashboard tabs
     */
    switchTab(tabName) {
        // Update navigation
        this.elements.navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        this.elements.dashboardTab.classList.toggle('active', tabName === 'dashboard');
        this.elements.postsTab.classList.toggle('active', tabName === 'posts');
        
        this.currentTab = tabName;
        
        // Load tab-specific data
        if (tabName === 'posts') {
            this.loadPostsData();
        } else if (tabName === 'dashboard') {
            this.loadDashboardAnalytics();
        }
    }

    /**
     * Load posts management data
     */
    async loadPostsData() {
        try {
            this.showAdminLoading();
            // Use the existing supabase client to get all pins
            this.posts = await supabaseClient.getPins({});
            this.applyPostsFilters();
            this.renderPosts();
        } catch (error) {
            console.error('Error loading posts data:', error);
            this.showError('Failed to load posts data');
        } finally {
            this.hideAdminLoading();
        }
    }

    /**
     * Apply filters to posts
     */
    applyPostsFilters() {
        this.filteredPosts = this.posts.filter(post => {
            // Search filter
            if (this.filters.search) {
                const searchLower = this.filters.search.toLowerCase();
                const matchesSearch = 
                    post.nickname.toLowerCase().includes(searchLower) ||
                    post.message.toLowerCase().includes(searchLower) ||
                    (post.rp_name && post.rp_name.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }
            
            // Main filter
            if (this.filters.main && post.main !== this.filters.main) {
                return false;
            }
            
            return true;
        });
        
        // Apply sorting
        this.filteredPosts.sort((a, b) => {
            switch (this.filters.sort) {
                case 'newest':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'a-z':
                    return a.nickname.localeCompare(b.nickname);
                case 'z-a':
                    return b.nickname.localeCompare(a.nickname);
                default:
                    return new Date(b.created_at) - new Date(a.created_at);
            }
        });
    }

    /**
     * Render posts in admin interface
     */
    renderPosts() {
        if (this.filteredPosts.length === 0) {
            this.elements.adminPostsContainer.classList.add('hidden');
            this.elements.adminEmptyState.classList.remove('hidden');
            return;
        }
        
        this.elements.adminEmptyState.classList.add('hidden');
        this.elements.adminPostsContainer.classList.remove('hidden');
        
        this.elements.adminPostsContainer.innerHTML = this.filteredPosts
            .map(post => this.createAdminPostHTML(post))
            .join('');
        
        this.updateSelectedPostsButtons();
    }

    /**
     * Create HTML for admin post item
     */
    createAdminPostHTML(post) {
        const createdAt = new Date(post.created_at);
        const timeAgo = this.getTimeAgo(createdAt);
        const isSelected = this.selectedPosts.has(post.id);
        
        return `
            <div class="admin-post-item" data-post-id="${post.id}">
                <input type="checkbox" class="post-checkbox" ${isSelected ? 'checked' : ''} 
                       onchange="adminApp.togglePostSelection('${post.id}')">
                <div class="post-details">
                    <div class="post-meta">
                        <span class="post-nickname">${this.escapeHtml(post.nickname)}</span>
                        ${post.rp_name ? `<span class="post-rp-name">(${this.escapeHtml(post.rp_name)})</span>` : ''}
                        <span class="post-main">${this.getMainDisplayName(post.main)}</span>
                        <span class="post-timestamp">${timeAgo}</span>
                    </div>
                    <div class="post-message">${this.escapeHtml(post.message)}</div>
                </div>
                <div class="post-actions">
                    <button class="post-action-btn delete" onclick="adminApp.confirmDeletePost('${post.id}')" title="Delete post">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get display name for main
     */
    getMainDisplayName(main) {
        const mainNames = {
            '1': 'Main 1',
            '2': 'Main 2',
            '3': 'Main 3',
            '4': 'Main 4',
            'council': 'Council'
        };
        return mainNames[main] || main;
    }

    /**
     * Update selected posts buttons state
     */
    updateSelectedPostsButtons() {
        const selectedCount = this.selectedPosts.size;
        const totalCount = this.filteredPosts.length;
        
        // Update select all button text
        if (this.elements.selectAll) {
            if (selectedCount === 0) {
                this.elements.selectAll.innerHTML = '<i class="fas fa-check-square"></i> Select All';
            } else if (selectedCount === totalCount) {
                this.elements.selectAll.innerHTML = '<i class="fas fa-square"></i> Deselect All';
            } else {
                this.elements.selectAll.innerHTML = `<i class="fas fa-check-square"></i> Select All (${selectedCount}/${totalCount})`;
            }
        }
        
        // Update delete selected button
        if (this.elements.deleteSelected) {
            this.elements.deleteSelected.disabled = selectedCount === 0;
            this.elements.deleteSelected.innerHTML = selectedCount > 0 
                ? `<i class="fas fa-trash"></i> Delete Selected (${selectedCount})` 
                : '<i class="fas fa-trash"></i> Delete Selected';
        }
    }

    /**
     * Toggle post selection
     */
    togglePostSelection(postId) {
        if (this.selectedPosts.has(postId)) {
            this.selectedPosts.delete(postId);
        } else {
            this.selectedPosts.add(postId);
        }
        this.updateSelectedPostsButtons();
    }

    /**
     * Toggle select all posts
     */
    toggleSelectAll() {
        const allSelected = this.selectedPosts.size === this.filteredPosts.length;
        
        if (allSelected) {
            // Deselect all
            this.selectedPosts.clear();
        } else {
            // Select all
            this.filteredPosts.forEach(post => {
                this.selectedPosts.add(post.id);
            });
        }
        
        this.renderPosts();
    }

    /**
     * Confirm delete selected posts
     */
    confirmDeleteSelected() {
        if (this.selectedPosts.size === 0) {
            this.showError('No posts selected');
            return;
        }
        
        const count = this.selectedPosts.size;
        this.elements.adminConfirmMessage.textContent = 
            `Are you sure you want to delete ${count} selected post${count > 1 ? 's' : ''}?`;
        
        this.elements.adminConfirmAction.onclick = () => this.deleteSelectedPosts();
        this.elements.adminConfirmModal.classList.remove('hidden');
    }

    /**
     * Delete selected posts
     */
    async deleteSelectedPosts() {
        try {
            this.closeAdminConfirmModal();
            
            const postsToDelete = Array.from(this.selectedPosts);
            const count = postsToDelete.length;
            
            // Show loading state
            this.elements.deleteSelected.disabled = true;
            this.elements.deleteSelected.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            
            // Use bulk delete for multiple posts
            await supabaseClient.deletePins(postsToDelete);
            
            // Clear selection
            this.selectedPosts.clear();
            
            // Reload posts
            await this.loadPostsData();
            
            this.showSuccess(`${count} post${count > 1 ? 's' : ''} deleted successfully`);
            
        } catch (error) {
            console.error('Error deleting posts:', error);
            this.showError('Failed to delete some posts. Please try again.');
        } finally {
            // Reset button
            this.elements.deleteSelected.disabled = false;
            this.elements.deleteSelected.innerHTML = '<i class="fas fa-trash"></i> Delete Selected';
        }
    }

    /**
     * Confirm delete single post
     */
    confirmDeletePost(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            this.showError('Post not found');
            return;
        }
        
        this.elements.adminConfirmMessage.textContent = 
            `Are you sure you want to delete the post by "${post.nickname}"?`;
        
        this.elements.adminConfirmAction.onclick = () => this.deleteSinglePost(postId);
        this.elements.adminConfirmModal.classList.remove('hidden');
    }

    /**
     * Delete single post
     */
    async deleteSinglePost(postId) {
        try {
            this.closeAdminConfirmModal();
            await supabaseClient.adminDeletePin(postId);
            await this.loadPostsData();
            this.showSuccess('Post deleted successfully');
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showError('Failed to delete post. Please try again.');
        }
    }

    /**
     * Handle filter changes
     */
    handleFilterChange(filterType, value) {
        this.filters[filterType] = value;
        this.applyPostsFilters();
        this.renderPosts();
    }

    /**
     * Handle search input with debounce
     */
    handleSearch(value) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.filters.search = value;
            this.applyPostsFilters();
            this.renderPosts();
        }, 300);
    }

    /**
     * Export to PDF (placeholder)
     */
    exportToPdf() {
        this.showError('PDF export functionality not implemented yet');
    }

    /**
     * Close admin confirmation modal
     */
    closeAdminConfirmModal() {
        this.elements.adminConfirmModal.classList.add('hidden');
    }

    /**
     * Show admin loading state
     */
    showAdminLoading() {
        if (this.elements.adminLoading) this.elements.adminLoading.classList.remove('hidden');
        if (this.elements.adminPostsContainer) this.elements.adminPostsContainer.classList.add('hidden');
        if (this.elements.adminEmptyState) this.elements.adminEmptyState.classList.add('hidden');
    }

    /**
     * Hide admin loading state
     */
    hideAdminLoading() {
        if (this.elements.adminLoading) this.elements.adminLoading.classList.add('hidden');
    }

    /**
     * Get relative time string
     */
    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) {
            return 'Just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show error message
     */
    showError(message) {
        this.elements.adminErrorMessage.textContent = message;
        this.elements.adminErrorToast.classList.remove('hidden');
        
        setTimeout(() => {
            this.hideAdminToast('admin-error-toast');
        }, 5000);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.elements.adminSuccessMessage.textContent = message;
        this.elements.adminSuccessToast.classList.remove('hidden');
        
        setTimeout(() => {
            this.hideAdminToast('admin-success-toast');
        }, 3000);
    }

    /**
     * Hide admin toast
     */
    hideAdminToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.add('hidden');
        }
    }

    /**
     * Refresh dashboard data
     */
    async refreshData() {
        try {
            await this.loadDashboardAnalytics();
            await this.loadPostsData();
            this.showSuccess('Dashboard data refreshed');
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showError('Failed to refresh dashboard data');
        }
    }

    /**
     * Load dashboard analytics data
     */
    async loadDashboardAnalytics() {
        try {
            const { startDate, endDate } = this.getDateRangeForPreset(this.dateRange.preset);
            
            // Get all posts for analytics
            const allPosts = await supabaseClient.getPins({});
            
            // Filter posts by date range
            const filteredPosts = this.filterPostsByDateRange(allPosts, startDate, endDate);
            
            // Calculate analytics
            this.analyticsData = this.calculateAnalytics(filteredPosts, startDate, endDate);
            
            // Update dashboard stats
            this.updateDashboardStats();
            
            // Update charts if available
            if (typeof chartsManager !== 'undefined' && chartsManager.areChartsInitialized()) {
                chartsManager.updateCharts(this.analyticsData, this.dateRange);
            }
            
            // Update chart titles
            this.updateChartTitles();
            
        } catch (error) {
            console.error('Error loading analytics:', error);
            throw error;
        }
    }

    /**
     * Get date range for preset
     */
    getDateRangeForPreset(preset) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (preset) {
            case 'today':
                return {
                    startDate: today,
                    endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
                };
            case 'yesterday':
                const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                return {
                    startDate: yesterday,
                    endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
                };
            case 'this-week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                return {
                    startDate: weekStart,
                    endDate: now
                };
            case 'this-month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                return {
                    startDate: monthStart,
                    endDate: now
                };
            case 'all-time':
            default:
                return {
                    startDate: new Date('2020-01-01'),
                    endDate: now
                };
        }
    }

    /**
     * Filter posts by date range
     */
    filterPostsByDateRange(posts, startDate, endDate) {
        return posts.filter(post => {
            const postDate = new Date(post.created_at);
            return postDate >= startDate && postDate <= endDate;
        });
    }

    /**
     * Calculate analytics from filtered posts
     */
    calculateAnalytics(posts, startDate, endDate) {
        const analytics = {
            totalPosts: posts.length,
            uniqueUsers: new Set(posts.map(p => p.nickname)).size,
            recentPosts: posts.slice(-5).reverse(),
            mainCounts: {
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
                'council': 0
            },
            hourlyData: Array(24).fill(0),
            dailyData: {}
        };

        // Count posts by main
        posts.forEach(post => {
            const main = post.main?.toString() || 'council';
            if (analytics.mainCounts.hasOwnProperty(main)) {
                analytics.mainCounts[main]++;
            }
        });

        // Count posts by hour
        posts.forEach(post => {
            const hour = new Date(post.created_at).getHours();
            analytics.hourlyData[hour]++;
        });

        // Count posts by day for cumulative view
        posts.forEach(post => {
            const date = new Date(post.created_at).toISOString().split('T')[0];
            analytics.dailyData[date] = (analytics.dailyData[date] || 0) + 1;
        });

        // Convert daily data to cumulative if needed
        if (this.dateRange.cumulative) {
            let cumulative = 0;
            const sortedDates = Object.keys(analytics.dailyData).sort();
            analytics.hourlyData = sortedDates.map(date => {
                cumulative += analytics.dailyData[date];
                return cumulative;
            });
        }

        return analytics;
    }

    /**
     * Update dashboard stats display
     */
    updateDashboardStats() {
        if (!this.analyticsData) return;

        // Update stat cards
        if (this.elements.totalPosts) {
            this.elements.totalPosts.textContent = this.analyticsData.totalPosts.toLocaleString();
        }
        
        if (this.elements.uniqueUsers) {
            this.elements.uniqueUsers.textContent = this.analyticsData.uniqueUsers.toLocaleString();
        }
        
        if (this.elements.recentPosts) {
            this.elements.recentPosts.textContent = this.analyticsData.recentPosts.length.toLocaleString();
        }
    }

    /**
     * Update chart titles based on current date range
     */
    updateChartTitles() {
        const presetNames = {
            'today': 'Today',
            'yesterday': 'Yesterday',
            'this-week': 'This Week',
            'this-month': 'This Month',
            'all-time': 'All Time'
        };

        const currentPreset = presetNames[this.dateRange.preset] || 'Custom Range';
        const modeText = this.dateRange.cumulative ? ' (Cumulative)' : '';

        if (this.elements.mainsChartTitle) {
            this.elements.mainsChartTitle.textContent = `Posts by Main - ${currentPreset}`;
        }

        if (this.elements.timelineChartTitle) {
            const timelineTitle = this.dateRange.cumulative ? 
                `Posts Timeline - ${currentPreset}${modeText}` : 
                `Posts by Hour - ${currentPreset}`;
            this.elements.timelineChartTitle.textContent = timelineTitle;
        }
    }

    /**
     * Handle date preset button clicks
     */
    async handleDatePreset(preset) {
        // Update active button
        this.elements.datePresetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === preset);
        });

        // Update date range
        this.dateRange.preset = preset;
        
        // Clear custom dates when using presets
        this.elements.startDate.value = '';
        this.elements.endDate.value = '';

        // Reload analytics
        await this.loadDashboardAnalytics();
    }

    /**
     * Apply custom date range
     */
    async applyCustomDateRange() {
        const startDate = this.elements.startDate.value;
        const endDate = this.elements.endDate.value;

        if (!startDate || !endDate) {
            this.showError('Please select both start and end dates');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.showError('Start date must be before end date');
            return;
        }

        // Clear preset selection
        this.elements.datePresetBtns.forEach(btn => {
            btn.classList.remove('active');
        });

        // Update date range
        this.dateRange.preset = 'custom';
        this.dateRange.startDate = new Date(startDate);
        this.dateRange.endDate = new Date(endDate + 'T23:59:59');

        // Reload analytics
        await this.loadDashboardAnalytics();
    }

    /**
     * Toggle cumulative mode
     */
    async toggleCumulativeMode(enabled) {
        this.dateRange.cumulative = enabled;
        
        // Reload analytics to update charts
        await this.loadDashboardAnalytics();
    }
}

// Global functions for onclick handlers
function closeAdminConfirmModal() {
    adminApp.closeAdminConfirmModal();
}

function hideAdminToast(toastId) {
    adminApp.hideAdminToast(toastId);
}

// Initialize admin app when DOM is loaded
let adminApp;
document.addEventListener('DOMContentLoaded', async () => {
    adminApp = new AdminDashboard();
    await adminApp.initialize();
});
