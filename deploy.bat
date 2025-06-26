@echo off
echo Deploying to Vercel...
echo.

REM Check if Vercel CLI is installed
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo Vercel CLI not found. Installing globally...
    npm install -g vercel
)

echo.
echo Starting deployment...
vercel --prod

echo.
echo Deployment complete!
echo Don't forget to set up your environment variables in Vercel dashboard:
echo - SUPABASE_URL
echo - SUPABASE_ANON_KEY  
echo - DATABASE_URL
echo - ADMIN_USERNAME
echo - ADMIN_PASSWORD
pause
