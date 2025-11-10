-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_code TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on short_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_notes_short_code ON notes(short_code);

-- Create index on created_at for potential future features
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Allow anyone to insert notes
CREATE POLICY "Allow public insert" ON notes
    FOR INSERT
    WITH CHECK (true);

-- Policy: Allow anyone to select notes
CREATE POLICY "Allow public select" ON notes
    FOR SELECT
    USING (true);

-- Optional: Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE notes IS 'Stores user-created notes with optional password protection';
COMMENT ON COLUMN notes.short_code IS 'Unique short code used in URLs to access the note';
COMMENT ON COLUMN notes.content IS 'The actual content of the note';
COMMENT ON COLUMN notes.password_hash IS 'Bcrypt hash of the password if note is password-protected';
