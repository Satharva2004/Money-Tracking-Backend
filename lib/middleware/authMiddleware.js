/**
 * Authentication Middleware
 * Verifies Firebase ID tokens and attaches user info to request
 */

import { adminAuth } from '../firebase/admin.js';
import { errorResponse } from '../utils/responseFormatter.js';

/**
 * Verify Firebase ID token from Authorization header
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object>} - Decoded token with user info
 */
export async function verifyAuth(request) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No authorization token provided');
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      throw new Error('Invalid token format');
    }

    // Verify the token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
    };
  } catch (error) {
    console.error('Auth verification error:', error.message);
    throw new Error('Unauthorized: Invalid or expired token');
  }
}

/**
 * Middleware wrapper for protected routes
 * @param {Function} handler - Route handler function
 * @returns {Function} - Wrapped handler with auth check
 */
export function withAuth(handler) {
  return async (request, context) => {
    try {
      // Verify authentication
      const user = await verifyAuth(request);
      
      // Attach user to request context
      request.user = user;
      
      // Call the actual handler
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error.message, 401);
    }
  };
}

/**
 * Extract user ID from request (after auth middleware)
 * @param {Request} request - Next.js request object
 * @returns {string} - User ID
 */
export function getUserId(request) {
  return request.user?.uid;
}
