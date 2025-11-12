/**
 * GET /api/insights/history - Get historical insights
 */

import { adminDb } from '@/lib/firebase/admin';
import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';
import { validatePagination } from '@/lib/utils/validators';

export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 10;

    // Validate pagination
    const { page: validPage, limit: validLimit } = validatePagination(page, limit);

    // Fetch historical insights
    const snapshot = await adminDb
      .collection('insights')
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(validLimit)
      .get();

    const insights = snapshot.docs.map(doc => ({
      id: doc.id,
      period: doc.data().period,
      summary: doc.data().insights?.summary,
      spendingScore: doc.data().insights?.spendingScore,
      recommendationCount: doc.data().insights?.recommendations?.length || 0,
      createdAt: doc.data().createdAt,
      feedback: doc.data().feedback || null,
    }));

    return successResponse({
      insights,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: insights.length,
      },
    });

  } catch (error) {
    return handleApiError(error, 'Get Insights History');
  }
}

/**
 * Example Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/insights/history?page=1&limit=10', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 */
