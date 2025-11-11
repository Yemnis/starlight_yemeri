# 🤖 Chat System Guide - Query Your Video Campaigns

## 📚 Overview

Your chat system uses **RAG (Retrieval-Augmented Generation)** to intelligently answer questions about your video campaigns. It:

1. **Searches** your video database using semantic similarity
2. **Retrieves** relevant scenes (up to 10 most relevant)
3. **Generates** answers using Gemini Pro with the retrieved context

---

## 🚀 How to Use

### **Option 1: Using the Frontend (UI)**

1. Navigate to the **Chat** page in your web app
2. Start typing your question
3. Get AI-powered answers with scene references!

### **Option 2: Using the API Directly**

**Base URL:** `http://localhost:3001/api/v1`

#### **1. Create a Conversation**

```bash
curl -X POST http://localhost:3001/api/v1/chat/conversations \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "optional-campaign-id-here"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conv-uuid-here",
    "campaignId": "campaign-123",
    "messages": [],
    "createdAt": "2025-11-11T16:00:00Z",
    "updatedAt": "2025-11-11T16:00:00Z"
  }
}
```

#### **2. Send a Message**

```bash
curl -X POST http://localhost:3001/api/v1/chat/conversations/{conversationId}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me all scenes with people driving cars"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-uuid-here",
    "response": "I found 3 scenes featuring people driving cars:\n\n1. Scene in video abc123 (15.2s-18.7s): A man with curly hair driving, looking focused forward...",
    "context": {
      "scenes": [...],  // Relevant scene data
      "videos": [...]
    },
    "timestamp": "2025-11-11T16:00:00Z"
  }
}
```

#### **3. List Conversations**

```bash
# All conversations
curl http://localhost:3001/api/v1/chat/conversations

# Filter by campaign
curl "http://localhost:3001/api/v1/chat/conversations?campaignId=campaign-123"

# Limit results
curl "http://localhost:3001/api/v1/chat/conversations?limit=10"
```

#### **4. Get Conversation History**

```bash
curl http://localhost:3001/api/v1/chat/conversations/{conversationId}
```

#### **5. Delete a Conversation**

```bash
curl -X DELETE http://localhost:3001/api/v1/chat/conversations/{conversationId}
```

---

## 💬 What You Can Ask

### **1. Content Discovery**

```
"Show me all scenes with products"
"Find scenes where people are smiling"
"Which videos have outdoor settings?"
"Show me all car-related scenes"
```

### **2. Mood & Emotion Analysis**

```
"What's the overall mood of my campaign?"
"Show me energetic scenes"
"Find calm and professional moments"
"Which scenes are playful?"
```

### **3. Visual Elements**

```
"What visual elements appear most frequently?"
"Find scenes with text overlays"
"Show me scenes with call-to-action buttons"
"Which scenes feature the product prominently?"
```

### **4. Campaign Comparison**

```
"Compare the mood across different videos"
"What are the dominant colors in this campaign?"
"How many scenes mention the product name?"
```

### **5. Specific Queries**

```
"Find the scene where someone touches their hair"
"Show me scenes between 10-20 seconds"
"What happens at timestamp 15 seconds in video X?"
"Find scenes with high confidence scores"
```

### **6. Insights & Analytics**

```
"What are the key themes in this campaign?"
"Summarize the main message"
"What emotions are being conveyed?"
"How does the story progress?"
```

### **7. Action-Oriented**

```
"Which scenes would work best as thumbnails?"
"Suggest scenes for a highlight reel"
"What scenes have the strongest call-to-action?"
```

---

## 🎯 What You Get Back

### **Response Format**

The AI will provide:

1. **Conversational Answer**: Human-readable response
2. **Scene References**: Specific timestamps and video IDs
3. **Context Data**: Full scene details with:
   - Description
   - Visual elements
   - Actions
   - Mood
   - Transcript
   - Timestamps
   - Thumbnails

### **Example Response**

**Your Question:**
```
"Show me scenes with people in cars"
```

**AI Response:**
```
I found 3 relevant scenes featuring people in cars:

1. **Video abc123** (15.2s-18.7s)
   - A man with curly hair driving, looking intently forward
   - Mood: focused, professional
   - Visual elements: car interior, steering wheel, person
   - Transcript: "Every journey starts with..."

2. **Video abc123** (45.1s-48.3s)
   - Close-up of hands on steering wheel
   - Mood: calm, confident
   - Visual elements: hands, wheel, dashboard

3. **Video def456** (8.5s-12.1s)
   - Woman adjusting rear-view mirror
   - Mood: thoughtful, serene
   - Visual elements: mirror, face reflection, car interior

All of these scenes convey a sense of control and journey, which could work well for your automotive campaign messaging.
```

---

## 🎨 Context Filtering

### **Campaign-Specific Queries**

When creating a conversation with a `campaignId`, the system will **only search within that campaign's videos**:

```json
{
  "campaignId": "campaign-summer-2025"
}
```

Then all your questions will be scoped to that campaign!

### **Global Queries**

Omit `campaignId` to search across **all your videos**:

```json
{}  // No campaignId = search everything
```

---

## 🧠 How RAG Works Behind the Scenes

1. **Your Question** → Converted to embedding vector
2. **Semantic Search** → Finds top 10 similar scene embeddings
3. **Context Building** → Retrieves full scene data
4. **Prompt Construction** → Combines your question + scene context
5. **AI Generation** → Gemini Pro generates intelligent answer
6. **Response** → Returns answer with scene references

**Technologies:**
- **Embeddings**: Vertex AI Text Embeddings (768-dim vectors)
- **Storage**: Firestore with vector similarity search
- **LLM**: Gemini 1.5 Pro for response generation

---

## 📊 Advanced Usage Examples

### **Multi-Turn Conversations**

The chat maintains context across messages:

```
You: "Show me energetic scenes"
AI: [Shows energetic scenes]

You: "Which of those have music?"
AI: [Filters previous results]

You: "Create a 30-second highlight from these"
AI: [Suggests specific scenes and ordering]
```

### **Complex Queries**

```
"Find scenes with:
- People smiling or laughing
- Outdoor settings
- Duration between 5-15 seconds
- High confidence scores"
```

### **Creative Requests**

```
"Write a script connecting these scenes into a story"
"Suggest B-roll footage I might be missing"
"What emotions would enhance this campaign?"
```

---

## 🔍 Search Quality

### **What Makes Good Queries**

✅ **Specific:** "Show me scenes with red cars" (not "show me stuff")
✅ **Descriptive:** "Find moments where people look excited"
✅ **Contextual:** "Which scenes work for a luxury brand?"

### **The System Understands:**

- **Synonyms**: "car" = "vehicle" = "automobile"
- **Concepts**: "happy" = "smiling" = "joyful"
- **Visual descriptions**: "close-up" = "detailed shot"
- **Emotional tones**: "energetic" = "dynamic" = "fast-paced"

---

## 🛠️ Troubleshooting

### **No relevant scenes found**

- Make sure videos are fully processed
- Try broader queries first, then narrow down
- Check that embeddings were generated successfully

### **Slow responses**

- System retrieves 10 scenes and generates with Gemini Pro
- Typical response time: 3-7 seconds
- Rate limiting ensures API stability

### **Generic answers**

- System falls back if no relevant context found
- Upload more videos for better coverage
- Make queries more specific

---

## 📈 Performance Tips

1. **Start broad, then narrow**: "Show me all product scenes" → "Show me close-ups of the product"
2. **Use campaign filters**: Scope to specific campaigns for faster, more relevant results
3. **Reference previous answers**: "Tell me more about scene 3" (uses conversation history)
4. **Ask for summaries**: "Summarize the key themes" (gets high-level insights)

---

## 🎯 Real-World Use Cases

### **For Marketers:**
- Find best scenes for social media cuts
- Identify brand messaging consistency
- Discover content gaps

### **For Video Editors:**
- Quick scene lookup by description
- Find matching footage across campaigns
- Build storyboards from existing content

### **For Analysts:**
- Track visual trends
- Measure emotional impact
- Audit brand guidelines compliance

---

## 🚀 Next Steps

1. **Upload videos** to your campaigns
2. **Wait for processing** (scene analysis + embeddings)
3. **Start chatting** with natural language queries
4. **Get insights** from your video content!

---

**Questions?** The chat system is designed to understand natural language - just ask like you're talking to a colleague! 🎬✨

