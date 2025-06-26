// Simple script to create the pins table using Supabase client
async function createTable() {
    try {
        // Fetch Supabase config
        const response = await fetch('/api/config');
        const config = await response.json();
        
        console.log('Config received:', config.supabaseUrl ? 'URL present' : 'No URL');
        
        // Use Supabase REST API to execute SQL
        const sqlQuery = `
            -- Enable UUID extension
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            
            -- Create pins table
            CREATE TABLE IF NOT EXISTS pins (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                rp_name VARCHAR(30),
                nickname VARCHAR(30) NOT NULL,
                main VARCHAR(10) NOT NULL CHECK (main IN ('1', '2', '3', '4', 'council')),
                message TEXT NOT NULL,
                author_id UUID NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            
            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_pins_created_at ON pins (created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_pins_author_id ON pins (author_id);
            CREATE INDEX IF NOT EXISTS idx_pins_main ON pins (main);
            
            -- Enable Row Level Security
            ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
            
            -- Create policies
            DROP POLICY IF EXISTS "Anyone can view pins" ON pins;
            CREATE POLICY "Anyone can view pins" ON pins FOR SELECT USING (true);
            
            DROP POLICY IF EXISTS "Anyone can insert pins" ON pins;
            CREATE POLICY "Anyone can insert pins" ON pins FOR INSERT WITH CHECK (true);
            
            DROP POLICY IF EXISTS "Enable update for own pins" ON pins;
            CREATE POLICY "Enable update for own pins" ON pins FOR UPDATE USING (true);
            
            DROP POLICY IF EXISTS "Enable delete for own pins" ON pins;
            CREATE POLICY "Enable delete for own pins" ON pins FOR DELETE USING (true);
        `;
        
        // Try to execute via REST API
        const sqlResponse = await fetch(`${config.supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': config.supabaseAnonKey,
                'Authorization': `Bearer ${config.supabaseAnonKey}`
            },
            body: JSON.stringify({
                sql: sqlQuery
            })
        });
        
        if (sqlResponse.ok) {
            console.log('Database table created successfully!');
        } else {
            const error = await sqlResponse.text();
            console.log('SQL execution failed:', error);
            console.log('Please run the SQL manually in Supabase dashboard');
        }
        
    } catch (error) {
        console.error('Error:', error);
        console.log('Please create the table manually in your Supabase SQL Editor with the provided schema');
    }
}

// Run if in browser
if (typeof window !== 'undefined') {
    createTable();
}

module.exports = createTable;