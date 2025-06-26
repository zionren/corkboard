/**
 * Main Application Logic for Sunset Corkboard
 * Handles UI interactions, pin management, and real-time updates
 */

class CorkboardApp {
    constructor() {
        this.currentUser = this.initializeUser();
        this.pins = [];
        this.filteredPins = [];
        this.editingPin = null;
        this.searchTimeout = null;
        
        // DOM elements
        this.elements = {};
        
        // Filters
        this.filters = {
            search: '',
            main: '',
            sort: 'newest'
        };
    }

    /**
     * Initialize or get user ID from localStorage
     */
    initializeUser() {
        let userId = localStorage.getItem('corkboard_user_id');
        if (!userId) {
            userId = this.generateUUID();
            localStorage.setItem('corkboard_user_id', userId);
        }
        return userId;
    }

    /**
     * Generate a simple UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Cache DOM elements first
            this.cacheElements();
            
            // Show loading state
            this.showLoading();
            
            // Initialize Supabase client
            await supabaseClient.initialize();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadPins();
            
            // Set up real-time updates
            this.setupRealtimeListeners();
            
            console.log('Corkboard app initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Main UI elements
            loading: document.getElementById('loading'),
            emptyState: document.getElementById('empty-state'),
            pinsGrid: document.getElementById('pins-grid'),
            
            // Header elements
            addPinBtn: document.getElementById('add-pin-btn'),
            searchToggle: document.getElementById('search-toggle'),
            searchContainer: document.getElementById('search-container'),
            searchInput: document.getElementById('search-input'),
            clearSearch: document.getElementById('clear-search'),
            mainFilter: document.getElementById('main-filter'),
            sortFilter: document.getElementById('sort-filter'),
            
            // Modal elements
            pinModal: document.getElementById('pin-modal'),
            modalTitle: document.getElementById('modal-title'),
            pinForm: document.getElementById('pin-form'),
            rpNameInput: document.getElementById('rp-name'),
            nicknameInput: document.getElementById('nickname'),
            mainInput: document.getElementById('main'),
            messageInput: document.getElementById('message'),
            submitText: document.getElementById('submit-text'),
            
            // Confirmation modal
            confirmModal: document.getElementById('confirm-modal'),
            confirmMessage: document.getElementById('confirm-message'),
            confirmAction: document.getElementById('confirm-action'),
            
            // Toast elements
            errorToast: document.getElementById('error-toast'),
            successToast: document.getElementById('success-toast'),
            errorMessage: document.getElementById('error-message'),
            successMessage: document.getElementById('success-message')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Header actions
        this.elements.addPinBtn.addEventListener('click', () => this.openAddPinModal());
        this.elements.searchToggle.addEventListener('click', () => this.toggleSearch());
        
        // Search and filters
        this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.elements.clearSearch.addEventListener('click', () => this.clearSearch());
        this.elements.mainFilter.addEventListener('change', (e) => this.handleFilterChange('main', e.target.value));
        this.elements.sortFilter.addEventListener('change', (e) => this.handleFilterChange('sort', e.target.value));
        
        // Modal and form
        this.elements.pinForm.addEventListener('submit', (e) => this.handlePinSubmit(e));
        
        // Close modals on outside click
        this.elements.pinModal.addEventListener('click', (e) => {
            if (e.target === this.elements.pinModal) {
                this.closePinModal();
            }
        });
        
        this.elements.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmModal) {
                this.closeConfirmModal();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    /**
     * Set up real-time listeners
     */
    setupRealtimeListeners() {
        document.addEventListener('supabase-update', (e) => {
            const { type, new: newRecord, old: oldRecord } = e.detail;
            
            switch (type) {
                case 'INSERT':
                    this.handlePinInserted(newRecord);
                    break;
                case 'UPDATE':
                    this.handlePinUpdated(newRecord);
                    break;
                case 'DELETE':
                    this.handlePinDeleted(oldRecord);
                    break;
            }
        });
    }

    /**
     * Handle real-time pin insertion
     */
    handlePinInserted(pin) {
        // Add to pins array
        this.pins.unshift(pin);
        
        // Re-apply filters and render
        this.applyFilters();
        this.renderPins();
        
        // Show notification if it's not from current user
        if (pin.author_id !== this.currentUser) {
            this.showSuccess(`New pin added by ${pin.nickname}`);
        }
    }

    /**
     * Handle real-time pin update
     */
    handlePinUpdated(pin) {
        // Update in pins array
        const index = this.pins.findIndex(p => p.id === pin.id);
        if (index !== -1) {
            this.pins[index] = pin;
            
            // Re-apply filters and render
            this.applyFilters();
            this.renderPins();
        }
    }

    /**
     * Handle real-time pin deletion
     */
    handlePinDeleted(pin) {
        // Remove from pins array
        this.pins = this.pins.filter(p => p.id !== pin.id);
        
        // Re-apply filters and render
        this.applyFilters();
        this.renderPins();
    }

    /**
     * Load pins from database
     */
    async loadPins() {
        try {
            this.pins = await supabaseClient.getPins(this.filters);
            this.applyFilters();
            this.renderPins();
        } catch (error) {
            console.error('Error loading pins:', error);
            this.showError('Failed to load pins. Please try refreshing the page.');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Apply current filters to pins
     */
    applyFilters() {
        this.filteredPins = this.pins.filter(pin => {
            // Search filter
            if (this.filters.search) {
                const searchLower = this.filters.search.toLowerCase();
                const matchesSearch = 
                    pin.nickname.toLowerCase().includes(searchLower) ||
                    pin.message.toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }
            
            // Main filter
            if (this.filters.main && pin.main !== this.filters.main) {
                return false;
            }
            
            return true;
        });
        
        // Apply sorting
        this.filteredPins.sort((a, b) => {
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
     * Render pins in the grid
     */
    renderPins() {
        if (this.filteredPins.length === 0) {
            this.elements.pinsGrid.classList.add('hidden');
            this.elements.emptyState.classList.remove('hidden');
            return;
        }
        
        this.elements.emptyState.classList.add('hidden');
        this.elements.pinsGrid.classList.remove('hidden');
        
        this.elements.pinsGrid.innerHTML = this.filteredPins.map(pin => this.createPinHTML(pin)).join('');
        
        // Add fade-in animation
        this.elements.pinsGrid.classList.add('fade-in');
        setTimeout(() => {
            this.elements.pinsGrid.classList.remove('fade-in');
        }, 500);
    }

    /**
     * Create HTML for a single pin
     */
    createPinHTML(pin) {
        const isOwner = pin.author_id === this.currentUser;
        const createdAt = new Date(pin.created_at);
        const timeAgo = this.getTimeAgo(createdAt);
        
        return `
            <div class="pin-card" data-pin-id="${pin.id}">
                <div class="pin-header">
                    <div class="pin-nickname">${this.escapeHtml(pin.nickname)}</div>
                    <div class="pin-timestamp">${timeAgo}</div>
                </div>
                <div class="pin-message">${this.escapeHtml(pin.message)}</div>
                ${isOwner ? `
                    <div class="pin-actions">
                        <button class="pin-action-btn edit" onclick="app.editPin('${pin.id}')" title="Edit pin">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="pin-action-btn delete" onclick="app.confirmDeletePin('${pin.id}')" title="Delete pin">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
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
     * Toggle search container visibility
     */
    toggleSearch() {
        this.elements.searchContainer.classList.toggle('hidden');
        if (!this.elements.searchContainer.classList.contains('hidden')) {
            this.elements.searchInput.focus();
        }
    }

    /**
     * Handle search input
     */
    handleSearch(value) {
        // Debounce search
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.filters.search = value;
            this.applyFilters();
            this.renderPins();
        }, 300);
    }

    /**
     * Clear search
     */
    clearSearch() {
        this.elements.searchInput.value = '';
        this.filters.search = '';
        this.applyFilters();
        this.renderPins();
    }

    /**
     * Handle filter changes
     */
    handleFilterChange(filterType, value) {
        this.filters[filterType] = value;
        this.applyFilters();
        this.renderPins();
    }

    /**
     * Open add pin modal
     */
    openAddPinModal() {
        this.editingPin = null;
        this.elements.modalTitle.textContent = 'Add New Pin';
        this.elements.submitText.textContent = 'Save Pin';
        this.resetPinForm();
        this.elements.pinModal.classList.remove('hidden');
        this.elements.nicknameInput.focus();
    }

    /**
     * Edit existing pin
     */
    editPin(pinId) {
        const pin = this.pins.find(p => p.id === pinId);
        if (!pin) {
            this.showError('Pin not found');
            return;
        }
        
        if (pin.author_id !== this.currentUser) {
            this.showError('You can only edit your own pins');
            return;
        }
        
        this.editingPin = pin;
        this.elements.modalTitle.textContent = 'Edit Pin';
        this.elements.submitText.textContent = 'Update Pin';
        
        // Populate form
        this.elements.rpNameInput.value = pin.rp_name || '';
        this.elements.nicknameInput.value = pin.nickname;
        this.elements.mainInput.value = pin.main;
        this.elements.messageInput.value = pin.message;
        
        this.elements.pinModal.classList.remove('hidden');
        this.elements.nicknameInput.focus();
    }

    /**
     * Confirm pin deletion
     */
    confirmDeletePin(pinId) {
        const pin = this.pins.find(p => p.id === pinId);
        if (!pin) {
            this.showError('Pin not found');
            return;
        }
        
        if (pin.author_id !== this.currentUser) {
            this.showError('You can only delete your own pins');
            return;
        }
        
        this.elements.confirmMessage.textContent = `Are you sure you want to delete the pin by "${pin.nickname}"?`;
        this.elements.confirmAction.onclick = () => this.deletePin(pinId);
        this.elements.confirmModal.classList.remove('hidden');
    }

    /**
     * Delete pin
     */
    async deletePin(pinId) {
        try {
            await supabaseClient.deletePin(pinId, this.currentUser);
            this.showSuccess('Pin deleted successfully');
            this.closeConfirmModal();
        } catch (error) {
            console.error('Error deleting pin:', error);
            this.showError('Failed to delete pin. Please try again.');
        }
    }

    /**
     * Handle pin form submission
     */
    async handlePinSubmit(e) {
        e.preventDefault();
        
        const formData = {
            rpName: this.elements.rpNameInput.value.trim(),
            nickname: this.elements.nicknameInput.value.trim(),
            main: this.elements.mainInput.value,
            message: this.elements.messageInput.value.trim(),
            authorId: this.currentUser
        };
        
        // Validation
        if (!formData.rpName || !formData.nickname || !formData.main || !formData.message) {
            this.showError('Please fill in all required fields');
            return;
        }
        
        if (formData.nickname.length > 30) {
            this.showError('Nickname must be 30 characters or less');
            return;
        }
        
        if (formData.rpName.length > 30) {
            this.showError('RP name must be 30 characters or less');
            return;
        }
        
        try {
            // Disable submit button
            const submitBtn = this.elements.pinForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            if (this.editingPin) {
                // Update existing pin
                await supabaseClient.updatePin(this.editingPin.id, formData, this.currentUser);
                this.showSuccess('Pin updated successfully');
            } else {
                // Create new pin
                await supabaseClient.createPin(formData);
                this.showSuccess('Pin created successfully');
            }
            
            this.closePinModal();
        } catch (error) {
            console.error('Error saving pin:', error);
            this.showError('Failed to save pin. Please try again.');
        } finally {
            // Re-enable submit button
            const submitBtn = this.elements.pinForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fas fa-save"></i> ${this.editingPin ? 'Update Pin' : 'Save Pin'}`;
        }
    }

    /**
     * Close pin modal
     */
    closePinModal() {
        this.elements.pinModal.classList.add('hidden');
        this.resetPinForm();
        this.editingPin = null;
    }

    /**
     * Close confirmation modal
     */
    closeConfirmModal() {
        this.elements.confirmModal.classList.add('hidden');
    }

    /**
     * Reset pin form
     */
    resetPinForm() {
        this.elements.pinForm.reset();
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // ESC to close modals
        if (e.key === 'Escape') {
            if (!this.elements.pinModal.classList.contains('hidden')) {
                this.closePinModal();
            } else if (!this.elements.confirmModal.classList.contains('hidden')) {
                this.closeConfirmModal();
            }
        }
        
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (this.elements.searchContainer.classList.contains('hidden')) {
                this.toggleSearch();
            } else {
                this.elements.searchInput.focus();
            }
        }
        
        // Ctrl/Cmd + N to add new pin
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.openAddPinModal();
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (this.elements.loading) this.elements.loading.classList.remove('hidden');
        if (this.elements.pinsGrid) this.elements.pinsGrid.classList.add('hidden');
        if (this.elements.emptyState) this.elements.emptyState.classList.add('hidden');
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        if (this.elements.loading) this.elements.loading.classList.add('hidden');
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.elements.errorMessage) this.elements.errorMessage.textContent = message;
        if (this.elements.errorToast) this.elements.errorToast.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideToast('error-toast');
        }, 5000);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        if (this.elements.successMessage) this.elements.successMessage.textContent = message;
        if (this.elements.successToast) this.elements.successToast.classList.remove('hidden');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.hideToast('success-toast');
        }, 3000);
    }

    /**
     * Hide toast notification
     */
    hideToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.add('hidden');
        }
    }
}

// Global functions for onclick handlers
function openAddPinModal() {
    app.openAddPinModal();
}

function closePinModal() {
    app.closePinModal();
}

function closeConfirmModal() {
    app.closeConfirmModal();
}

function hideToast(toastId) {
    app.hideToast(toastId);
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', async () => {
    app = new CorkboardApp();
    await app.initialize();
});
