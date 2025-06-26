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
        
        // Logout
        this.elements.logoutBtn.addEventListener('click', () => this.logout());
        
        // Refresh data
        this.elements.refreshData.addEventListener('click', () => this.refreshData());
        
        // Navigation tabs
        this.elements.navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
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
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
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
            
            // Authenticate with server
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
        
        // Initialize charts
        await chartsManager.initializeCharts();
        
        // Load initial data
        await this.loadDashboardData();
        
        // Switch to dashboard tab
        this.switchTab('dashboard');
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
        
        // Reset forms
        this.elements.loginForm.reset();
        
        // Destroy charts
        chartsManager.destroyCharts();
        
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
            this.loadDashboardData();
        }
    }

    /**
     * Load dashboard analytics data
     */
    async loadDashboardData() {
        try {
            this.analyticsData = await supabaseClient.getAnalytics();
            this.updateDashboardStats();
            chartsManager.updateCharts(this.analyticsData);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    /**
     * Update dashboard statistics
     */
    updateDashboardStats() {
        if (!this.analyticsData) return;
        
        this.elements.totalPosts.textContent = this.analyticsData.totalPosts;
        this.elements.uniqueUsers.textContent = this.analyticsData.uniqueUsers;
        this.elements.recentPosts.textContent = this.analyticsData.recentPosts;
    }

    /**
     * Load posts management data
     */
    async loadPostsData() {
        try {
            this.showAdminLoading();
            this.posts = await supabaseClient.getAllPinsForAdmin(this.filters);
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
     * Handle filter changes
     */
    handleFilterChange(filterType, value) {
        this.filters[filterType] = value;
        this.applyPostsFilters();
        this.renderPosts();
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
        if (this.selectedPosts.size === this.filteredPosts.length) {
            // Deselect all
            this.selectedPosts.clear();
        } else {
            // Select all
            this.filteredPosts.forEach(post => this.selectedPosts.add(post.id));
        }
        this.renderPosts();
    }

    /**
     * Update selected posts buttons
     */
    updateSelectedPostsButtons() {
        const selectedCount = this.selectedPosts.size;
        this.elements.deleteSelected.disabled = selectedCount === 0;
        this.elements.selectAll.textContent = selectedCount === this.filteredPosts.length ? 'Deselect All' : 'Select All';
    }

    /**
     * Confirm deletion of selected posts
     */
    confirmDeleteSelected() {
        if (this.selectedPosts.size === 0) return;
        
        const count = this.selectedPosts.size;
        this.elements.adminConfirmMessage.textContent = 
            `Are you sure you want to delete ${count} selected post${count > 1 ? 's' : ''}?`;
        this.elements.adminConfirmAction.onclick = () => this.deleteSelectedPosts();
        this.elements.adminConfirmModal.classList.remove('hidden');
    }

    /**
     * Confirm deletion of single post
     */
    confirmDeletePost(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;
        
        this.elements.adminConfirmMessage.textContent = 
            `Are you sure you want to delete the post by "${post.nickname}"?`;
        this.elements.adminConfirmAction.onclick = () => this.deletePost(postId);
        this.elements.adminConfirmModal.classList.remove('hidden');
    }

    /**
     * Delete selected posts
     */
    async deleteSelectedPosts() {
        try {
            const postIds = Array.from(this.selectedPosts);
            await supabaseClient.deletePins(postIds);
            
            this.selectedPosts.clear();
            this.showSuccess(`${postIds.length} post${postIds.length > 1 ? 's' : ''} deleted successfully`);
            this.closeAdminConfirmModal();
            await this.loadPostsData();
        } catch (error) {
            console.error('Error deleting posts:', error);
            this.showError('Failed to delete posts. Please try again.');
        }
    }

    /**
     * Delete single post
     */
    async deletePost(postId) {
        try {
            await supabaseClient.deletePins([postId]);
            this.selectedPosts.delete(postId);
            this.showSuccess('Post deleted successfully');
            this.closeAdminConfirmModal();
            await this.loadPostsData();
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showError('Failed to delete post. Please try again.');
        }
    }

    /**
     * Export posts to PDF
     */
    async exportToPdf() {
        try {
            // Check if jsPDF is available
            if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
                throw new Error('jsPDF library not loaded');
            }
            
            // Get jsPDF constructor
            const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
            if (!jsPDF) {
                throw new Error('jsPDF constructor not found');
            }
            
            const doc = new jsPDF();
            
            // Set up document header
            doc.setFontSize(18);
            doc.text('Gazelvouer Academy Posts Report', 20, 20);
            
            doc.setFontSize(11);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
            doc.text(`Total Posts: ${this.filteredPosts.length}`, 20, 38);
            
            // Add separator line
            doc.line(20, 42, 190, 42);
            
            // Initialize position
            let yPosition = 55;
            const pageHeight = doc.internal.pageSize.height;
            const marginBottom = 30;
            const lineHeight = 5;
            
            // Process each post
            for (let i = 0; i < this.filteredPosts.length; i++) {
                const post = this.filteredPosts[i];
                
                // Check if we need a new page
                if (yPosition > pageHeight - marginBottom - 40) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                // Post number and nickname
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                const title = `${i + 1}. ${this.escapeHtml(post.nickname)}`;
                doc.text(title, 20, yPosition);
                yPosition += 8;
                
                // Post metadata
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                const metaParts = [];
                if (post.rp_name) metaParts.push(`RP: ${this.escapeHtml(post.rp_name)}`);
                metaParts.push(`Main: ${this.getMainDisplayName(post.main)}`);
                metaParts.push(`Date: ${new Date(post.created_at).toLocaleDateString()}`);
                
                doc.text(metaParts.join(' | '), 20, yPosition);
                yPosition += 8;
                
                // Post message
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const message = this.escapeHtml(post.message);
                const splitMessage = doc.splitTextToSize(message, 170);
                
                doc.text(splitMessage, 20, yPosition);
                yPosition += (splitMessage.length * lineHeight) + 8;
                
                // Add separator for next post
                if (i < this.filteredPosts.length - 1) {
                    doc.line(20, yPosition, 190, yPosition);
                    yPosition += 8;
                }
            }
            
            // Save the PDF
            const filename = `gazelvouer-academy-posts-${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(filename);
            this.showSuccess('PDF exported successfully');
            
        } catch (error) {
            console.error('Error exporting PDF:', error);
            let errorMessage = 'Failed to export PDF. ';
            
            if (error.message.includes('jsPDF')) {
                errorMessage += 'PDF library not loaded properly.';
            } else {
                errorMessage += 'Please try again.';
            }
            
            this.showError(errorMessage);
        }
    }

    /**
     * Refresh all data
     */
    async refreshData() {
        try {
            if (this.currentTab === 'dashboard') {
                await this.loadDashboardData();
            } else if (this.currentTab === 'posts') {
                await this.loadPostsData();
            }
            this.showSuccess('Data refreshed successfully');
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showError('Failed to refresh data');
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        if (!this.isAuthenticated) return;
        
        // ESC to close modals
        if (e.key === 'Escape') {
            if (!this.elements.adminConfirmModal.classList.contains('hidden')) {
                this.closeAdminConfirmModal();
            }
        }
        
        // Tab switching
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    this.switchTab('dashboard');
                    break;
                case '2':
                    e.preventDefault();
                    this.switchTab('posts');
                    break;
                case 'r':
                    e.preventDefault();
                    this.refreshData();
                    break;
            }
        }
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
        this.elements.adminLoading.classList.remove('hidden');
        this.elements.adminPostsContainer.classList.add('hidden');
        this.elements.adminEmptyState.classList.add('hidden');
    }

    /**
     * Hide admin loading state
     */
    hideAdminLoading() {
        this.elements.adminLoading.classList.add('hidden');
    }

    /**
     * Utility methods
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
