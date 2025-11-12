/**
 * AI Insights Engine
 * Analyzes financial data and generates AI-powered recommendations
 * Uses TensorFlow.js for predictions (mock implementation ready for real ML model)
 */

/**
 * Analyze spending patterns and generate insights
 * @param {Array} transactions - User transactions
 * @param {Object} userProfile - User profile data
 * @returns {Object} - AI-generated insights
 */
export async function generateInsights(transactions, userProfile) {
  try {
    const insights = {
      summary: generateSummaryInsights(transactions, userProfile),
      recommendations: generateRecommendations(transactions, userProfile),
      predictions: await generatePredictions(transactions),
      alerts: generateAlerts(transactions, userProfile),
      savingsTips: generateSavingsTips(transactions, userProfile),
      categoryAnalysis: analyzeCategorySpending(transactions),
      spendingScore: calculateSpendingScore(transactions, userProfile),
    };

    return insights;
  } catch (error) {
    console.error('Error generating insights:', error);
    throw error;
  }
}

/**
 * Generate summary insights
 */
function generateSummaryInsights(transactions, userProfile) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const totalIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSavings = monthTransactions
    .filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsRate = totalIncome > 0 
    ? ((totalSavings / totalIncome) * 100).toFixed(2)
    : 0;

  return {
    monthlyIncome: totalIncome,
    monthlyExpenses: totalExpenses,
    monthlySavings: totalSavings,
    savingsRate: parseFloat(savingsRate),
    netCashFlow: totalIncome - totalExpenses - totalSavings,
    transactionCount: monthTransactions.length,
  };
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(transactions, userProfile) {
  const recommendations = [];

  // Analyze spending patterns
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const categoryTotals = {};

  expenseTransactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  // Recommendation 1: High spending categories
  const highSpendingCategories = Object.entries(categoryTotals)
    .filter(([_, amount]) => (amount / totalExpenses) > 0.25)
    .map(([category, amount]) => ({
      type: 'reduce_spending',
      priority: 'high',
      category,
      message: `Your ${category} expenses are ${((amount / totalExpenses) * 100).toFixed(0)}% of total spending. Consider reducing by 10-15%.`,
      potentialSavings: amount * 0.15,
    }));

  recommendations.push(...highSpendingCategories);

  // Recommendation 2: Savings goal
  const monthlyIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0) / 12;

  const monthlySavings = transactions
    .filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0) / 12;

  const currentSavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

  if (currentSavingsRate < 20) {
    recommendations.push({
      type: 'increase_savings',
      priority: 'medium',
      message: `Your savings rate is ${currentSavingsRate.toFixed(1)}%. Aim for 20% to build financial security.`,
      targetAmount: monthlyIncome * 0.2,
      currentAmount: monthlySavings,
    });
  }

  // Recommendation 3: Budget adherence
  if (userProfile.monthlyBudget > 0) {
    const monthlyExpenseAvg = totalExpenses / 12;
    if (monthlyExpenseAvg > userProfile.monthlyBudget) {
      recommendations.push({
        type: 'budget_alert',
        priority: 'high',
        message: `You're exceeding your monthly budget by ${((monthlyExpenseAvg - userProfile.monthlyBudget) / userProfile.monthlyBudget * 100).toFixed(0)}%.`,
        overspend: monthlyExpenseAvg - userProfile.monthlyBudget,
      });
    }
  }

  return recommendations;
}

/**
 * Generate spending predictions using mock ML model
 * In production, replace with actual TensorFlow.js model
 */
async function generatePredictions(transactions) {
  // Mock prediction - replace with actual TensorFlow.js model
  const recentTransactions = transactions
    .filter(t => t.type === 'expense')
    .slice(-30);

  const avgDailySpending = recentTransactions.length > 0
    ? recentTransactions.reduce((sum, t) => sum + t.amount, 0) / 30
    : 0;

  // Simple linear prediction (replace with ML model)
  const nextMonthPrediction = avgDailySpending * 30;
  const confidence = 0.75; // Mock confidence score

  return {
    nextMonthExpenses: nextMonthPrediction,
    confidence,
    trend: avgDailySpending > 100 ? 'increasing' : 'stable',
    method: 'moving_average', // Replace with 'neural_network' when using TensorFlow.js
  };
}

/**
 * Generate financial alerts
 */
function generateAlerts(transactions, userProfile) {
  const alerts = [];
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const monthlyExpenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Alert 1: Budget warning
  if (userProfile.monthlyBudget > 0) {
    const budgetUsage = (monthlyExpenses / userProfile.monthlyBudget) * 100;
    
    if (budgetUsage >= 90) {
      alerts.push({
        type: 'budget_warning',
        severity: 'critical',
        message: `You've used ${budgetUsage.toFixed(0)}% of your monthly budget!`,
      });
    } else if (budgetUsage >= 75) {
      alerts.push({
        type: 'budget_warning',
        severity: 'warning',
        message: `You've used ${budgetUsage.toFixed(0)}% of your monthly budget.`,
      });
    }
  }

  // Alert 2: Unusual spending
  const avgDailySpending = monthlyExpenses / today.getDate();
  const recentDaySpending = monthTransactions
    .filter(t => {
      const date = new Date(t.date);
      return date.getDate() === today.getDate();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  if (recentDaySpending > avgDailySpending * 2) {
    alerts.push({
      type: 'unusual_spending',
      severity: 'info',
      message: `Today's spending is ${((recentDaySpending / avgDailySpending) * 100).toFixed(0)}% higher than your daily average.`,
    });
  }

  return alerts;
}

/**
 * Generate savings tips
 */
function generateSavingsTips(transactions, userProfile) {
  const tips = [];

  // Analyze recurring expenses
  const categoryFrequency = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    categoryFrequency[t.category] = (categoryFrequency[t.category] || 0) + 1;
  });

  // Tip 1: Subscription audit
  if (categoryFrequency['Subscriptions'] > 3) {
    tips.push({
      category: 'Subscriptions',
      tip: 'Review your subscriptions. Cancel unused services to save money.',
      estimatedSavings: 50,
    });
  }

  // Tip 2: Food expenses
  const foodExpenses = transactions
    .filter(t => t.category === 'Food' && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  if (foodExpenses > 500) {
    tips.push({
      category: 'Food',
      tip: 'Meal planning and cooking at home can reduce food costs by 30-40%.',
      estimatedSavings: foodExpenses * 0.35,
    });
  }

  // Tip 3: Generic savings tip
  tips.push({
    category: 'General',
    tip: 'Set up automatic transfers to savings on payday to build your emergency fund.',
    estimatedSavings: null,
  });

  return tips;
}

/**
 * Analyze category spending patterns
 */
function analyzeCategorySpending(transactions) {
  const categoryData = {};

  transactions.filter(t => t.type === 'expense').forEach(t => {
    if (!categoryData[t.category]) {
      categoryData[t.category] = {
        total: 0,
        count: 0,
        avgTransaction: 0,
        trend: 'stable',
      };
    }
    categoryData[t.category].total += t.amount;
    categoryData[t.category].count += 1;
  });

  // Calculate averages
  Object.keys(categoryData).forEach(category => {
    categoryData[category].avgTransaction = 
      categoryData[category].total / categoryData[category].count;
  });

  return categoryData;
}

/**
 * Calculate overall spending score (0-100)
 */
function calculateSpendingScore(transactions, userProfile) {
  let score = 100;

  // Factor 1: Budget adherence (30 points)
  if (userProfile.monthlyBudget > 0) {
    const monthlyExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0) / 12;

    const budgetRatio = monthlyExpenses / userProfile.monthlyBudget;
    if (budgetRatio > 1) {
      score -= 30;
    } else if (budgetRatio > 0.9) {
      score -= 15;
    }
  }

  // Factor 2: Savings rate (40 points)
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSavings = transactions
    .filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  if (savingsRate < 10) {
    score -= 40;
  } else if (savingsRate < 20) {
    score -= 20;
  }

  // Factor 3: Spending consistency (30 points)
  // Penalize large fluctuations in daily spending
  const dailySpending = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const day = new Date(t.date).toISOString().split('T')[0];
    dailySpending[day] = (dailySpending[day] || 0) + t.amount;
  });

  const spendingValues = Object.values(dailySpending);
  const avgSpending = spendingValues.reduce((sum, val) => sum + val, 0) / spendingValues.length;
  const variance = spendingValues.reduce((sum, val) => sum + Math.pow(val - avgSpending, 2), 0) / spendingValues.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev > avgSpending) {
    score -= 30;
  } else if (stdDev > avgSpending * 0.5) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Placeholder for TensorFlow.js model integration
 * Replace this with actual model when ready
 */
export async function loadTensorFlowModel() {
  // Example TensorFlow.js model loading
  // const tf = require('@tensorflow/tfjs');
  // const model = await tf.loadLayersModel('file://path/to/model.json');
  // return model;
  
  return null; // Return null for now (mock implementation)
}

/**
 * Placeholder for TensorFlow.js prediction
 */
export async function predictWithModel(model, inputData) {
  // Example TensorFlow.js prediction
  // const tensor = tf.tensor2d([inputData]);
  // const prediction = model.predict(tensor);
  // return prediction.dataSync();
  
  return null; // Return null for now (mock implementation)
}
