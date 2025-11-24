/**
 * POST /api/insights/analyze
 * Analyze spending patterns and generate chatbot-style insights
 * Accepts transaction data from client and returns AI-powered recommendations
 */

import { successResponse, errorResponse } from '../../../../lib/utils/responseFormatter';
import { handleApiError } from '../../../../lib/utils/errorHandler';
import { verifyAuth } from '../../../../lib/middleware/authMiddleware';
import { adminDb } from '../../../../lib/firebase/admin';

const DAYS_WINDOW = 30;
const MIN_TRANSACTIONS_FOR_PREDICTION = 10;

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
 * Analyze spending patterns using TensorFlow.js time-series prediction
 * over the last 30 days of expenses with a simple linear regression model.
 */
async function runTensorFlowAnalysis(expenses) {
  const now = new Date();
  const nowTime = now.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const windowStart = nowTime - (DAYS_WINDOW - 1) * msPerDay;

  const recentExpenses = expenses.filter(t => {
    if (!t || !t.date || t.type !== 'expense') return false;
    const txTime = new Date(t.date).getTime();
    if (Number.isNaN(txTime)) return false;
    return txTime >= windowStart && txTime <= nowTime;
  });

  if (recentExpenses.length < MIN_TRANSACTIONS_FOR_PREDICTION) {
    return {
      hasEnoughData: false,
      averageExpense: 0,
      stdDeviation: 0,
      riskScore: 0,
      predictedNextPeriod: 0,
      sampleSize: recentExpenses.length,
      daysAnalyzed: 0,
    };
  }

  const buckets = {};

  recentExpenses.forEach(t => {
    const txTime = new Date(t.date).getTime();
    const dayIndex = Math.floor((txTime - windowStart) / msPerDay);
    const prev = buckets[dayIndex] || 0;
    buckets[dayIndex] = prev + (Number(t.amount) || 0);
  });

  const dayIndexes = Object.keys(buckets)
    .map(index => parseInt(index, 10))
    .sort((a, b) => a - b);

  const series = dayIndexes.map(index => buckets[index]);

  if (series.length < 2) {
    return {
      hasEnoughData: false,
      averageExpense: 0,
      stdDeviation: 0,
      riskScore: 0,
      predictedNextPeriod: 0,
      sampleSize: recentExpenses.length,
      daysAnalyzed: series.length,
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
      sampleSize: recentExpenses.length,
      daysAnalyzed: series.length,
      error: 'tf_load_failed',
    };
  }

  const xs = series.map((_, index) => index);
  const ys = series;

  const maxX = Math.max(...xs, 1);
  const maxY = Math.max(...ys, 1);

  const xNorm = xs.map(value => value / maxX);
  const yNorm = ys.map(value => value / maxY);

  const xsTensor = tf.tensor2d(xNorm, [xNorm.length, 1]);
  const ysTensor = tf.tensor2d(yNorm, [yNorm.length, 1]);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
  model.compile({ optimizer: tf.train.sgd(0.1), loss: 'meanSquaredError' });

  let predictionTensor = null;

  try {
    await model.fit(xsTensor, ysTensor, { epochs: 50, verbose: 0 });

    const nextIndex = xs.length;
    const nextXNorm = nextIndex / maxX;
    predictionTensor = model.predict(tf.tensor2d([nextXNorm], [1, 1]));
    const predictionData = predictionTensor.dataSync();
    const predictedNorm = predictionData[0];
    const predictedAmount = Math.max(0, predictedNorm * maxY);

    const totalSpent = ys.reduce((sum, value) => sum + value, 0);
    const averageDaily = series.length > 0 ? totalSpent / series.length : 0;

    const meanValue = averageDaily;
    const variance =
      series.length > 0
        ? series.reduce((sum, value) => sum + Math.pow(value - meanValue, 2), 0) / series.length
        : 0;
    const stdValue = Math.sqrt(variance);
    const variability = meanValue === 0 ? 0 : (stdValue / meanValue) * 100;
    const riskScore = Math.max(0, Math.min(100, variability * 1.2));

    return {
      hasEnoughData: true,
      averageExpense: averageDaily,
      stdDeviation: stdValue,
      riskScore,
      predictedNextPeriod: predictedAmount,
      sampleSize: recentExpenses.length,
      daysAnalyzed: series.length,
    };
  } catch (error) {
    console.error('TensorFlow time-series analysis failed:', error);
    return {
      hasEnoughData: false,
      averageExpense: 0,
      stdDeviation: 0,
      riskScore: 0,
      predictedNextPeriod: 0,
      sampleSize: recentExpenses.length,
      daysAnalyzed: series.length,
      error: 'tf_analysis_failed',
    };
  } finally {
    xsTensor.dispose();
    ysTensor.dispose();
    if (predictionTensor) {
      predictionTensor.dispose();
    }
    model.dispose();
  }
}

async function analyzeSpendingPatterns(transactions, userProfile) {
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

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthExpenses = expenses.filter(t => {
    const date = new Date(t.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const monthlyExpenses = monthExpenses.reduce((sum, t) => sum + t.amount, 0);

  const monthlyBudget =
    userProfile && typeof userProfile.monthlyBudget === 'number'
      ? userProfile.monthlyBudget
      : 0;

  if (monthlyBudget > 0) {
    const budgetUsage = (monthlyExpenses / monthlyBudget) * 100;

    if (budgetUsage >= 80) {
      insights.push({
        type: 'budget_overrun_risk',
        message: `Your actual expenditure has reached ${budgetUsage.toFixed(
          1,
        )}% of your fixed monthly budget. This is treated as a high-priority financial alert so that you can take corrective action before the end of the period.`,
        icon: '⚠️',
        priority: 'high',
        data: {
          monthlyBudget,
          spent: monthlyExpenses,
          percentageUsed: parseFloat(budgetUsage.toFixed(1)),
        },
      });
    }
  }

  // Insight 1: Spending overview
  if (totalExpenses > 0) {
    insights.push({
      type: 'spending_overview',
      message: `You've spent ${totalExpenses.toFixed(2)} across ${expenses.length} transactions.`,
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
      message: `Your biggest expense is **${topCategory}** at ${topAmount.toFixed(2)} (${percentageValue.toFixed(0)}% of total spending).`,
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

  // Insight 3: Savings rate vs recommended 20%
  if (totalIncome > 0) {
    const savingsRate = (totalSavings / totalIncome) * 100;

    insights.push({
      type: 'savings_rate',
      message: `Your savings rate is ${savingsRate.toFixed(
        1,
      )}%. This is compared against the commonly recommended target of saving 20% of income (Chen, 2024).`,
      icon: '🐷',
      priority: 'low',
      data: {
        savingsRate: parseFloat(savingsRate.toFixed(1)),
        target: 20,
      },
    });
  }

  // Insight 3b: TensorFlow time-series prediction insight
  if (tfAnalysis.hasEnoughData) {
    insights.push({
      type: 'ml_analysis',
      message: `🤖 TensorFlow estimates your average expense at ${tfAnalysis.averageExpense.toFixed(2)} with a variability of ${tfAnalysis.stdDeviation.toFixed(2)}.`,
      icon: '🤖',
      priority: tfAnalysis.riskScore > 70 ? 'high' : tfAnalysis.riskScore > 40 ? 'medium' : 'low',
      data: tfAnalysis,
    });

    insights.push({
      type: 'ml_projection',
      message: `📈 A TensorFlow.js linear regression model analyzed your last 30 days of expenses to forecast the next period. This prediction becomes more accurate as more historical data is available (requires at least 10 expense transactions). Your next-period spending is projected around ${tfAnalysis.predictedNextPeriod.toFixed(
        2,
      )}.`,
      icon: '📈',
      priority: 'medium',
      data: {
        projection: tfAnalysis.predictedNextPeriod,
        averageExpense: tfAnalysis.averageExpense,
        daysAnalyzed: tfAnalysis.daysAnalyzed,
        sampleSize: tfAnalysis.sampleSize,
      },
    });
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

    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const userProfile = userDoc.exists ? userDoc.data() : {};

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
    const analysis = await analyzeSpendingPatterns(transactionsToAnalyze, userProfile);

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
