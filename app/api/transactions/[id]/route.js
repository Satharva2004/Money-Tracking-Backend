/**
 * GET /api/transactions/[id] - Get a specific transaction
 * PUT /api/transactions/[id] - Update a transaction
 * DELETE /api/transactions/[id] - Delete a transaction
 */

import { adminDb } from '@/lib/firebase/admin';
import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';
import { validateTransaction } from '@/lib/utils/validators';

/**
 * GET - Fetch a specific transaction by ID
 */
export async function GET(request, { params }) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Get transaction ID from params
    const { id } = params;

    // Fetch transaction from Firestore
    const docRef = adminDb.collection('transactions').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return errorResponse('Transaction not found', 404);
    }

    const transaction = doc.data();

    // Verify ownership
    if (transaction.userId !== user.uid) {
      return errorResponse('Access denied', 403);
    }

    return successResponse({
      id: doc.id,
      ...transaction,
    });

  } catch (error) {
    return handleApiError(error, 'Get Transaction');
  }
}

/**
 * PUT - Update a transaction
 */
export async function PUT(request, { params }) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Get transaction ID from params
    const { id } = params;

    // Parse request body
    const body = await request.json();

    // Fetch existing transaction
    const docRef = adminDb.collection('transactions').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return errorResponse('Transaction not found', 404);
    }

    const existingTransaction = doc.data();

    // Verify ownership
    if (existingTransaction.userId !== user.uid) {
      return errorResponse('Access denied', 403);
    }

    // Prepare update data
    const updateData = {
      ...existingTransaction,
      ...body,
      userId: user.uid, // Ensure userId cannot be changed
      updatedAt: new Date().toISOString(),
    };

    // Validate updated transaction
    const validation = validateTransaction(updateData);
    if (!validation.valid) {
      return errorResponse('Validation failed', 400, validation.errors);
    }

    // Update in Firestore
    await docRef.update(updateData);

    return successResponse(
      {
        id,
        ...updateData,
      },
      200,
      'Transaction updated successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Update Transaction');
  }
}

/**
 * DELETE - Delete a transaction
 */
export async function DELETE(request, { params }) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Get transaction ID from params
    const { id } = params;

    // Fetch transaction
    const docRef = adminDb.collection('transactions').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return errorResponse('Transaction not found', 404);
    }

    const transaction = doc.data();

    // Verify ownership
    if (transaction.userId !== user.uid) {
      return errorResponse('Access denied', 403);
    }

    // Delete from Firestore
    await docRef.delete();

    return successResponse(
      { id },
      200,
      'Transaction deleted successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Delete Transaction');
  }
}

/**
 * Example GET Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/transactions/abc123', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 * 
 * Example PUT Request:
 * 
 * fetch('/api/transactions/abc123', {
 *   method: 'PUT',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     amount: 75.00,
 *     description: 'Updated grocery shopping'
 *   })
 * });
 * 
 * Example DELETE Request:
 * 
 * fetch('/api/transactions/abc123', {
 *   method: 'DELETE',
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 */
