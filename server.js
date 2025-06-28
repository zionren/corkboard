const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Static files middleware with proper headers
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Explicit static file routes for Vercel
app.get('/styles/:file', (req, res, next) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'styles', req.params.file));
    } catch (error) {
        next(error);
    }
});

app.get('/js/:file', (req, res, next) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'js', req.params.file));
    } catch (error) {
        next(error);
    }
});

app.get('/images/:file', (req, res, next) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'images', req.params.file));
    } catch (error) {
        next(error);
    }
});

// Routes
app.get('/', (req, res, next) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (error) {
        next(error);
    }
});

app.get('/admin', (req, res, next) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } catch (error) {
        next(error);
    }
});

// API endpoint for admin authentication
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            res.json({ success: true, message: 'Authentication successful' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error in admin login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error during authentication' 
        });
    }
});

// Environment variables endpoint for frontend
app.get('/api/config', (req, res) => {
    try {
        console.log('Config requested. Environment variables:', {
            supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Missing',
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing'
        });
        
        // Validate that required environment variables are present
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            return res.status(500).json({
                error: 'Missing required environment variables',
                details: {
                    supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Missing',
                    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing'
                }
            });
        }
        
        res.json({
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY
        });
    } catch (error) {
        console.error('Error serving config:', error);
        res.status(500).json({ 
            error: 'Failed to load configuration',
            message: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    try {
        const healthData = {
            status: 'OK', 
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV || 'development',
            port: PORT,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
        
        res.json(healthData);
    } catch (error) {
        console.error('Error in health check:', error);
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`
    });
});

app.listen(PORT, '0.0.0.0', () => {
    try {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
        console.log('Environment:', process.env.NODE_ENV || 'development');
        console.log('Required env vars check:', {
            SUPABASE_URL: process.env.SUPABASE_URL ? '✓' : '✗',
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '✓' : '✗',
            ADMIN_USERNAME: process.env.ADMIN_USERNAME ? '✓' : '✗ (using default)',
            ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? '✓' : '✗ (using default)'
        });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
});
