/**
 * GET /api/auth/verify
 * Verify if the current token is valid
 */

import { successResponse } from '@/lib/utils/responseFormatter';
import { handleApiError } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';

export async function GET(request) {
  try {
    // Verify authentication token
    const user = await verifyAuth(request);

    return successResponse(
      {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
      },
      200,
      'Token is valid'
    );

  } catch (error) {
    return handleApiError(error, 'Verify Token');
  }
}

/**
 * Example Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/auth/verify', {
 *   method: 'GET',
 *   headers: {
 *     'Authorization': `Bearer ${idToken}`
 *   }
 * });
 * 
 * Example Response (200):
 * {
 *   "success": true,
 *   "message": "Token is valid",
 *   "data": {
 *     "uid": "abc123xyz",
 *     "email": "user@example.com",
 *     "emailVerified": true,
 *     "name": "John Doe"
 *   },
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 */
