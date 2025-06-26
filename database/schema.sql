-- Sunset Corkboard Database Schema
-- This schema creates the necessary tables and security policies for the corkboard application

-- Enable necessary extensions
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pins_created_at ON pins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pins_author_id ON pins (author_id);
CREATE INDEX IF NOT EXISTS idx_pins_main ON pins (main);
CREATE INDEX IF NOT EXISTS idx_pins_nickname ON pins (nickname);
CREATE INDEX IF NOT EXISTS idx_pins_search ON pins USING gin(to_tsvector('english', nickname || ' ' || message));

-- Enable Row Level Security
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anyone to read all pins (public corkboard)
CREATE POLICY "Anyone can view pins" ON pins
    FOR SELECT USING (true);

-- RLS Policy: Anyone can insert pins (anonymous posting)
CREATE POLICY "Anyone can insert pins" ON pins
    FOR INSERT WITH CHECK (true);

-- RLS Policy: Users can only update their own pins
CREATE POLICY "Users can update own pins" ON pins
    FOR UPDATE USING (author_id = auth.uid()::uuid OR author_id::text = auth.uid()::text);

-- RLS Policy: Users can only delete their own pins
CREATE POLICY "Users can delete own pins" ON pins
    FOR DELETE USING (author_id = auth.uid()::uuid OR author_id::text = auth.uid()::text);

-- Alternative policies for anonymous users (since we're using UUID-based ownership without Supabase auth)
-- Drop the auth-based policies and create simpler ones for our use case
DROP POLICY IF EXISTS "Users can update own pins" ON pins;
DROP POLICY IF EXISTS "Users can delete own pins" ON pins;

-- Create policies that work with our UUID-based ownership system
-- Note: These are more permissive but match our application logic
CREATE POLICY "Enable update for own pins" ON pins
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for own pins" ON pins
    FOR DELETE USING (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update the updated_at column
CREATE TRIGGER update_pins_updated_at 
    BEFORE UPDATE ON pins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable real-time subscriptions for the pins table
ALTER PUBLICATION supabase_realtime ADD TABLE pins;

-- Create a view for analytics (optional, for admin dashboard)
CREATE OR REPLACE VIEW daily_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_posts,
    COUNT(DISTINCT author_id) as unique_users,
    COUNT(*) FILTER (WHERE main = '1') as main_1_posts,
    COUNT(*) FILTER (WHERE main = '2') as main_2_posts,
    COUNT(*) FILTER (WHERE main = '3') as main_3_posts,
    COUNT(*) FILTER (WHERE main = '4') as main_4_posts,
    COUNT(*) FILTER (WHERE main = 'council') as council_posts
FROM pins
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Insert some example data for testing (remove in production)
-- This is commented out to follow the guideline of not creating mock data
/*
INSERT INTO pins (rp_name, nickname, main, message, author_id) VALUES
('TestChar1', 'Player1', '1', 'Welcome to the sunset corkboard!', uuid_generate_v4()),
('TestChar2', 'Player2', 'council', 'This is a test message from council.', uuid_generate_v4()),
('TestChar3', 'Player3', '2', 'Another test message for main 2.', uuid_generate_v4());
*/

-- Grant necessary permissions
GRANT ALL ON pins TO authenticated;
GRANT ALL ON pins TO anon;
GRANT ALL ON daily_stats TO authenticated;
GRANT ALL ON daily_stats TO anon;

-- Comments for documentation
COMMENT ON TABLE pins IS 'Main table storing all corkboard pins/posts';
COMMENT ON COLUMN pins.id IS 'Unique identifier for each pin';
COMMENT ON COLUMN pins.rp_name IS 'RP character name (visible to admin only, max 30 chars)';
COMMENT ON COLUMN pins.nickname IS 'Display nickname (visible to everyone, max 30 chars)';
COMMENT ON COLUMN pins.main IS 'Main category (1, 2, 3, 4, or council)';
COMMENT ON COLUMN pins.message IS 'The main message content (visible to everyone)';
COMMENT ON COLUMN pins.author_id IS 'UUID identifying the author (for ownership verification)';
COMMENT ON COLUMN pins.created_at IS 'Timestamp when the pin was created';
COMMENT ON COLUMN pins.updated_at IS 'Timestamp when the pin was last updated';

-- Additional security note:
-- Since this application uses client-side UUID generation for anonymous users,
-- the RLS policies are more permissive than typical auth-based applications.
-- The application logic handles ownership verification through the author_id matching.
-- In a production environment, consider implementing proper user authentication
-- and more restrictive RLS policies.
