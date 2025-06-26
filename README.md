# Corkboard App

A modern corkboard application built with Express.js and Supabase.

## Features

- Interactive corkboard interface
- Admin panel for management
- Supabase integration for data storage
- Responsive design

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your environment variables:
   ```
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   DATABASE_URL=your_supabase_database_url_here
   PORT=5000
   NODE_ENV=development
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_admin_password
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5000 in your browser

## Deployment to Vercel

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy to Vercel:
   ```bash
   vercel
   ```

4. Set up environment variables in Vercel dashboard:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - DATABASE_URL
   - ADMIN_USERNAME
   - ADMIN_PASSWORD

5. Your app will be live at the provided Vercel URL

## Project Structure

```
├── public/           # Static frontend files
├── database/         # Database schema
├── node_modules/     # Dependencies (required for Vercel)
├── server.js         # Express server
├── package.json      # Node.js configuration
├── vercel.json       # Vercel configuration
└── .env             # Environment variables (local only)
```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build the project
