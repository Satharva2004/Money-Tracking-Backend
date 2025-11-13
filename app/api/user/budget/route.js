/**
 * GET /api/user/budget - Get budget status and progress
 * POST /api/user/budget - Set or update budget goals
 */

import { adminDb } from '@/lib/firebase/admin';
import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError, validateRequiredFields } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';

/**
 * GET - Get budget status and spending progress
 */
export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    const now = new Date();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 1970) {
      return errorResponse('Invalid month or year provided', 400);
    }

    // Fetch user profile for budget info
    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const userProfile = userDoc.data();

    // Fetch monthly budget document (per user, per month)
    const budgetDocId = `${user.uid}_${year}_${String(month).padStart(2, '0')}`;
    const budgetDocRef = adminDb.collection('budgets').doc(budgetDocId);
    const budgetDoc = await budgetDocRef.get();
    const monthlyBudget = budgetDoc.exists ? budgetDoc.data().monthlyBudget : 0;

    // Calculate date range for current month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Fetch transactions for the month
    const snapshot = await adminDb
      .collection('transactions')
      .where('userId', '==', user.uid)
      .get();

    const transactions = snapshot.docs
      .map(doc => doc.data())
      .filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });

    // Calculate spending by category
    const categorySpending = {};
    let totalSpent = 0;

    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const category = transaction.category;
        if (!categorySpending[category]) {
          categorySpending[category] = 0;
        }
        categorySpending[category] += transaction.amount;
        totalSpent += transaction.amount;
      });

    // Calculate budget status
    const remaining = monthlyBudget - totalSpent;
    const percentageUsed = monthlyBudget > 0 
      ? ((totalSpent / monthlyBudget) * 100).toFixed(2)
      : 0;

    // Calculate daily budget (remaining days in month)
    const daysInMonth = new Date(year, month, 0).getDate();
    let daysRemaining = 0;
    let dailyBudget = 0;
    if (year === now.getFullYear() && month === now.getMonth() + 1) {
      daysRemaining = Math.max(0, daysInMonth - now.getDate());
      dailyBudget = daysRemaining > 0 ? remaining / daysRemaining : 0;
    }

    return successResponse({
      period: {
        month: parseInt(month),
        year: parseInt(year),
        daysRemaining,
      },
      budget: {
        monthly: monthlyBudget,
        spent: totalSpent,
        remaining,
        percentageUsed: parseFloat(percentageUsed),
        dailyBudget: Math.max(0, dailyBudget),
        status: remaining >= 0 ? 'on_track' : 'over_budget',
        exists: budgetDoc.exists,
      },
      categoryBreakdown: Object.entries(categorySpending)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: ((amount / totalSpent) * 100).toFixed(2),
        }))
        .sort((a, b) => b.amount - a.amount),
    });

  } catch (error) {
    return handleApiError(error, 'Get Budget Status');
  }
}

/**
 * POST - Set or update budget goals
 */
export async function POST(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse request body
    const body = await request.json();

    // Validate required fields
    validateRequiredFields(body, ['monthlyBudget', 'month', 'year']);

    const { monthlyBudget, month, year, savingsGoal, categoryBudgets } = body;

    const monthNumber = parseInt(month, 10);
    const yearNumber = parseInt(year, 10);

    if (isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      return errorResponse('Month must be between 1 and 12', 400);
    }

    if (isNaN(yearNumber) || yearNumber < 1970) {
      return errorResponse('Year must be a valid four digit year', 400);
    }

    // Validate budget values
    if (isNaN(monthlyBudget) || monthlyBudget < 0) {
      return errorResponse('Monthly budget must be a non-negative number', 400);
    }

    if (savingsGoal !== undefined && (isNaN(savingsGoal) || savingsGoal < 0)) {
      return errorResponse('Savings goal must be a non-negative number', 400);
    }

    // Prepare update data
    const updateData = {
      monthlyBudget: parseFloat(monthlyBudget),
      month: monthNumber,
      year: yearNumber,
      userId: user.uid,
      updatedAt: new Date().toISOString(),
    };

    if (savingsGoal !== undefined) {
      updateData.savingsGoal = parseFloat(savingsGoal);
    }

    if (categoryBudgets) {
      updateData.categoryBudgets = categoryBudgets;
    }

    const budgetDocId = `${user.uid}_${yearNumber}_${String(monthNumber).padStart(2, '0')}`;
    const budgetRef = adminDb.collection('budgets').doc(budgetDocId);
    const existingDoc = await budgetRef.get();

    const dataToWrite = { ...updateData };

    if (existingDoc.exists) {
      const existingData = existingDoc.data();
      if (existingData?.createdAt) {
        dataToWrite.createdAt = existingData.createdAt;
      }
    } else {
      dataToWrite.createdAt = new Date().toISOString();
    }

    await budgetRef.set(dataToWrite, { merge: true });

    return successResponse(
      dataToWrite,
      200,
      'Budget goals updated successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Update Budget Goals');
  }
}

/**
 * Example GET Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/user/budget?month=1&year=2024', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 * 
 * Example POST Request:
 * 
 * fetch('/api/user/budget', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     monthlyBudget: 3000,
 *     savingsGoal: 10000,
 *     categoryBudgets: {
 *       'Food': 500,
 *       'Transport': 200,
 *       'Entertainment': 150
 *     }
 *   })
 * });
 */
