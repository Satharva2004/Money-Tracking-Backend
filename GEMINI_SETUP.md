# Gemini AI Chat Setup Guide

## Overview
The AI Chat Assistant uses Google's Gemini Pro model to provide personalized financial advice based on user transaction data. The AI maintains conversation history and presents itself as a proprietary financial advisor (never mentioning it's Gemini).

## Features
- 💬 **Conversational AI**: Natural language financial advice
- 🧠 **Context-Aware**: Analyzes user's actual transactions
- 📊 **Personalized**: Tailored recommendations based on spending patterns
- 💾 **Memory**: Maintains conversation history in Firestore
- 🔒 **Secure**: User-specific conversations with authentication

## Setup Instructions

### 1. Get Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API Key"** or **"Create API Key"**
4. Copy your API key

### 2. Add API Key to Environment

Open your `.env` file and add:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

Replace `your_actual_api_key_here` with the API key you copied.

### 3. Install Dependencies

Run the following command to install the Gemini SDK:

```bash
npm install @google/generative-ai
# or
bun install @google/generative-ai
```

### 4. Conversation Storage

**Important:** Conversations are NOT stored in Firestore. The API uses an in-memory approach where:
- Frontend manages conversation history in component state or localStorage
- Each request includes the full `conversationHistory` array
- Response returns updated history array for frontend to store
- No server-side persistence = simpler implementation, no database costs

## API Endpoints

### POST /api/ai/chat
Send a message to the AI assistant.

**Request:**
```json
{
  "message": "How can I reduce my food expenses?",
  "conversationHistory": []  // Empty for new conversation
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "AI response here...",
    "conversationHistory": [
      { "role": "user", "content": "How can I reduce...", "timestamp": "..." },
      { "role": "assistant", "content": "AI response...", "timestamp": "..." }
    ],
    "timestamp": "2025-11-13T00:15:42.100Z"
  }
}
```

**Note:** Only POST endpoint is available. No GET/DELETE needed since conversations aren't persisted.

## System Prompt

The AI is configured with a comprehensive system prompt that:
- Positions it as a proprietary, custom-built financial advisor
- Never mentions being Gemini or Google AI
- Analyzes user's actual transaction data
- Provides actionable, personalized advice
- Uses a friendly, supportive tone with emojis
- Focuses on savings, budgeting, and financial wellness

## Transaction Context

On the first message of each conversation, the AI receives:
- Total income and expenses
- Top 5 spending categories
- Last 10 recent transactions
- Net cash flow

This context enables highly personalized recommendations.

## Example Conversation Flow

**Frontend Implementation:**

```javascript
// Component state to store conversation
const [conversationHistory, setConversationHistory] = useState([]);

// Start new conversation
const sendMessage = async (userMessage) => {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      message: userMessage,
      conversationHistory: conversationHistory
    })
  });

  const data = await response.json();
  
  // Update state with new history
  setConversationHistory(data.data.conversationHistory);
  
  return data.data.message;
};

// Clear conversation
const clearChat = () => {
  setConversationHistory([]);
};
```

## Cost Considerations

- Gemini Pro API has a free tier with generous limits
- Each conversation message counts as 1 API call
- Monitor usage at [Google AI Studio](https://makersuite.google.com/)
- Consider implementing rate limiting for production

## Troubleshooting

### Error: "Gemini API key not configured"
- Ensure `GEMINI_API_KEY` is set in `.env`
- Restart your dev server after adding the key
- Verify the key is not set to the placeholder value

### Error: "API key invalid"
- Double-check your API key from Google AI Studio
- Ensure there are no extra spaces or quotes
- Regenerate the key if necessary

### Conversation context lost
- Ensure you're passing `conversationHistory` from previous response
- Check that frontend state management is working correctly
- Verify array is being stored and passed correctly

## Best Practices

1. **Rate Limiting**: Implement rate limiting to prevent API abuse
2. **Error Handling**: Always handle API errors gracefully
3. **User Feedback**: Show loading states during AI responses
4. **Privacy**: Never log sensitive financial data
5. **Testing**: Test with various transaction scenarios

## Advanced Configuration

You can customize the AI's behavior in `/app/api/ai/chat/route.js`:

```javascript
generationConfig: {
  maxOutputTokens: 1000,  // Max response length
  temperature: 0.7,        // Creativity (0-1)
  topP: 0.8,              // Nucleus sampling
  topK: 40,               // Top-k sampling
}
```

## Support

For issues or questions:
- Check the [Gemini API Documentation](https://ai.google.dev/docs)
- Review Firestore logs for errors
- Ensure all dependencies are installed

---

**Note**: The AI is designed to never reveal it's Gemini. It presents itself as a proprietary, custom-trained financial advisor built specifically for your app.
