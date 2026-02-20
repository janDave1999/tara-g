export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required', code?: string, details?: any) {
    super(message, 401, code || 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests', details?: any) {
    super(message, 429, 'RATE_LIMITED', details);
    this.name = 'RateLimitError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export function handleApiError(error: unknown): Response {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
        status: error.statusCode,
        ...(error.details && { details: error.details })
      }),
      {
        status: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }

  if (error instanceof Error) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        status: 500,
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }

  return new Response(
    JSON.stringify({
      error: 'Internal server error',
      code: 'UNKNOWN_ERROR',
      status: 500
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  );
}

export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      status
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=3600'
      }
    }
  );
}