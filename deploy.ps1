Write-Host "Deploying to Vercel..." -ForegroundColor Green
Write-Host ""

# Check if Vercel CLI is installed
try {
    vercel --version | Out-Null
    Write-Host "Vercel CLI found" -ForegroundColor Green
} catch {
    Write-Host "Vercel CLI not found. Installing globally..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host ""
Write-Host "Starting deployment..." -ForegroundColor Green
vercel --prod

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Don't forget to set up your environment variables in Vercel dashboard:" -ForegroundColor Yellow
Write-Host "- SUPABASE_URL" -ForegroundColor Cyan
Write-Host "- SUPABASE_ANON_KEY" -ForegroundColor Cyan
Write-Host "- DATABASE_URL" -ForegroundColor Cyan
Write-Host "- ADMIN_USERNAME" -ForegroundColor Cyan
Write-Host "- ADMIN_PASSWORD" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"
