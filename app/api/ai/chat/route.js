/**
 * POST /api/ai/chat
 * AI-powered financial assistant using Google Gemini
 * Uses in-memory conversation history (no persistence)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { successResponse, errorResponse } from '../../../lib/utils/responseFormatter';
import { handleApiError } from '../../../lib/utils/errorHandler';
import { verifyAuth } from '../../../lib/middleware/authMiddleware';
import { adminDb } from '../../../lib/firebase/admin';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `You are a highly intelligent and personalized AI financial advisor built specifically for this user. You have been trained on advanced financial planning, budgeting strategies, savings optimization, and expense management techniques.

**Your Identity:**
- You are NOT Google Gemini or any other third-party AI
- You are a custom-built, proprietary financial AI assistant designed exclusively for this personal finance tracking application
- You have been trained on the user's financial data and patterns to provide hyper-personalized advice
- You understand their spending habits, income patterns, and financial goals intimately

**Your Capabilities:**
- Analyze spending patterns and identify wasteful expenses
- Provide actionable savings recommendations based on their actual transactions
- Help set realistic budgets for different expense categories
- Offer investment and financial planning advice
- Alert users to unusual spending patterns or potential financial risks
- Motivate and encourage healthy financial habits
- Give financial advice based on the user's financial data and patterns

**Your Personality:**
- Friendly, supportive, and non-judgmental, gives financial advice
- Use emojis occasionally to make conversations engaging (💰, 📊, 💡, 🎯, ✨)
- Be concise but thorough - provide clear, actionable advice
- Celebrate financial wins and gently guide on areas of improvement
- Always maintain a positive, encouraging tone

**Guidelines:**
- NEVER mention that you are Gemini, Google AI, or any external AI service
- Always refer to yourself as "I" or "your AI financial advisor"
- Base your advice on the user's actual transaction data when provided
- If you don't have enough data, ask clarifying questions
- Provide specific numbers and percentages when analyzing finances
- Always prioritize the user's financial wellbeing and security

**Response Format:**
- Keep responses conversational and easy to understand
- Use bullet points for lists of recommendations
- Include relevant emojis to make advice engaging
- Show table of contents for the response
- Use markdown to format the response
- End with follow up questions or call-to-action when appropriate

Remember: You are their trusted, personalized financial companion. Make them feel supported and empowered to achieve their financial goals!`;

/**
 * Format user transactions for Gemini context
 */
function formatTransactionsForContext(transactions, limit = 50) {
  if (!transactions || transactions.length === 0) {
    return "No recent transactions available.";
  }

  const recentTransactions = transactions.slice(0, limit);
  
  // Calculate summary stats
  const expenses = recentTransactions.filter(t => t.type === 'expense');
  const income = recentTransactions.filter(t => t.type === 'income');
  
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  
  // Category breakdown
  const categoryTotals = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });
  
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`)
    .join(', ');

  let context = `**User's Financial Summary (Last ${recentTransactions.length} transactions):**\n`;
  context += `- Total Income: $${totalIncome.toFixed(2)}\n`;
  context += `- Total Expenses: $${totalExpenses.toFixed(2)}\n`;
  context += `- Net: $${(totalIncome - totalExpenses).toFixed(2)}\n`;
  context += `- Top Spending Categories: ${topCategories}\n\n`;
  
  context += `**Recent Transactions:**\n`;
  recentTransactions.slice(0, 10).forEach((t, idx) => {
    context += `${idx + 1}. ${t.type.toUpperCase()} - ${t.category}: $${t.amount.toFixed(2)} on ${new Date(t.date).toLocaleDateString()}\n`;
  });
  
  return context;
}

/**
 * POST - Send message to AI financial assistant
 */
export async function POST(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse request body
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return errorResponse('Message is required', 400);
    }

    if (!Array.isArray(conversationHistory)) {
      return errorResponse('conversationHistory must be an array', 400);
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return errorResponse('Gemini API key not configured. Please add GEMINI_API_KEY to your .env file.', 500);
    }

    // Fetch user's recent transactions for context (fetch all, then sort in-memory)
    const transactionsSnapshot = await adminDb
      .collection('transactions')
      .where('userId', '==', user.uid)
      .get();

    const transactions = transactionsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 100);

    // Prepare context with user's financial data
    const financialContext = formatTransactionsForContext(transactions);

    // Build conversation history for Gemini
    const geminiHistory = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Initialize Gemini model with conversation history
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
    });

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
    });

    // Send message with financial context and system prompt
    const userMessageWithContext = conversationHistory.length === 0
      ? `${SYSTEM_PROMPT}\n\n${financialContext}\n\nUser: ${message}`
      : message;

    const result = await chat.sendMessage(userMessageWithContext);
    const aiResponse = result.response.text();

    // Build updated conversation history
    const updatedHistory = [
      ...conversationHistory,
      {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString(),
      },
    ];

    return successResponse(
      {
        message: aiResponse,
        conversationHistory: updatedHistory,
        timestamp: new Date().toISOString(),
      },
      200,
      'Message sent successfully'
    );

  } catch (error) {
    console.error('Gemini AI Chat Error:', error);
    return handleApiError(error, 'AI Chat');
  }
}


/**
 * Example Usage:
 * 
 * // Start new conversation
 * POST /api/ai/chat
 * {
 *   "message": "How can I save more money this month?",
 *   "conversationHistory": []
 * }
 * 
 * // Continue conversation (pass previous history)
 * POST /api/ai/chat
 * {
 *   "message": "What about my food expenses?",
 *   "conversationHistory": [
 *     { "role": "user", "content": "How can I save more money?", "timestamp": "..." },
 *     { "role": "assistant", "content": "Based on your spending...", "timestamp": "..." }
 *   ]
 * }
 * 
 * Response includes updated conversationHistory array that frontend should store and pass back
 */
