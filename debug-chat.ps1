# Debug Chat System
# This script checks if embeddings, campaigns, and search are working

$BASE_URL = "http://localhost:3001/api/v1"

Write-Host "🔍 Debugging Starlight Chat System" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check 1: List all campaigns
Write-Host "1️⃣  Checking campaigns..." -ForegroundColor Yellow
try {
    $campaigns = Invoke-RestMethod -Uri "$BASE_URL/campaigns" -Method Get
    $campaignCount = $campaigns.data.Count
    Write-Host "✅ Found $campaignCount campaigns" -ForegroundColor Green
    
    if ($campaignCount -gt 0) {
        Write-Host ""
        Write-Host "Campaigns:" -ForegroundColor Cyan
        foreach ($campaign in $campaigns.data) {
            Write-Host "  - ID: $($campaign.id)" -ForegroundColor White
            Write-Host "    Name: $($campaign.name)" -ForegroundColor White
            Write-Host "    Videos: $($campaign.videoCount)" -ForegroundColor White
            Write-Host ""
        }
        
        # Save first campaign ID for later tests
        $CAMPAIGN_ID = $campaigns.data[0].id
        $CAMPAIGN_NAME = $campaigns.data[0].name
    } else {
        Write-Host "⚠️  No campaigns found! Create one first." -ForegroundColor Yellow
        exit
    }
} catch {
    Write-Host "❌ Failed to get campaigns: $_" -ForegroundColor Red
    exit 1
}

# Check 2: Get videos in the campaign
Write-Host "2️⃣  Checking videos in campaign '$CAMPAIGN_NAME'..." -ForegroundColor Yellow
try {
    $campaignDetails = Invoke-RestMethod -Uri "$BASE_URL/campaigns/$CAMPAIGN_ID" -Method Get
    $videoCount = $campaignDetails.data.videos.Count
    Write-Host "✅ Found $videoCount videos" -ForegroundColor Green
    
    if ($videoCount -gt 0) {
        Write-Host ""
        Write-Host "Videos:" -ForegroundColor Cyan
        foreach ($video in $campaignDetails.data.videos) {
            Write-Host "  - ID: $($video.id)" -ForegroundColor White
            Write-Host "    File: $($video.fileName)" -ForegroundColor White
            Write-Host "    Status: $($video.status)" -ForegroundColor White
            Write-Host ""
        }
    } else {
        Write-Host "⚠️  No videos in this campaign! Upload some first." -ForegroundColor Yellow
        exit
    }
} catch {
    Write-Host "❌ Failed to get campaign details: $_" -ForegroundColor Red
    exit 1
}

# Check 3: Try semantic search
Write-Host "3️⃣  Testing semantic search..." -ForegroundColor Yellow
try {
    $searchBody = @{
        query = "people humans faces"
        campaignId = $CAMPAIGN_ID
        limit = 5
    } | ConvertTo-Json
    
    $searchResults = Invoke-RestMethod -Uri "$BASE_URL/search/scenes" -Method Post -Body $searchBody -ContentType "application/json"
    $resultCount = $searchResults.data.Count
    Write-Host "✅ Search returned $resultCount results" -ForegroundColor Green
    
    if ($resultCount -gt 0) {
        Write-Host ""
        Write-Host "Top 3 Results:" -ForegroundColor Cyan
        $top3 = $searchResults.data | Select-Object -First 3
        $i = 1
        foreach ($result in $top3) {
            Write-Host "  $i. Scene: $($result.scene.id)" -ForegroundColor White
            Write-Host "     Description: $($result.scene.description)" -ForegroundColor White
            Write-Host "     Score: $($result.score)" -ForegroundColor White
            Write-Host ""
            $i++
        }
    } else {
        Write-Host "⚠️  No results from search!" -ForegroundColor Yellow
        Write-Host "     This could mean:" -ForegroundColor Yellow
        Write-Host "     - Embeddings weren't generated yet" -ForegroundColor Yellow
        Write-Host "     - Videos are still processing" -ForegroundColor Yellow
        Write-Host "     - No matching content exists" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Search failed: $_" -ForegroundColor Red
    Write-Host "    Search endpoint might not be implemented yet" -ForegroundColor Yellow
}

# Check 4: Create conversation with campaign
Write-Host "4️⃣  Testing chat with campaign context..." -ForegroundColor Yellow
try {
    $convBody = @{
        campaignId = $CAMPAIGN_ID
    } | ConvertTo-Json
    
    $conversation = Invoke-RestMethod -Uri "$BASE_URL/chat/conversations" -Method Post -Body $convBody -ContentType "application/json"
    $convId = $conversation.data.id
    Write-Host "✅ Created conversation: $convId" -ForegroundColor Green
    Write-Host "   Campaign: $CAMPAIGN_NAME" -ForegroundColor White
    Write-Host ""
    
    # Send test message
    Write-Host "5️⃣  Sending test message..." -ForegroundColor Yellow
    $msgBody = @{
        message = "Show me scenes with humans or people"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat/conversations/$convId/messages" -Method Post -Body $msgBody -ContentType "application/json"
    
    Write-Host "✅ Response received:" -ForegroundColor Green
    Write-Host ""
    Write-Host $response.data.response -ForegroundColor White
    Write-Host ""
    
    # Check context
    if ($response.data.context -and $response.data.context.scenes) {
        $contextSceneCount = $response.data.context.scenes.Count
        Write-Host "📊 Context used: $contextSceneCount scenes" -ForegroundColor Cyan
        
        if ($contextSceneCount -gt 0) {
            Write-Host ""
            Write-Host "Scenes used for context:" -ForegroundColor Cyan
            foreach ($scene in $response.data.context.scenes | Select-Object -First 3) {
                Write-Host "  - $($scene.description)" -ForegroundColor White
            }
        } else {
            Write-Host "⚠️  No scenes were retrieved for context!" -ForegroundColor Yellow
            Write-Host "    This explains why the AI couldn't find anything." -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "❌ Chat test failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "🔍 Debug Summary:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Campaign: $CAMPAIGN_NAME ($CAMPAIGN_ID)" -ForegroundColor White
Write-Host "Videos: $videoCount" -ForegroundColor White
Write-Host ""
Write-Host "If search returned 0 results, check:" -ForegroundColor Yellow
Write-Host "  1. Are videos fully processed (status = 'completed')?" -ForegroundColor Yellow
Write-Host "  2. Were embeddings generated successfully?" -ForegroundColor Yellow
Write-Host "  3. Check backend logs for embedding errors" -ForegroundColor Yellow
Write-Host ""

