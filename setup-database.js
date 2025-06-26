const https = require('https');

async function setupDatabase() {
    try {
        // Use Supabase REST API to create the table
        const tableSchema = {
            name: 'pins',
            columns: [
                { name: 'id', type: 'uuid', primary_key: true, default_value: 'uuid_generate_v4()' },
                { name: 'rp_name', type: 'varchar', size: 30 },
                { name: 'nickname', type: 'varchar', size: 30, not_null: true },
                { name: 'main', type: 'varchar', size: 10, not_null: true },
                { name: 'message', type: 'text', not_null: true },
                { name: 'author_id', type: 'uuid', not_null: true },
                { name: 'created_at', type: 'timestamptz', default_value: 'now()', not_null: true },
                { name: 'updated_at', type: 'timestamptz', default_value: 'now()' }
            ]
        };

        console.log('Database schema ready for manual setup');
        console.log('Please run the following SQL in your Supabase SQL editor:');
        console.log(`
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
CREATE POLICY "Anyone can view pins" ON pins FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pins" ON pins FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for own pins" ON pins FOR UPDATE USING (true);
CREATE POLICY "Enable delete for own pins" ON pins FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pins_updated_at 
    BEFORE UPDATE ON pins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
        `);

    } catch (error) {
        console.error('Setup preparation error:', error);
    }
}

setupDatabase();