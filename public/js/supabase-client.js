/**
 * Supabase Client Configuration and Initialization
 * Handles connection to Supabase and provides database utilities
 */

class SupabaseClient {
    constructor() {
        this.client = null;
        this.config = null;
        this.initialized = false;
    }

    /**
     * Initialize Supabase client with configuration from server
     */
    async initialize() {
        try {
            // Fetch configuration from server
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Failed to fetch configuration: ${response.status} ${response.statusText}`);
            }
            
            this.config = await response.json();
            
            // Validate configuration
            if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
                throw new Error('Missing Supabase configuration');
            }

            // Initialize Supabase client
            this.client = supabase.createClient(
                this.config.supabaseUrl,
                this.config.supabaseAnonKey
            );

            // Test the connection
            const { data, error } = await this.client.from('pins').select('count').limit(1);
            if (error) {
                throw new Error(`Supabase connection test failed: ${error.message}`);
            }

            this.initialized = true;
            console.log('Supabase client initialized successfully');
            
            // Set up real-time subscriptions
            this.setupRealtimeSubscriptions();
            
            return this.client;
        } catch (error) {
            console.error('Failed to initialize Supabase client:', error);
            this.initialized = false;
            this.client = null;
            throw error;
        }
    }

    /**
     * Ensure client is initialized before operations
     */
    ensureInitialized() {
        if (!this.initialized || !this.client) {
            throw new Error('Supabase client not initialized. Call initialize() first.');
        }
    }

    /**
     * Set up real-time subscriptions for pins table
     */
    setupRealtimeSubscriptions() {
        try {
            if (!this.client) {
                console.warn('Cannot setup realtime subscriptions: client not initialized');
                return;
            }

            // Subscribe to pins table changes
            this.client
                .channel('pins-channel')
                .on('postgres_changes', 
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'pins' 
                    }, 
                    (payload) => {
                        this.handleRealtimeUpdate(payload);
                    }
                )
                .subscribe();

            console.log('Real-time subscriptions established');
        } catch (error) {
            console.error('Error setting up real-time subscriptions:', error);
            // Don't throw error as this is not critical for basic functionality
        }
    }

    /**
     * Handle real-time updates from Supabase
     */
    handleRealtimeUpdate(payload) {
        try {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            // Dispatch custom events for different update types
            const event = new CustomEvent('supabase-update', {
                detail: {
                    type: eventType,
                    new: newRecord,
                    old: oldRecord
                }
            });
            
            document.dispatchEvent(event);
            
            console.log('Real-time update received:', eventType, payload);
        } catch (error) {
            console.error('Error handling real-time update:', error);
            // Continue execution - don't break real-time functionality
        }
    }

    /**
     * Create a new pin
     */
    async createPin(pinData) {
        try {
            this.ensureInitialized();
            
            // Validate input data
            if (!pinData.rpName || !pinData.nickname || !pinData.main || !pinData.message || !pinData.authorId) {
                throw new Error('Missing required pin data');
            }
            
            const { data, error } = await this.client
                .from('pins')
                .insert([{
                    rp_name: pinData.rpName,
                    nickname: pinData.nickname,
                    main: pinData.main,
                    message: pinData.message,
                    author_id: pinData.authorId,
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) {
                console.error('Error creating pin:', error);
                throw new Error(`Failed to create pin: ${error.message}`);
            }

            return data[0];
        } catch (error) {
            console.error('Error in createPin:', error);
            if (error.message.includes('not initialized')) {
                throw error;
            }
            throw new Error('Failed to create pin. Please try again.');
        }
    }

    /**
     * Get all pins with optional filtering and sorting
     */
    async getPins(filters = {}) {
        try {
            this.ensureInitialized();
            
            let query = this.client
                .from('pins')
                .select('*');

            // Apply filters
            if (filters.main) {
                query = query.eq('main', filters.main);
            }

            if (filters.search) {
                query = query.or(`nickname.ilike.%${filters.search}%,message.ilike.%${filters.search}%`);
            }

            if (filters.authorId) {
                query = query.eq('author_id', filters.authorId);
            }

            // Apply sorting
            const sortOrder = filters.sort || 'newest';
            switch (sortOrder) {
                case 'newest':
                    query = query.order('created_at', { ascending: false });
                    break;
                case 'oldest':
                    query = query.order('created_at', { ascending: true });
                    break;
                case 'a-z':
                    query = query.order('nickname', { ascending: true });
                    break;
                case 'z-a':
                    query = query.order('nickname', { ascending: false });
                    break;
                default:
                    query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching pins:', error);
                throw new Error(`Failed to fetch pins: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('Error in getPins:', error);
            if (error.message.includes('not initialized')) {
                throw error;
            }
            throw new Error('Failed to retrieve pins. Please try again.');
        }
    }

    /**
     * Update a pin
     */
    async updatePin(id, pinData, authorId) {
        try {
            this.ensureInitialized();
            
            // Validate input
            if (!id || !pinData || !authorId) {
                throw new Error('Missing required parameters for pin update');
            }
            
            // First verify ownership
            const { data: existingPin, error: fetchError } = await this.client
                .from('pins')
                .select('author_id')
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error('Error fetching pin for update:', fetchError);
                throw new Error(`Failed to verify pin ownership: ${fetchError.message}`);
            }

            if (existingPin.author_id !== authorId) {
                throw new Error('Unauthorized: You can only edit your own pins');
            }

            const { data, error } = await this.client
                .from('pins')
                .update({
                    rp_name: pinData.rpName,
                    nickname: pinData.nickname,
                    main: pinData.main,
                    message: pinData.message,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('author_id', authorId)
                .select();

            if (error) {
                console.error('Error updating pin:', error);
                throw new Error(`Failed to update pin: ${error.message}`);
            }

            return data[0];
        } catch (error) {
            console.error('Error in updatePin:', error);
            if (error.message.includes('not initialized') || error.message.includes('Unauthorized')) {
                throw error;
            }
            throw new Error('Failed to update pin. Please try again.');
        }
    }

    /**
     * Delete a pin
     */
    async deletePin(id, authorId) {
        try {
            this.ensureInitialized();
            
            // Validate input
            if (!id || !authorId) {
                throw new Error('Missing required parameters for pin deletion');
            }
            
            const { data, error } = await this.client
                .from('pins')
                .delete()
                .eq('id', id)
                .eq('author_id', authorId)
                .select();

            if (error) {
                console.error('Error deleting pin:', error);
                throw new Error(`Failed to delete pin: ${error.message}`);
            }

            if (!data || data.length === 0) {
                throw new Error('Pin not found or you do not have permission to delete it');
            }

            return data[0];
        } catch (error) {
            console.error('Error in deletePin:', error);
            if (error.message.includes('not initialized') || error.message.includes('not found')) {
                throw error;
            }
            throw new Error('Failed to delete pin. Please try again.');
        }
    }

    /**
     * Get analytics data for admin dashboard
     */
    async getAnalytics(date = new Date()) {
        this.ensureInitialized();
        
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get posts for today
        const { data: todayPosts, error: todayError } = await this.client
            .from('pins')
            .select('*')
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());

        if (todayError) {
            console.error('Error fetching today\'s posts:', todayError);
            throw todayError;
        }

        // Get posts from last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const { data: recentPosts, error: recentError } = await this.client
            .from('pins')
            .select('*')
            .gte('created_at', oneHourAgo.toISOString());

        if (recentError) {
            console.error('Error fetching recent posts:', recentError);
            throw recentError;
        }

        // Calculate statistics
        const mainCounts = {};
        const uniqueUsers = new Set();
        const hourlyData = Array(24).fill(0);

        todayPosts.forEach(post => {
            // Count by main
            mainCounts[post.main] = (mainCounts[post.main] || 0) + 1;
            
            // Count unique users
            uniqueUsers.add(post.author_id);
            
            // Count by hour
            const hour = new Date(post.created_at).getHours();
            hourlyData[hour]++;
        });

        return {
            totalPosts: todayPosts.length,
            uniqueUsers: uniqueUsers.size,
            recentPosts: recentPosts.length,
            mainCounts,
            hourlyData,
            posts: todayPosts
        };
    }

    /**
     * Delete multiple pins (admin only)
     */
    async deletePins(pinIds) {
        this.ensureInitialized();
        
        const { data, error } = await this.client
            .from('pins')
            .delete()
            .in('id', pinIds)
            .select();

        if (error) {
            console.error('Error deleting pins:', error);
            throw error;
        }

        return data;
    }

    /**
     * Get all pins for admin with full details
     */
    async getAllPinsForAdmin(filters = {}) {
        this.ensureInitialized();
        
        let query = this.client
            .from('pins')
            .select('*');

        // Apply admin filters
        if (filters.main) {
            query = query.eq('main', filters.main);
        }

        if (filters.search) {
            query = query.or(`nickname.ilike.%${filters.search}%,message.ilike.%${filters.search}%,rp_name.ilike.%${filters.search}%`);
        }

        // Apply sorting
        const sortOrder = filters.sort || 'newest';
        switch (sortOrder) {
            case 'newest':
                query = query.order('created_at', { ascending: false });
                break;
            case 'oldest':
                query = query.order('created_at', { ascending: true });
                break;
            case 'a-z':
                query = query.order('nickname', { ascending: true });
                break;
            case 'z-a':
                query = query.order('nickname', { ascending: false });
                break;
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching pins for admin:', error);
            throw error;
        }

        return data || [];
    }

    /**
     * Get analytics data for admin dashboard with date range support
     */
    async getAnalyticsData(dateRange) {
        this.ensureInitialized();
        
        let query = this.client.from('pins').select('*');
        
        // Apply date range filters
        if (dateRange.startDate && dateRange.endDate) {
            query = query
                .gte('created_at', dateRange.startDate.toISOString())
                .lte('created_at', dateRange.endDate.toISOString());
        }
        
        const { data: posts, error } = await query;
        
        if (error) {
            console.error('Error fetching analytics data:', error);
            throw error;
        }
        
        // Calculate statistics
        const mainCounts = { '1': 0, '2': 0, '3': 0, '4': 0, 'council': 0 };
        const uniqueUsers = new Set();
        let hourlyData = Array(24).fill(0);
        let dailyData = {};
        
        // If cumulative mode and date range spans multiple days, organize by day
        if (dateRange.cumulative && dateRange.startDate && dateRange.endDate) {
            const diffTime = Math.abs(dateRange.endDate - dateRange.startDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 1) {
                // Group by day for cumulative view
                for (let i = 0; i < diffDays; i++) {
                    const date = new Date(dateRange.startDate);
                    date.setDate(date.getDate() + i);
                    const dateKey = date.toISOString().split('T')[0];
                    dailyData[dateKey] = 0;
                }
            }
        }
        
        posts.forEach(post => {
            // Count by main
            if (mainCounts.hasOwnProperty(post.main)) {
                mainCounts[post.main]++;
            }
            
            // Count unique users
            uniqueUsers.add(post.author_id);
            
            // For timeline data
            const postDate = new Date(post.created_at);
            
            if (dateRange.cumulative && Object.keys(dailyData).length > 0) {
                // Cumulative daily data
                const dateKey = postDate.toISOString().split('T')[0];
                if (dailyData.hasOwnProperty(dateKey)) {
                    dailyData[dateKey]++;
                }
            } else {
                // Hourly data for single day or non-cumulative
                const hour = postDate.getHours();
                hourlyData[hour]++;
            }
        });
        
        // Convert daily data to cumulative if needed
        if (dateRange.cumulative && Object.keys(dailyData).length > 0) {
            const sortedDates = Object.keys(dailyData).sort();
            let cumulative = 0;
            const cumulativeData = {};
            
            sortedDates.forEach(date => {
                cumulative += dailyData[date];
                cumulativeData[date] = cumulative;
            });
            
            // Convert to array format for charts
            hourlyData = sortedDates.map(date => cumulativeData[date]);
        }
        
        // Get recent posts (last hour) only for today
        let recentPosts = 0;
        if (dateRange.preset === 'today') {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            recentPosts = posts.filter(post => 
                new Date(post.created_at) >= oneHourAgo
            ).length;
        }
        
        return {
            totalPosts: posts.length,
            uniqueUsers: uniqueUsers.size,
            recentPosts,
            mainCounts,
            hourlyData,
            dailyData: Object.keys(dailyData).length > 0 ? dailyData : null,
            posts
        };
    }
}

// Create global instance
const supabaseClient = new SupabaseClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}
