/**
 * Input Validation Utilities
 * Validates user inputs and request data
 */

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password
 * @returns {Object} - { valid: boolean, message: string }
 */
export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, message: 'Password is too long' };
  }

  return { valid: true, message: 'Password is valid' };
}

/**
 * Validate transaction data
 * @param {Object} transaction - Transaction object
 * @returns {Object} - { valid: boolean, errors: Array }
 */
export function validateTransaction(transaction) {
  const errors = [];

  // Validate type
  if (!['income', 'expense', 'savings'].includes(transaction.type)) {
    errors.push('Type must be income, expense, or savings');
  }

  // Validate amount
  if (!transaction.amount || isNaN(transaction.amount) || transaction.amount <= 0) {
    errors.push('Amount must be a positive number');
  }

  // Validate category
  if (!transaction.category || transaction.category.trim().length === 0) {
    errors.push('Category is required');
  }

  // Validate description (optional but if provided, check length)
  if (transaction.description && transaction.description.length > 500) {
    errors.push('Description must be less than 500 characters');
  }

  // Validate date
  if (transaction.date && isNaN(Date.parse(transaction.date))) {
    errors.push('Invalid date format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate user profile data
 * @param {Object} profile - User profile object
 * @returns {Object} - { valid: boolean, errors: Array }
 */
export function validateUserProfile(profile) {
  const errors = [];

  // Validate name
  if (profile.name && profile.name.length > 100) {
    errors.push('Name must be less than 100 characters');
  }

  // Validate currency
  if (profile.currency && !/^[A-Z]{3}$/.test(profile.currency)) {
    errors.push('Currency must be a valid 3-letter code (e.g., USD, EUR)');
  }

  // Validate monthly budget
  if (profile.monthlyBudget !== undefined && 
      (isNaN(profile.monthlyBudget) || profile.monthlyBudget < 0)) {
    errors.push('Monthly budget must be a non-negative number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize string input
 * @param {string} input - Input string
 * @returns {string} - Sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - { page: number, limit: number }
 */
export function validatePagination(page, limit) {
  const validPage = Math.max(1, parseInt(page) || 1);
  const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  
  return { page: validPage, limit: validLimit };
}
