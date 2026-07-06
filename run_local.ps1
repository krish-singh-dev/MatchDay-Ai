# MatchDay AI - Local Bootstrapping Script

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "          BOOTSTRAPPING MATCHDAY AI          " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Check Docker Daemon
Write-Host "Checking Docker Daemon..." -ForegroundColor Yellow
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop and run this script again." -ForegroundColor Red
    Exit 1
}
Write-Host "Docker Daemon is online." -ForegroundColor Green

# 2. Spin up Containers
Write-Host "Spinning up PostgreSQL and Redis containers..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to spin up docker containers." -ForegroundColor Red
    Exit 1
}
Write-Host "Containers are running successfully." -ForegroundColor Green

# 3. Synchronize Database & Seed
Write-Host "Syncing database schema via Prisma..." -ForegroundColor Yellow
npm run prisma:push --prefix backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Prisma database synchronization failed." -ForegroundColor Red
    Exit 1
}

Write-Host "Seeding database with MatchDay Arena zones..." -ForegroundColor Yellow
npm run prisma:seed --prefix backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Database seeding failed." -ForegroundColor Red
    Exit 1
}
Write-Host "Database sync and seeding completed successfully!" -ForegroundColor Green

# 4. Start Development Servers in parallel windows
Write-Host "Spawning Express Backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev --prefix backend" -WindowStyle Normal

Write-Host "Spawning Vite Frontend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev --prefix frontend" -WindowStyle Normal

Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Success! Check spawned PowerShell windows. " -ForegroundColor Green
Write-Host "  - Backend API: http://localhost:5000       " -ForegroundColor Green
Write-Host "  - Frontend UI: http://localhost:5173       " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
