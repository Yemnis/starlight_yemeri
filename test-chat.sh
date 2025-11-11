#!/bin/bash

# Chat API Testing Script
# Usage: ./test-chat.sh

BASE_URL="http://localhost:3001/api/v1"

echo "🤖 Testing Starlight Chat API"
echo "==============================="
echo ""

# Test 1: Create Conversation
echo "1️⃣  Creating conversation..."
CONV_RESPONSE=$(curl -s -X POST "$BASE_URL/chat/conversations" \
  -H "Content-Type: application/json" \
  -d '{}')

CONV_ID=$(echo $CONV_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

if [ -z "$CONV_ID" ]; then
  echo "❌ Failed to create conversation"
  echo "Response: $CONV_RESPONSE"
  exit 1
fi

echo "✅ Conversation created: $CONV_ID"
echo ""

# Test 2: Send Message
echo "2️⃣  Sending message..."
MSG_RESPONSE=$(curl -s -X POST "$BASE_URL/chat/conversations/$CONV_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What scenes do you have in the database?"
  }')

echo "✅ Response received:"
echo "$MSG_RESPONSE" | jq -r '.data.response' 2>/dev/null || echo "$MSG_RESPONSE"
echo ""

# Test 3: Get Conversation History
echo "3️⃣  Getting conversation history..."
HISTORY=$(curl -s "$BASE_URL/chat/conversations/$CONV_ID")
MSG_COUNT=$(echo $HISTORY | jq -r '.data.messages | length' 2>/dev/null || echo "0")
echo "✅ Conversation has $MSG_COUNT messages"
echo ""

# Test 4: List Conversations
echo "4️⃣  Listing all conversations..."
ALL_CONVS=$(curl -s "$BASE_URL/chat/conversations?limit=5")
CONV_COUNT=$(echo $ALL_CONVS | jq -r '.data | length' 2>/dev/null || echo "0")
echo "✅ Found $CONV_COUNT conversations"
echo ""

# Test 5: Ask a specific question
echo "5️⃣  Asking specific question..."
SPECIFIC_RESPONSE=$(curl -s -X POST "$BASE_URL/chat/conversations/$CONV_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me scenes with people"
  }')

echo "✅ Response:"
echo "$SPECIFIC_RESPONSE" | jq -r '.data.response' 2>/dev/null || echo "$SPECIFIC_RESPONSE"
echo ""

echo "=============================="
echo "🎉 All tests completed!"
echo ""
echo "Conversation ID: $CONV_ID"
echo "You can continue chatting at:"
echo "  POST $BASE_URL/chat/conversations/$CONV_ID/messages"
echo ""

