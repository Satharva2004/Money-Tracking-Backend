/**
 * Response Formatter Utilities
 * Standardizes API responses across all endpoints
 */

import { NextResponse } from 'next/server';

/**
 * Success response formatter
 * @param {any} data - Response data
 * @param {number} status - HTTP status code (default: 200)
 * @param {string} message - Optional success message
 * @returns {NextResponse}
 */
export function successResponse(data, status = 200, message = 'Success') {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Error response formatter
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 500)
 * @param {any} errors - Optional detailed errors
 * @returns {NextResponse}
 */
export function errorResponse(message, status = 500, errors = null) {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Validation error response
 * @param {Array} errors - Array of validation errors
 * @returns {NextResponse}
 */
export function validationErrorResponse(errors) {
  return errorResponse('Validation failed', 400, errors);
}

/**
 * Pagination metadata formatter
 * @param {number} total - Total items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object}
 */
export function paginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1,
  };
}
