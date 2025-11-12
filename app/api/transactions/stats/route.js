/**
 * GET /api/transactions/stats
 * Get transaction statistics and analytics
 */

import { adminDb } from '@/lib/firebase/admin';
import { successResponse } from '@/lib/utils/responseFormatter';
import { handleApiError } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';

export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // month, year, all
    const year = searchParams.get('year') || new Date().getFullYear();
    const month = searchParams.get('month') || new Date().getMonth() + 1;

    // Calculate date range
    let startDate, endDate;
    
    if (period === 'month') {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else if (period === 'year') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    } else {
      // All time
      startDate = new Date(2000, 0, 1);
      endDate = new Date();
    }

    // Fetch transactions in date range
    const snapshot = await adminDb
      .collection('transactions')
      .where('userId', '==', user.uid)
      .where('date', '>=', startDate.toISOString())
      .where('date', '<=', endDate.toISOString())
      .get();

    const transactions = snapshot.docs.map(doc => doc.data());

    // Calculate statistics
    const stats = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        netBalance: 0,
        transactionCount: transactions.length,
      },
      byCategory: {},
      byType: {
        income: { count: 0, total: 0 },
        expense: { count: 0, total: 0 },
        savings: { count: 0, total: 0 },
      },
      topCategories: [],
      monthlyTrend: [],
    };

    // Process transactions
    transactions.forEach(transaction => {
      const amount = transaction.amount;
      const type = transaction.type;
      const category = transaction.category;

      // Update type totals
      stats.byType[type].count++;
      stats.byType[type].total += amount;

      // Update summary
      if (type === 'income') {
        stats.summary.totalIncome += amount;
      } else if (type === 'expense') {
        stats.summary.totalExpenses += amount;
      } else if (type === 'savings') {
        stats.summary.totalSavings += amount;
      }

      // Update category breakdown
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = { count: 0, total: 0, type };
      }
      stats.byCategory[category].count++;
      stats.byCategory[category].total += amount;
    });

    // Calculate net balance
    stats.summary.netBalance = 
      stats.summary.totalIncome - stats.summary.totalExpenses - stats.summary.totalSavings;

    // Get top spending categories
    stats.topCategories = Object.entries(stats.byCategory)
      .filter(([_, data]) => data.type === 'expense')
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: ((data.total / stats.summary.totalExpenses) * 100).toFixed(2),
      }));

    // Calculate monthly trend (last 6 months)
    const monthlyData = {};
    transactions.forEach(transaction => {
      const monthKey = new Date(transaction.date).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0, savings: 0 };
      }
      monthlyData[monthKey][transaction.type] += transaction.amount;
    });

    stats.monthlyTrend = Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, data]) => ({
        month,
        ...data,
        net: data.income - data.expense - data.savings,
      }));

    return successResponse(stats);

  } catch (error) {
    return handleApiError(error, 'Get Transaction Stats');
  }
}

/**
 * Example Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/transactions/stats?period=month&year=2024&month=1', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 * 
 * Example Response:
 * {
 *   "success": true,
 *   "data": {
 *     "period": "month",
 *     "summary": {
 *       "totalIncome": 5000,
 *       "totalExpenses": 3200,
 *       "totalSavings": 800,
 *       "netBalance": 1000,
 *       "transactionCount": 45
 *     },
 *     "topCategories": [
 *       { "category": "Food", "total": 800, "count": 12, "percentage": "25.00" }
 *     ]
 *   }
 * }
 */
