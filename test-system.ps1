$BASE = "http://localhost:3001/api/v1"

Write-Host "Testing Chat System..." -ForegroundColor Cyan

# 1. Get campaigns
Write-Host "`n1. Checking campaigns..." -ForegroundColor Yellow
$camps = Invoke-RestMethod "$BASE/campaigns"
Write-Host "Found $($camps.data.Count) campaigns" -ForegroundColor Green
$camps.data | Format-Table id, name, videoCount

if ($camps.data.Count -eq 0) {
    Write-Host "No campaigns found!" -ForegroundColor Red
    exit
}

$campId = $camps.data[0].id
$campName = $camps.data[0].name

# 2. Get campaign videos
Write-Host "`n2. Checking videos in '$campName'..." -ForegroundColor Yellow
$campDetail = Invoke-RestMethod "$BASE/campaigns/$campId"
Write-Host "Found $($campDetail.data.videos.Count) videos" -ForegroundColor Green
$campDetail.data.videos | Format-Table id, fileName, status

# 3. Test search
Write-Host "`n3. Testing search..." -ForegroundColor Yellow
try {
    $search = @{
        query = "humans people faces"
        campaignId = $campId
        limit = 5
    } | ConvertTo-Json
    
    $results = Invoke-RestMethod "$BASE/search/query" -Method Post -Body $search -ContentType "application/json"
    Write-Host "Search returned $($results.data.results.Count) results" -ForegroundColor Green
    
    if ($results.data.results.Count -gt 0) {
        $results.data.results | Select-Object -First 3 | ForEach-Object {
            Write-Host "  - $($_.scene.description.Substring(0, [Math]::Min(80, $_.scene.description.Length)))..."
        }
    } else {
        Write-Host "No results! Check if embeddings were generated." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Search failed: $_" -ForegroundColor Red
}

# 4. Test chat
Write-Host "`n4. Testing chat..." -ForegroundColor Yellow
$conv = Invoke-RestMethod "$BASE/chat/conversations" -Method Post -Body (@{campaignId=$campId} | ConvertTo-Json) -ContentType "application/json"
Write-Host "Created conversation: $($conv.data.id)"

$msg = Invoke-RestMethod "$BASE/chat/conversations/$($conv.data.id)/messages" -Method Post -Body (@{message="Show me scenes with people"} | ConvertTo-Json) -ContentType "application/json"
Write-Host "`nAI Response:" -ForegroundColor Cyan
Write-Host $msg.data.response
Write-Host "`nContext scenes: $($msg.data.context.scenes.Count)" -ForegroundColor Cyan

