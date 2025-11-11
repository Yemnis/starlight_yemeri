# Check Current Configuration
Write-Host "Checking your Vertex AI configuration..." -ForegroundColor Cyan

# Method 1: Check from backend logs
Write-Host "`n1. Checking backend startup logs..." -ForegroundColor Yellow
$logFile = "backend\logs\video-analysis-api.log"
if (Test-Path $logFile) {
    $configLines = Get-Content $logFile | Select-String -Pattern "location|region|VertexAI|initialized" | Select-Object -Last 10
    Write-Host "Recent config from logs:" -ForegroundColor White
    $configLines | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "No log file found at $logFile" -ForegroundColor Yellow
}

# Method 2: Make a test API call to see what region is being used
Write-Host "`n2. Checking via API..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod "http://localhost:8080/api/health/auth" -ErrorAction Stop
    Write-Host "Backend is running" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "Backend might not be running on port 8080" -ForegroundColor Yellow
    Write-Host "Error: $_" -ForegroundColor Red
}

# Method 3: Check service account key
Write-Host "`n3. Checking service account key..." -ForegroundColor Yellow
$keyPath = "backend\config\service-account-key.json"
if (Test-Path $keyPath) {
    $key = Get-Content $keyPath | ConvertFrom-Json
    Write-Host "Project ID: $($key.project_id)" -ForegroundColor White
    Write-Host "Client Email: $($key.client_email)" -ForegroundColor White
} else {
    Write-Host "Service account key not found at $keyPath" -ForegroundColor Yellow
}

# Method 4: Check your GCS bucket location (good indicator)
Write-Host "`n4. Checking GCS bucket location..." -ForegroundColor Yellow
Write-Host "Visit: https://console.cloud.google.com/storage/browser?project=gen-lang-client-0082081331" -ForegroundColor Cyan
Write-Host "Your bucket location will tell you what region you're using." -ForegroundColor White

Write-Host "`n" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Common European Locations:" -ForegroundColor Cyan
Write-Host "  - europe-north1  (Finland)" -ForegroundColor White
Write-Host "  - europe-west1   (Belgium)" -ForegroundColor White
Write-Host "  - europe-west4   (Netherlands)" -ForegroundColor White
Write-Host "`nUS Locations:" -ForegroundColor Cyan
Write-Host "  - us-central1    (Iowa)" -ForegroundColor White
Write-Host "  - us-east4       (Virginia)" -ForegroundColor White
Write-Host "================================" -ForegroundColor Cyan

