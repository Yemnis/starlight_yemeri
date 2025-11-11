# Chat API Testing Script (PowerShell)
# Usage: .\test-chat.ps1

$BASE_URL = "http://localhost:3001/api/v1"

Write-Host "🤖 Testing Starlight Chat API" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Create Conversation
Write-Host "1️⃣  Creating conversation..." -ForegroundColor Yellow
$convBody = @{} | ConvertTo-Json
$convResponse = Invoke-RestMethod -Uri "$BASE_URL/chat/conversations" -Method Post -Body $convBody -ContentType "application/json"
$CONV_ID = $convResponse.data.id

if (-not $CONV_ID) {
    Write-Host "❌ Failed to create conversation" -ForegroundColor Red
    Write-Host "Response: $convResponse"
    exit 1
}

Write-Host "✅ Conversation created: $CONV_ID" -ForegroundColor Green
Write-Host ""

# Test 2: Send Message
Write-Host "2️⃣  Sending message..." -ForegroundColor Yellow
$msgBody = @{
    message = "What scenes do you have in the database?"
} | ConvertTo-Json

$msgResponse = Invoke-RestMethod -Uri "$BASE_URL/chat/conversations/$CONV_ID/messages" -Method Post -Body $msgBody -ContentType "application/json"

Write-Host "✅ Response received:" -ForegroundColor Green
Write-Host $msgResponse.data.response
Write-Host ""

# Test 3: Get Conversation History
Write-Host "3️⃣  Getting conversation history..." -ForegroundColor Yellow
$history = Invoke-RestMethod -Uri "$BASE_URL/chat/conversations/$CONV_ID" -Method Get
$msgCount = $history.data.messages.Count
Write-Host "✅ Conversation has $msgCount messages" -ForegroundColor Green
Write-Host ""

# Test 4: List Conversations
Write-Host "4️⃣  Listing all conversations..." -ForegroundColor Yellow
$allConvs = Invoke-RestMethod -Uri "$BASE_URL/chat/conversations?limit=5" -Method Get
$convCount = $allConvs.data.Count
Write-Host "✅ Found $convCount conversations" -ForegroundColor Green
Write-Host ""

# Test 5: Ask a specific question
Write-Host "5️⃣  Asking specific question..." -ForegroundColor Yellow
$specificBody = @{
    message = "Show me scenes with people"
} | ConvertTo-Json

$specificResponse = Invoke-RestMethod -Uri "$BASE_URL/chat/conversations/$CONV_ID/messages" -Method Post -Body $specificBody -ContentType "application/json"

Write-Host "✅ Response:" -ForegroundColor Green
Write-Host $specificResponse.data.response
Write-Host ""

Write-Host "===============================" -ForegroundColor Cyan
Write-Host "🎉 All tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Conversation ID: $CONV_ID"
Write-Host "You can continue chatting at:"
Write-Host "  POST $BASE_URL/chat/conversations/$CONV_ID/messages"
Write-Host ""

