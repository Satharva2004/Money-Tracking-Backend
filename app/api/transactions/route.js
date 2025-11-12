/**
 * GET /api/transactions - Get all transactions for authenticated user
 * POST /api/transactions - Create a new transaction
 */

import { adminDb } from '@/lib/firebase/admin';
import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError, validateRequiredFields } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';
import { validateTransaction, validatePagination } from '@/lib/utils/validators';

/**
 * GET - Fetch all transactions with filtering and pagination
 */
export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // income, expense, savings
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 10;

    // Validate pagination
    const { page: validPage, limit: validLimit } = validatePagination(page, limit);

    // Build Firestore query
    const snapshot = await adminDb
      .collection('transactions')
      .where('userId', '==', user.uid)
      .get();

    const allTransactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Apply in-memory filtering to avoid composite index requirements
    const filteredTransactions = allTransactions.filter(transaction => {
      if (type && ['income', 'expense', 'savings'].includes(type) && transaction.type !== type) {
        return false;
      }
      if (category && transaction.category !== category) {
        return false;
      }
      if (startDate && new Date(transaction.date) < new Date(startDate)) {
        return false;
      }
      if (endDate && new Date(transaction.date) > new Date(endDate)) {
        return false;
      }
      return true;
    });

    // Sort by date descending
    const transactions = filteredTransactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Apply pagination
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    // Calculate summary statistics
    const summary = {
      totalIncome: transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0),
      totalExpenses: transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
      totalSavings: transactions
        .filter(t => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0),
      count: transactions.length,
    };

    return successResponse({
      transactions: paginatedTransactions,
      summary,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: transactions.length,
        totalPages: Math.ceil(transactions.length / validLimit),
      },
    });

  } catch (error) {
    return handleApiError(error, 'Get Transactions');
  }
}

/**
 * POST - Create a new transaction
 */
export async function POST(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse request body
    const body = await request.json();

    // Validate required fields
    validateRequiredFields(body, ['type', 'amount', 'category', 'description']);

    // Validate transaction data
    const validation = validateTransaction(body);
    if (!validation.valid) {
      return errorResponse('Validation failed', 400, validation.errors);
    }

    // Create transaction object
    const transaction = {
      userId: user.uid,
      type: body.type,
      amount: parseFloat(body.amount),
      category: body.category.trim(),
      description: body.description.trim(),
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
      tags: body.tags || [],
      recurring: body.recurring || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Firestore
    const docRef = await adminDb.collection('transactions').add(transaction);

    // Return created transaction
    return successResponse(
      {
        id: docRef.id,
        ...transaction,
      },
      201,
      'Transaction created successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Create Transaction');
  }
}

/**
 * Example GET Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/transactions?type=expense&page=1&limit=10', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 * 
 * Example POST Request:
 * 
 * fetch('/api/transactions', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     type: 'expense',
 *     amount: 50.00,
 *     category: 'Food',
 *     description: 'Grocery shopping',
 *     date: '2024-01-15',
 *     tags: ['groceries', 'weekly']
 *   })
 * });
 */
