/**
 * Centralized Error Handler
 * Handles and logs errors consistently across the application
 */

import { errorResponse } from './responseFormatter';

/**
 * Handle API errors and return appropriate response
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @returns {NextResponse}
 */
export function handleApiError(error, context = 'API') {
  console.error(`[${context}] Error:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // Firebase Auth errors
  if (error.code?.startsWith('auth/')) {
    return handleFirebaseAuthError(error);
  }

  // Firestore errors
  if (error.code?.startsWith('firestore/')) {
    return handleFirestoreError(error);
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return errorResponse(error.message, 400);
  }

  // Default server error
  return errorResponse(
    process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Internal server error',
    500
  );
}

/**
 * Handle Firebase Authentication errors
 * @param {Error} error - Firebase auth error
 * @returns {NextResponse}
 */
function handleFirebaseAuthError(error) {
  const errorMessages = {
    'auth/email-already-exists': 'Email already registered',
    'auth/invalid-email': 'Invalid email address',
    'auth/invalid-password': 'Password must be at least 6 characters',
    'auth/user-not-found': 'User not found',
    'auth/wrong-password': 'Invalid credentials',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/weak-password': 'Password is too weak',
    'auth/id-token-expired': 'Session expired. Please refresh your session',
    'auth/unauthorized': 'Unauthorized: Invalid or expired token',
  };

  const message = errorMessages[error.code] || 'Authentication error';

  // Expired/unauthorized tokens should return 401 so the client
  // can trigger token refresh instead of treating it as a generic error.
  if (error.code === 'auth/id-token-expired' || error.code === 'auth/unauthorized') {
    return errorResponse(message, 401);
  }

  return errorResponse(message, 400);
}

/**
 * Handle Firestore errors
 * @param {Error} error - Firestore error
 * @returns {NextResponse}
 */
function handleFirestoreError(error) {
  const errorMessages = {
    'firestore/permission-denied': 'Permission denied',
    'firestore/not-found': 'Document not found',
    'firestore/already-exists': 'Document already exists',
    'firestore/unavailable': 'Service temporarily unavailable',
  };

  const message = errorMessages[error.code] || 'Database error';
  return errorResponse(message, 500);
}

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {Array<string>} requiredFields - Array of required field names
 * @throws {Error} - Validation error if fields are missing
 */
export function validateRequiredFields(body, requiredFields) {
  const missingFields = requiredFields.filter(field => !body[field]);
  
  if (missingFields.length > 0) {
    const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
    error.name = 'ValidationError';
    throw error;
  }
}
