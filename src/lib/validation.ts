import { z } from 'zod';
import { ValidationError } from './errorHandler';

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (request: Request): Promise<T> => {
    try {
      const contentType = request.headers.get('content-type');
      
      if (!contentType?.includes('application/json')) {
        throw new ValidationError('Content-Type must be application/json');
      }
      
      const body = await request.json();
      return schema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.reduce((acc, err) => {
          const field = err.path.join('.');
          acc[field] = err.message;
          return acc;
        }, {} as Record<string, string>);
        
        throw new ValidationError(
          'Validation failed',
          fieldErrors
        );
      }
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error instanceof SyntaxError) {
        throw new ValidationError('Invalid JSON in request body');
      }
      
      throw new ValidationError('Invalid request body');
    }
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (url: URL): T => {
    try {
      const params = Object.fromEntries(url.searchParams);
      return schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.reduce((acc, err) => {
          const field = err.path.join('.');
          acc[field] = err.message;
          return acc;
        }, {} as Record<string, string>);
        
        throw new ValidationError(
          'Query parameter validation failed',
          fieldErrors
        );
      }
      
      throw new ValidationError('Invalid query parameters');
    }
  };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (params: Record<string, string>): T => {
    try {
      return schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.reduce((acc, err) => {
          const field = err.path.join('.');
          acc[field] = err.message;
          return acc;
        }, {} as Record<string, string>);
        
        throw new ValidationError(
          'URL parameter validation failed',
          fieldErrors
        );
      }
      
      throw new ValidationError('Invalid URL parameters');
    }
  };
}

export const commonSchemas = {
  pagination: z.object({
    page: z.string().transform(Number).refine(n => n >= 1, 'Page must be at least 1').optional(),
    limit: z.string().transform(Number).refine(n => n >= 1 && n <= 100, 'Limit must be between 1 and 100').optional(),
  }),
  
  id: z.string().uuid('Invalid ID format'),
  
  email: z.string().email('Invalid email address'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
    
  tripTitle: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters'),
    
  tripDescription: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters'),
    
  tripMaxPax: z.number()
    .min(2, 'Maximum passengers must be at least 2')
    .max(50, 'Maximum passengers must be less than 50'),
    
  tripBudget: z.number()
    .min(0, 'Budget must be positive')
    .max(1000000, 'Budget seems too high'),
};