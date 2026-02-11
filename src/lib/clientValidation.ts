import { z } from 'zod';

export function createFormValidator<T>(schema: z.ZodSchema<T>) {
  return (formData: FormData): { success: true; data: T } | { success: false; errors: Record<string, string> } => {
    try {
      const data: Record<string, any> = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });
      
      const validatedData = schema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.reduce((acc, err) => {
          const field = err.path.join('.');
          acc[field] = err.message;
          return acc;
        }, {} as Record<string, string>);
        
        return { 
          success: false, 
          errors: fieldErrors
        };
      }
      
      return { 
        success: false, 
        errors: { _form: 'Validation failed' }
      };
    }
  };
}

export function createClientValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } => {
    try {
      const validatedData = schema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.reduce((acc, err) => {
          const field = err.path.join('.');
          acc[field] = err.message;
          return acc;
        }, {} as Record<string, string>);
        
        return { 
          success: false, 
          errors: fieldErrors
        };
      }
      
      return { 
        success: false, 
        errors: { _form: 'Validation failed' }
      };
    }
  };
}

export function validateField<T>(schema: z.ZodSchema<T>, fieldName: string, value: any): string | null {
  try {
    const fieldSchema = (schema as any).shape?.[fieldName];
    if (!fieldSchema) return null;
    
    fieldSchema.parse(value);
    return null;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldError = error.errors.find(err => err.path[0] === fieldName);
      return fieldError ? fieldError.message : 'Invalid value';
    }
    return 'Invalid value';
  }
}

export const clientSchemas = {
  signIn: z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
    provider: z.enum(['google', 'facebook']).optional()
  }),
  
  register: z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string()
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
  
  createTrip: z.object({
    title: z.string()
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title must be less than 100 characters'),
    description: z.string()
      .min(10, 'Description must be at least 10 characters')
      .max(1000, 'Description must be less than 1000 characters'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    max_pax: z.number()
      .min(2, 'Maximum passengers must be at least 2')
      .max(50, 'Maximum passengers must be less than 50'),
    budget: z.number()
      .min(0, 'Budget must be positive')
      .max(1000000, 'Budget seems too high')
      .optional(),
    destination: z.string().min(1, 'Destination is required'),
    trip_type: z.enum(['leisure', 'business', 'adventure', 'cultural', 'other'])
  }).refine((data) => {
    if (!data.start_date || !data.end_date) return true;
    return new Date(data.start_date) < new Date(data.end_date);
  }, {
    message: "End date must be after start date",
    path: ["end_date"],
  }),
  
  updateProfile: z.object({
    first_name: z.string().min(1, 'First name is required').max(50, 'First name too long'),
    last_name: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
    bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
    phone: z.string().regex(/^[+]?[\d\s\-\(\)]+$/, 'Invalid phone number').optional()
  })
};

export class FormValidator {
  private schema: z.ZodSchema<any>;
  private errors: Record<string, string> = {};
  
  constructor(schema: z.ZodSchema<any>) {
    this.schema = schema;
  }
  
  validate(formData: FormData): boolean {
    const result = createFormValidator(this.schema)(formData);
    
    if (result.success) {
      this.errors = {};
      return true;
    } else {
      this.errors = (result as any).errors;
      return false;
    }
  }
  
  validateField(fieldName: string, value: any): string | null {
    const error = validateField(this.schema, fieldName, value);
    
    if (error) {
      this.errors[fieldName] = error;
    } else {
      delete this.errors[fieldName];
    }
    
    return error;
  }
  
  getErrors(): Record<string, string> {
    return { ...this.errors };
  }
  
  hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }
  
  getFieldError(fieldName: string): string | null {
    return this.errors[fieldName] || null;
  }
  
  clearErrors(): void {
    this.errors = {};
  }
  
  clearFieldError(fieldName: string): void {
    delete this.errors[fieldName];
  }
}