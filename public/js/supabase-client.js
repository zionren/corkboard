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
                throw new Error('Failed to fetch configuration');
            }
            
            this.config = await response.json();
            
            // Initialize Supabase client
            if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
                throw new Error('Missing Supabase configuration');
            }

            this.client = supabase.createClient(
                this.config.supabaseUrl,
                this.config.supabaseAnonKey
            );

            this.initialized = true;
            console.log('Supabase client initialized successfully');
            
            // Set up real-time subscriptions
            this.setupRealtimeSubscriptions();
            
            return this.client;
        } catch (error) {
            console.error('Failed to initialize Supabase client:', error);
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
        if (!this.client) return;

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
    }

    /**
     * Handle real-time updates from Supabase
     */
    handleRealtimeUpdate(payload) {
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
    }

    /**
     * Create a new pin
     */
    async createPin(pinData) {
        this.ensureInitialized();
        
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
            throw error;
        }

        return data[0];
    }

    /**
     * Get all pins with optional filtering and sorting
     */
    async getPins(filters = {}) {
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
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching pins:', error);
            throw error;
        }

        return data || [];
    }

    /**
     * Update a pin
     */
    async updatePin(id, pinData, authorId) {
        this.ensureInitialized();
        
        // First verify ownership
        const { data: existingPin, error: fetchError } = await this.client
            .from('pins')
            .select('author_id')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Error fetching pin for update:', fetchError);
            throw fetchError;
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
            throw error;
        }

        return data[0];
    }

    /**
     * Delete a pin
     */
    async deletePin(id, authorId) {
        this.ensureInitialized();
        
        const { data, error } = await this.client
            .from('pins')
            .delete()
            .eq('id', id)
            .eq('author_id', authorId)
            .select();

        if (error) {
            console.error('Error deleting pin:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('Pin not found or unauthorized');
        }

        return data[0];
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
}

// Create global instance
const supabaseClient = new SupabaseClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}
