/**
 * POST /api/auth/login
 * Authenticate user and return custom token
 * Note: Client-side should use Firebase Auth SDK for actual login
 * This endpoint validates credentials and returns user data
 */

import { adminDb } from '../../../lib/firebase/admin';
import { successResponse, errorResponse } from '../../../lib/utils/responseFormatter';
import { handleApiError, validateRequiredFields } from '../../../lib/utils/errorHandler';
import { isValidEmail } from '../../../lib/utils/validators';

export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    validateRequiredFields(body, ['email', 'password']);

    const { email, password } = body;

    // Validate email format
    if (!isValidEmail(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Exchange email/password for Firebase ID token using REST API
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    if (!apiKey) {
      return errorResponse('Firebase API key is not configured', 500);
    }

    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          returnSecureToken: true,
        }),
      }
    );

    const signInData = await signInResponse.json();

    if (!signInResponse.ok) {
      const message = signInData.error?.message || 'Authentication failed';
      return errorResponse(message.replace(/_/g, ' ').toLowerCase(), 401);
    }

    const {
      localId: uid,
      idToken,
      refreshToken,
      expiresIn,
      email: authenticatedEmail,
      displayName,
    } = signInData;

    // Fetch user profile from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return errorResponse('User profile not found', 404);
    }

    const userProfile = userDoc.data();

    // Update last login timestamp
    await adminDb.collection('users').doc(uid).update({
      lastLogin: new Date().toISOString(),
    });

    // Return user data and token
    return successResponse(
      {
        uid,
        email: authenticatedEmail || userProfile.email,
        name: userProfile.name || displayName || null,
        idToken,
        refreshToken,
        expiresIn,
        profile: {
          currency: userProfile.currency,
          monthlyBudget: userProfile.monthlyBudget,
          savingsGoal: userProfile.savingsGoal,
          preferences: userProfile.preferences,
        },
      },
      200,
      'Login successful'
    );

  } catch (error) {
    return handleApiError(error, 'Login');
  }
}

/**
 * Example Request:
 * 
 * fetch('/api/auth/login', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     email: 'user@example.com',
 *     password: 'securePassword123'
 *   })
 * });
 * 
 * Example Response (200):
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": {
 *     "uid": "abc123xyz",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "idToken": "eyJhbGc...",
 *     "profile": {
 *       "currency": "USD",
 *       "monthlyBudget": 5000,
 *       "savingsGoal": 10000,
 *       "preferences": { "notifications": true, "theme": "light" }
 *     }
 *   },
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 */
