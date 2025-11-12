/**
 * GET /api/user/profile - Get user profile
 * PUT /api/user/profile - Update user profile
 */

import { adminDb } from '@/lib/firebase/admin';
import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';
import { validateUserProfile } from '@/lib/utils/validators';

/**
 * GET - Fetch user profile
 */
export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Fetch user profile from Firestore
    const docRef = adminDb.collection('users').doc(user.uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return errorResponse('User profile not found', 404);
    }

    const profile = doc.data();

    return successResponse({
      uid: user.uid,
      email: profile.email,
      name: profile.name,
      currency: profile.currency,
      monthlyBudget: profile.monthlyBudget,
      savingsGoal: profile.savingsGoal,
      preferences: profile.preferences,
      createdAt: profile.createdAt,
      lastLogin: profile.lastLogin,
    });

  } catch (error) {
    return handleApiError(error, 'Get User Profile');
  }
}

/**
 * PUT - Update user profile
 */
export async function PUT(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse request body
    const body = await request.json();

    // Validate profile data
    const validation = validateUserProfile(body);
    if (!validation.valid) {
      return errorResponse('Validation failed', 400, validation.errors);
    }

    // Prepare update data (only allow specific fields)
    const allowedFields = [
      'name',
      'currency',
      'monthlyBudget',
      'savingsGoal',
      'preferences',
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Add updated timestamp
    updateData.updatedAt = new Date().toISOString();

    // Update in Firestore
    const docRef = adminDb.collection('users').doc(user.uid);
    await docRef.update(updateData);

    // Fetch updated profile
    const updatedDoc = await docRef.get();
    const updatedProfile = updatedDoc.data();

    return successResponse(
      {
        uid: user.uid,
        email: updatedProfile.email,
        name: updatedProfile.name,
        currency: updatedProfile.currency,
        monthlyBudget: updatedProfile.monthlyBudget,
        savingsGoal: updatedProfile.savingsGoal,
        preferences: updatedProfile.preferences,
      },
      200,
      'Profile updated successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Update User Profile');
  }
}

/**
 * Example GET Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/user/profile', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 * 
 * Example PUT Request:
 * 
 * fetch('/api/user/profile', {
 *   method: 'PUT',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     name: 'John Doe',
 *     currency: 'EUR',
 *     monthlyBudget: 3000,
 *     savingsGoal: 15000,
 *     preferences: {
 *       notifications: true,
 *       theme: 'dark',
 *       language: 'en'
 *     }
 *   })
 * });
 */
