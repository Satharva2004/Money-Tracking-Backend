/**
 * GET /api/user/settings - Get user settings
 * PUT /api/user/settings - Update user settings
 */

import { adminDb } from '@/lib/firebase/admin';
import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';

/**
 * GET - Fetch user settings
 */
export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Fetch user profile
    const docRef = adminDb.collection('users').doc(user.uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return errorResponse('User not found', 404);
    }

    const profile = doc.data();

    return successResponse({
      preferences: profile.preferences || {
        notifications: true,
        theme: 'light',
        language: 'en',
      },
      currency: profile.currency || 'USD',
    });

  } catch (error) {
    return handleApiError(error, 'Get User Settings');
  }
}

/**
 * PUT - Update user settings
 */
export async function PUT(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse request body
    const body = await request.json();

    const { preferences, currency } = body;

    // Prepare update data
    const updateData = {
      updatedAt: new Date().toISOString(),
    };

    if (preferences) {
      // Validate preferences object
      const validPreferences = {
        notifications: preferences.notifications !== undefined 
          ? Boolean(preferences.notifications) 
          : true,
        theme: ['light', 'dark', 'auto'].includes(preferences.theme) 
          ? preferences.theme 
          : 'light',
        language: preferences.language || 'en',
        emailNotifications: preferences.emailNotifications !== undefined
          ? Boolean(preferences.emailNotifications)
          : true,
        budgetAlerts: preferences.budgetAlerts !== undefined
          ? Boolean(preferences.budgetAlerts)
          : true,
      };

      updateData.preferences = validPreferences;
    }

    if (currency) {
      // Validate currency format (3-letter code)
      if (!/^[A-Z]{3}$/.test(currency)) {
        return errorResponse('Invalid currency format', 400);
      }
      updateData.currency = currency;
    }

    // Update in Firestore
    await adminDb.collection('users').doc(user.uid).update(updateData);

    return successResponse(
      updateData,
      200,
      'Settings updated successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Update User Settings');
  }
}

/**
 * Example GET Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/user/settings', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 * 
 * Example PUT Request:
 * 
 * fetch('/api/user/settings', {
 *   method: 'PUT',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     preferences: {
 *       notifications: true,
 *       theme: 'dark',
 *       language: 'en',
 *       emailNotifications: false,
 *       budgetAlerts: true
 *     },
 *     currency: 'EUR'
 *   })
 * });
 */
