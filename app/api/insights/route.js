/**
 * GET /api/insights - Generate AI-powered financial insights
 * POST /api/insights - Save user feedback on insights
 */

import { adminDb } from '../../../lib/firebase/admin';
import { successResponse, errorResponse } from '../../../lib/utils/responseFormatter';
import { handleApiError } from '../../../lib/utils/errorHandler';
import { verifyAuth } from '../../../lib/middleware/authMiddleware';
import { generateInsights } from '../../../lib/ai/insightsEngine';

/**
 * GET - Generate AI insights based on user's financial data
 */
export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // month, quarter, year
    const includeHistory = searchParams.get('includeHistory') === 'true';

    // Fetch user profile
    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      return errorResponse('User profile not found', 404);
    }
    const userProfile = userDoc.data();

    // Calculate date range based on period
    const endDate = new Date();
    let startDate;

    switch (period) {
      case 'quarter':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
    }

    // Fetch transactions for the period
    const transactionsSnapshot = await adminDb
      .collection('transactions')
      .where('userId', '==', user.uid)
      .where('date', '>=', startDate.toISOString())
      .where('date', '<=', endDate.toISOString())
      .orderBy('date', 'desc')
      .get();

    const transactions = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Generate AI insights
    const insights = await generateInsights(transactions, userProfile);

    // Optionally fetch historical insights
    let historicalInsights = null;
    if (includeHistory) {
      const historySnapshot = await adminDb
        .collection('insights')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      historicalInsights = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    }

    // Save generated insights to Firestore for history
    const insightDoc = {
      userId: user.uid,
      period,
      insights,
      createdAt: new Date().toISOString(),
      transactionCount: transactions.length,
    };

    await adminDb.collection('insights').add(insightDoc);

    // Return insights
    return successResponse({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      insights,
      historicalInsights,
      metadata: {
        transactionCount: transactions.length,
        generatedAt: new Date().toISOString(),
        aiEnabled: process.env.AI_INSIGHTS_ENABLED === 'true',
      },
    });

  } catch (error) {
    return handleApiError(error, 'Generate Insights');
  }
}

/**
 * POST - Save user feedback on insights
 */
export async function POST(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse request body
    const body = await request.json();
    const { insightId, feedback, rating, helpful } = body;

    if (!insightId) {
      return errorResponse('Insight ID is required', 400);
    }

    // Update insight with feedback
    const insightRef = adminDb.collection('insights').doc(insightId);
    const insightDoc = await insightRef.get();

    if (!insightDoc.exists) {
      return errorResponse('Insight not found', 404);
    }

    const insightData = insightDoc.data();

    // Verify ownership
    if (insightData.userId !== user.uid) {
      return errorResponse('Access denied', 403);
    }

    // Save feedback
    await insightRef.update({
      feedback: {
        rating: rating || null,
        helpful: helpful !== undefined ? Boolean(helpful) : null,
        comment: feedback || null,
        submittedAt: new Date().toISOString(),
      },
    });

    return successResponse(
      { insightId, feedbackSaved: true },
      200,
      'Feedback saved successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Save Insight Feedback');
  }
}

/**
 * Example GET Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/insights?period=month&includeHistory=true', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 * 
 * Example Response:
 * {
 *   "success": true,
 *   "data": {
 *     "period": "month",
 *     "insights": {
 *       "summary": {
 *         "monthlyIncome": 5000,
 *         "monthlyExpenses": 3200,
 *         "savingsRate": 15.5
 *       },
 *       "recommendations": [
 *         {
 *           "type": "reduce_spending",
 *           "priority": "high",
 *           "category": "Food",
 *           "message": "Your Food expenses are 35% of total spending...",
 *           "potentialSavings": 240
 *         }
 *       ],
 *       "predictions": {
 *         "nextMonthExpenses": 3150,
 *         "confidence": 0.75,
 *         "trend": "stable"
 *       },
 *       "spendingScore": 72
 *     }
 *   }
 * }
 * 
 * Example POST Request (Feedback):
 * 
 * fetch('/api/insights', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     insightId: 'insight_abc123',
 *     rating: 5,
 *     helpful: true,
 *     feedback: 'Very helpful recommendations!'
 *   })
 * });
 */
