/**
 * POST /api/insights/analyze
 * Analyze spending patterns and generate chatbot-style insights
 * Accepts transaction data from client and returns AI-powered recommendations
 */

import { successResponse, errorResponse } from '@/lib/utils/responseFormatter';
import { handleApiError } from '@/lib/utils/errorHandler';
import { verifyAuth } from '@/lib/middleware/authMiddleware';
import { adminDb } from '@/lib/firebase/admin';

let tfModulePromise = null;

async function getTensorFlow() {
  if (!tfModulePromise) {
    tfModulePromise = import('@tensorflow/tfjs')
      .then(async tf => {
        try {
          if (tf.getBackend() !== 'cpu') {
            await tf.setBackend('cpu');
          }
          await tf.ready();
        } catch (error) {
          console.warn('TensorFlow.js backend initialization failed, falling back to default backend.', error);
        }
        return tf;
      })
      .catch(error => {
        console.error('TensorFlow.js failed to load', error);
        return null;
      });
  }
  return tfModulePromise;
}

function tfAnalysisHasData(analysis) {
  return Boolean(analysis?.summary?.machineLearning?.hasEnoughData);
}

/**
 * Analyze spending patterns using simple ML heuristics
 * Ready for TensorFlow.js integration
 */
async function runTensorFlowAnalysis(expenses) {
  const expenseAmounts = expenses
    .map(t => Number(t.amount) || 0)
    .filter(amount => amount > 0);

  if (expenseAmounts.length < 2) {
    return {
      hasEnoughData: false,
      averageExpense: 0,
      stdDeviation: 0,
      riskScore: 0,
      predictedNextPeriod: 0,
    };
  }

  const tf = await getTensorFlow();
  if (!tf) {
    return {
      hasEnoughData: false,
      averageExpense: 0,
      stdDeviation: 0,
      riskScore: 0,
      predictedNextPeriod: 0,
      error: 'tf_load_failed',
    };
  }

  return tf.tidy(() => {
    const tensor = tf.tensor1d(expenseAmounts);
    const { mean, variance } = tf.moments(tensor);
    const std = tf.sqrt(variance);

    const meanValue = mean.dataSync()[0];
    const stdValue = std.dataSync()[0];

    const variability = meanValue === 0 ? 0 : (stdValue / meanValue) * 100;
    const riskScore = Math.max(0, Math.min(100, variability * 1.2));

    // Simple projection: mean + half std dev as next period expectation
    const predicted = meanValue + stdValue * 0.5;

    return {
      hasEnoughData: true,
      averageExpense: meanValue,
      stdDeviation: stdValue,
      riskScore,
      predictedNextPeriod: predicted,
      sampleSize: expenseAmounts.length,
    };
  });
}

async function analyzeSpendingPatterns(transactions) {
  if (!transactions || transactions.length === 0) {
    return {
      hasData: false,
      message: "I don't have enough transaction data to analyze yet. Start tracking your expenses and I'll provide insights!",
    };
  }

  const insights = [];
  const expenses = transactions.filter(t => t.type === 'expense');
  const income = transactions.filter(t => t.type === 'income');
  const savings = transactions.filter(t => t.type === 'savings');

  const tfAnalysis = await runTensorFlowAnalysis(expenses);

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const totalSavings = savings.reduce((sum, t) => sum + t.amount, 0);

  // Category breakdown
  const categoryTotals = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Insight 1: Spending overview
  if (totalExpenses > 0) {
    insights.push({
      type: 'spending_overview',
      message: `You've spent $${totalExpenses.toFixed(2)} across ${expenses.length} transactions.`,
      icon: '💰',
      data: { totalExpenses, transactionCount: expenses.length },
    });
  }

  // Insight 2: Top spending category
  if (topCategories.length > 0) {
    const [topCategory, topAmount] = topCategories[0];
    const percentageValue = totalExpenses === 0 ? 0 : (topAmount / totalExpenses) * 100;

    insights.push({
      type: 'top_category',
      message: `Your biggest expense is **${topCategory}** at $${topAmount.toFixed(2)} (${percentageValue.toFixed(0)}% of total spending).`,
      icon: '📊',
      data: { category: topCategory, amount: topAmount, percentage: percentageValue.toFixed(0) },
    });

    // Recommendation based on top category
    if (percentageValue > 40) {
      insights.push({
        type: 'AI Recommendation',
        message: `💡 **Tip**: ${topCategory} takes up a large portion of your budget. Consider setting a monthly limit or finding ways to reduce costs in this area.`,
        icon: '💡',
        priority: 'high',
      });
    }
  }

  // Insight 3: Savings rate
  if (totalIncome > 0) {
    const savingsRate = ((totalSavings / totalIncome) * 100).toFixed(1);
    
    if (parseFloat(savingsRate) < 10) {
      insights.push({
        type: 'savings_alert',
        message: `⚠️ Your savings rate is ${savingsRate}%. Financial experts recommend saving at least 20% of your income.`,
        icon: '⚠️',
        priority: 'medium',
        data: { savingsRate: parseFloat(savingsRate), target: 20 },
      });
    } else if (parseFloat(savingsRate) >= 20) {
      insights.push({
        type: 'savings_success',
        message: `🎉 Great job! You're saving ${savingsRate}% of your income. Keep up the excellent work!`,
        icon: '🎉',
        priority: 'positive',
        data: { savingsRate: parseFloat(savingsRate) },
      });
    } else {
      insights.push({
        type: 'savings_progress',
        message: `You're saving ${savingsRate}% of your income. Try to increase this to 20% for better financial security.`,
        icon: '📈',
        priority: 'medium',
        data: { savingsRate: parseFloat(savingsRate), target: 20 },
      });
    }
  }

  // Insight 3b: TensorFlow variance insight
  if (tfAnalysis.hasEnoughData) {
    insights.push({
      type: 'ml_analysis',
      message: `🤖 TensorFlow estimates your average expense at $${tfAnalysis.averageExpense.toFixed(2)} with a variability of $${tfAnalysis.stdDeviation.toFixed(2)}.`,
      icon: '🤖',
      priority: tfAnalysis.riskScore > 70 ? 'high' : tfAnalysis.riskScore > 40 ? 'medium' : 'low',
      data: tfAnalysis,
    });

    if (tfAnalysis.riskScore > 70) {
      insights.push({
        type: 'ml_risk_alert',
        message: `⚠️ TensorFlow detected highly volatile spending. Your risk score is ${tfAnalysis.riskScore.toFixed(0)}. Consider tightening your budget controls.`,
        icon: '⚠️',
        priority: 'high',
        data: { riskScore: tfAnalysis.riskScore },
      });
    } else {
      insights.push({
        type: 'ml_projection',
        message: `📈 Based on recent patterns, your next-period spending is projected around $${tfAnalysis.predictedNextPeriod.toFixed(2)}.`,
        icon: '📈',
        priority: 'medium',
        data: {
          projection: tfAnalysis.predictedNextPeriod,
          averageExpense: tfAnalysis.averageExpense,
        },
      });
    }
  }

  // Insight 4: Spending trend (last 7 days vs previous 7 days)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentExpenses = expenses.filter(t => new Date(t.date) >= sevenDaysAgo);
  const previousExpenses = expenses.filter(
    t => new Date(t.date) >= fourteenDaysAgo && new Date(t.date) < sevenDaysAgo
  );

  const recentTotal = recentExpenses.reduce((sum, t) => sum + t.amount, 0);
  const previousTotal = previousExpenses.reduce((sum, t) => sum + t.amount, 0);

  if (previousTotal > 0) {
    const change = ((recentTotal - previousTotal) / previousTotal) * 100;
    
    if (change > 20) {
      insights.push({
        type: 'trend_alert',
        message: `📈 Your spending increased by ${change.toFixed(0)}% this week compared to last week. Keep an eye on your budget!`,
        icon: '📈',
        priority: 'high',
        data: { change: change.toFixed(1), direction: 'up' },
      });
    } else if (change < -20) {
      insights.push({
        type: 'trend_positive',
        message: `📉 Great news! Your spending decreased by ${Math.abs(change).toFixed(0)}% this week. You're doing well!`,
        icon: '📉',
        priority: 'positive',
        data: { change: change.toFixed(1), direction: 'down' },
      });
    }
  }

  // Insight 5: Actionable tips
  const tips = [];
  
  if (categoryTotals['Food'] && categoryTotals['Food'] > 500) {
    tips.push('🍳 Try meal prepping to reduce food expenses by 30-40%.');
  }
  
  if (categoryTotals['Shopping'] && categoryTotals['Shopping'] > 300) {
    tips.push('🛍️ Use the 24-hour rule: wait a day before making non-essential purchases.');
  }
  
  if (categoryTotals['Subscriptions']) {
    tips.push('📱 Review your subscriptions and cancel unused services.');
  }

  if (tips.length > 0) {
    insights.push({
      type: 'tips',
      message: '**Quick Tips to Save Money:**\n' + tips.join('\n'),
      icon: '💡',
      priority: 'low',
      data: { tips },
    });
  }

  // Summary
  insights.push({
    type: 'summary',
    message: `That's your spending analysis! Keep tracking your expenses and I'll help you make smarter financial decisions. 🚀`,
    icon: '✨',
  });

  return {
    hasData: true,
    insights,
    summary: {
      totalTransactions: transactions.length,
      totalExpenses,
      totalIncome,
      totalSavings,
      topCategories: topCategories.map(([cat, amt]) => ({ category: cat, amount: amt })),
      machineLearning: tfAnalysis.hasEnoughData ? tfAnalysis : null,
    },
  };
}

/**
 * POST - Analyze spending and return chatbot-style insights
 */
export async function POST(request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse request body
    const body = await request.json();
    const { transactions, period } = body;

    // Validate input
    if (!transactions || !Array.isArray(transactions)) {
      return errorResponse('Transactions array is required', 400);
    }

    // If no transactions provided, fetch from database
    let transactionsToAnalyze = transactions;
    
    if (transactions.length === 0) {
      // Fetch last 30 days of transactions
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const snapshot = await adminDb
        .collection('transactions')
        .where('userId', '==', user.uid)
        .get();

      transactionsToAnalyze = snapshot.docs
        .map(doc => doc.data())
        .filter(t => new Date(t.date) >= thirtyDaysAgo);
    }

    // Run analysis
    const analysis = await analyzeSpendingPatterns(transactionsToAnalyze);

    // Save analysis to insights collection for history
    if (analysis.hasData) {
      await adminDb.collection('insights').add({
        userId: user.uid,
        type: 'spending_analysis',
        insights: analysis.insights,
        summary: analysis.summary,
        period: period || 'last_30_days',
        createdAt: new Date().toISOString(),
      });
    }

    return successResponse(
      {
        analysis,
        metadata: {
          analyzedTransactions: transactionsToAnalyze.length,
          generatedAt: new Date().toISOString(),
          mlModel: tfAnalysisHasData(analysis) ? 'tensorflow_js_v1' : 'heuristic_only',
        },
      },
      200,
      'Analysis completed successfully'
    );

  } catch (error) {
    return handleApiError(error, 'Analyze Spending');
  }
}

/**
 * Example Request:
 * 
 * const idToken = await firebase.auth().currentUser.getIdToken();
 * 
 * fetch('/api/insights/analyze', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     transactions: [
 *       { type: 'expense', amount: 50, category: 'Food', date: '2025-01-10' },
 *       { type: 'expense', amount: 100, category: 'Shopping', date: '2025-01-11' },
 *       { type: 'income', amount: 2000, category: 'Salary', date: '2025-01-01' }
 *     ],
 *     period: 'last_30_days'
 *   })
 * });
 * 
 * Example Response (200):
 * {
 *   "success": true,
 *   "message": "Analysis completed successfully",
 *   "data": {
 *     "analysis": {
 *       "hasData": true,
 *       "insights": [
 *         {
 *           "type": "greeting",
 *           "message": "Hi! I've analyzed 3 transactions. Here's what I found:",
 *           "icon": "👋"
 *         },
 *         {
 *           "type": "spending_overview",
 *           "message": "You've spent $150.00 across 2 transactions.",
 *           "icon": "💰",
 *           "data": { "totalExpenses": 150, "transactionCount": 2 }
 *         },
 *         {
 *           "type": "top_category",
 *           "message": "Your biggest expense is **Shopping** at $100.00 (67% of total spending).",
 *           "icon": "📊",
 *           "data": { "category": "Shopping", "amount": 100, "percentage": "67" }
 *         }
 *       ],
 *       "summary": {
 *         "totalTransactions": 3,
 *         "totalExpenses": 150,
 *         "totalIncome": 2000,
 *         "totalSavings": 0,
 *         "topCategories": [
 *           { "category": "Shopping", "amount": 100 },
 *           { "category": "Food", "amount": 50 }
 *         ]
 *       }
 *     },
 *     "metadata": {
 *       "analyzedTransactions": 3,
 *       "generatedAt": "2025-11-12T23:15:42.100Z",
 *       "mlModel": "heuristic_v1"
 *     }
 *   },
 *   "timestamp": "2025-11-12T23:15:42.100Z"
 * }
 * 
 * Frontend Usage:
 * 
 * // In your React component
 * const analyzeSpending = async () => {
 *   const response = await fetch('/api/insights/analyze', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'Authorization': `Bearer ${idToken}`
 *     },
 *     body: JSON.stringify({
 *       transactions: recentTransactions, // Pass from state/props
 *       period: 'last_30_days'
 *     })
 *   });
 *   
 *   const data = await response.json();
 *   
 *   // Display insights in chatbot UI
 *   data.data.analysis.insights.forEach(insight => {
 *     addChatMessage({
 *       text: insight.message,
 *       icon: insight.icon,
 *       type: insight.type
 *     });
 *   });
 * };
 */
