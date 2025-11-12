/**
 * POST /api/auth/logout
 * Logout user and revoke refresh tokens
 */

import { adminAuth } from '@/lib/firebase/admin';
import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';

export async function POST(request) {
  try {
    // Verify user is authenticated
    const user = await verifyAuth(request);

    // Revoke all refresh tokens for the user
    // This will force the user to re-authenticate
    await adminAuth.revokeRefreshTokens(user.uid);

    // Optional: Update user's last logout timestamp
    // await adminDb.collection('users').doc(user.uid).update({
    //   lastLogout: new Date().toISOString(),
    // });

    return successResponse(
      { uid: user.uid },
      200,
      'Logout successful'
    );

  } catch (error) {
    // If auth fails, still return success (user is effectively logged out)
    if (error.message.includes('Unauthorized')) {
      return successResponse(null, 200, 'Already logged out');
    }
    return handleApiError(error, 'Logout');
  }
}

/**
 * Example Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/auth/logout', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   }
 * });
 * 
 * Example Response (200):
 * {
 *   "success": true,
 *   "message": "Logout successful",
 *   "data": {
 *     "uid": "abc123xyz"
 *   },
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 */
