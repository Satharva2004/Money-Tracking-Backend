/**
 * POST /api/auth/register
 * Register a new user with email and password
 */

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError, validateRequiredFields } from '@/lib/utils/errorHandler';
import { isValidEmail, validatePassword, sanitizeString } from '@/lib/utils/validators';

export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    validateRequiredFields(body, ['email', 'password', 'name']);

    const { email, password, name } = body;

    // Validate email format
    if (!isValidEmail(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return errorResponse(passwordValidation.message, 400);
    }

    // Sanitize name input
    const sanitizedName = sanitizeString(name);
    if (!sanitizedName || sanitizedName.length < 2) {
      return errorResponse('Name must be at least 2 characters', 400);
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: email.toLowerCase().trim(),
      password,
      displayName: sanitizedName,
      emailVerified: false,
    });

    // Create user profile in Firestore
    const userProfile = {
      uid: userRecord.uid,
      email: userRecord.email,
      name: sanitizedName,
      currency: 'INR',
      monthlyBudget: 0,
      savingsGoal: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en',
      },
    };

    await adminDb.collection('users').doc(userRecord.uid).set(userProfile);

    const now = new Date();
    const defaultBudgetDocId = `${userRecord.uid}_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
    await adminDb.collection('budgets').doc(defaultBudgetDocId).set({
      monthlyBudget: 0,
      savingsGoal: 0,
      categoryBudgets: {},
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      userId: userRecord.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Return success response (without password)
    return successResponse(
      {
        uid: userRecord.uid,
        email: userRecord.email,
        name: sanitizedName,
      },
      201,
      'User registered successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Register');
  }
}

/**
 * Example Request:
 * 
 * fetch('/api/auth/register', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     email: 'user@example.com',
 *     password: 'securePassword123',
 *     name: 'John Doe'
 *   })
 * });
 * 
 * Example Response (201):
 * {
 *   "success": true,
 *   "message": "User registered successfully",
 *   "data": {
 *     "uid": "abc123xyz",
 *     "email": "user@example.com",
 *     "name": "John Doe"
 *   },
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 */
