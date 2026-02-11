/**
 * Enhanced Trip Creation Types with Advanced TypeScript Patterns
 * Using generics, conditional types, mapped types, and discriminated unions
 */

import { z } from 'zod';

// =====================================================
// CORE TRIP CREATION TYPES WITH ADVANCED PATTERNS
// =====================================================

export type TripCreationStep = 'schedule' | 'details' | 'budget' | 'logistics';
export type GenderPreference = 'any' | 'male' | 'female';
export type CostSharingMethod = 'split_evenly' | 'organizer_shoulders_cost' | 'pay_own_expenses' | 'custom_split';
export type LocationType = 'destination' | 'pickup' | 'dropoff';

// =====================================================
// GENERIC FORM STATE MANAGEMENT TYPES
// =====================================================

export type FormState<T> = {
  data: T;
  errors: Partial<Record<keyof T, string[]>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  currentStep: TripCreationStep;
  dirty: boolean;
};

export type FormFieldConfig<T, K extends keyof T> = {
  value: T[K];
  error?: string[];
  isTouched: boolean;
  isValid: boolean;
  isDirty: boolean;
  isRequired: boolean;
  isEnabled: boolean;
  dependencies?: (keyof T)[];
};

// =====================================================
// ADVANCED VALIDATION TYPES WITH CONDITIONAL LOGIC
// =====================================================

export type ValidationRule<T, K extends keyof T> = {
  field: K;
  validate: (value: T[K], allData: T) => boolean | Promise<boolean>;
  message: string;
  code: string;
  dependsOn?: (keyof T)[];
  enabledWhen?: (data: T) => boolean;
  debounceMs?: number;
};

export type ValidationResult<T> = 
  | { status: 'valid'; data: T }
  | { status: 'invalid'; errors: ValidationError[]; data?: T }
  | { status: 'pending'; message: string };

export type ValidationError = 
  | { type: 'field'; field: string; message: string; code: string }
  | { type: 'global'; message: string; code: string }
  | { type: 'dependency'; fields: string[]; message: string; code: string }
  | { type: 'cross_field'; fields: string[]; message: string; code: string };

// =====================================================
// ENHANCED TRIP FORM DATA TYPES
// =====================================================

export interface TripScheduleData {
  start_date: string;
  end_date: string;
  joined_by: string;
  region_address: string;
  region_coordinates: [number, number];
}

export interface TripDetailsData {
  title: string;
  description: string;
  slug: string;
  tags: string[];
}

export interface TripBudgetData {
  max_pax: number;
  gender_preference: GenderPreference;
  cost_sharing: CostSharingMethod;
  estimated_budget: number | null;
}

export interface TripLogisticsData {
  pickup_address: string;
  pickup_coordinates: [number, number];
  pickup_dates: string;
  waiting_time: number;
  dropoff_address: string;
  dropoff_coordinates: [number, number];
  dropoff_dates: string;
}

// Main trip form data with conditional types
export type TripFormData = TripScheduleData & TripDetailsData & TripBudgetData & TripLogisticsData;

// =====================================================
// ADVANCED TYPE UTILITIES FOR TRIP FORM
// =====================================================

type RequiredFields<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T];

type OptionalFields<T> = Exclude<keyof T, RequiredFields<T>>;

type FieldDependencies<T> = {
  [K in keyof T]?: (keyof T)[];
};

type FieldValidators<T> = {
  [K in keyof T]?: ValidationRule<T, K>[];
};

// =====================================================
// LOCATION TYPES WITH ENHANCED TYPING
// =====================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationInput {
  address: string;
  coordinates: Coordinates;
  name?: string;
}

export interface TripLocation extends LocationInput {
  type: LocationType;
  datetime?: string;
  waiting_time?: number;
  order_index: number;
  is_primary: boolean;
  is_mandatory: boolean;
}

// =====================================================
// DATABASE RESPONSE TYPES WITH DISCRIMINATED UNIONS
// =====================================================

export type TripCreationResponse = 
  | { success: true; trip_id: string; data: TripCreationSummary }
  | { success: false; error: TripCreationError };

export type TripCreationError = 
  | { code: 'VALIDATION_ERROR'; message: string; fields: string[] }
  | { code: 'DATABASE_ERROR'; message: string; sqlState?: string }
  | { code: 'CONSTRAINT_VIOLATION'; constraint: string; message: string }
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'DEPENDENCY_FAILED'; dependency: string; message: string }
  | { code: 'UNKNOWN_ERROR'; message: string };

export interface TripCreationSummary {
  trip_id: string;
  title: string;
  slug: string;
  start_date: string;
  end_date: string;
  region_name: string;
  created_at: string;
}

// =====================================================
// VALIDATION CONFIGURATION TYPES
// =====================================================

export interface ValidationConfig<T> {
  rules: FieldValidators<T>;
  dependencies: FieldDependencies<T>;
  crossFieldValidation: ValidationRule<T, keyof T>[];
  schema: z.ZodSchema<T>;
}

export type ValidationPhase = 
  | 'client'     // Real-time client validation
  | 'server'     // Server-side validation
  | 'database'    // Database constraint validation
  | 'business';   // Business logic validation

export type ValidationContext<T> = {
  phase: ValidationPhase;
  data: T;
  existingData?: Partial<T>;
  userRole?: string;
  isUpdate?: boolean;
};

// =====================================================
// STEP-SPECIFIC TYPES
// =====================================================

export type StepData<T> = T extends TripScheduleData ? 'schedule' 
  : T extends TripDetailsData ? 'details'
  : T extends TripBudgetData ? 'budget'
  : T extends TripLogisticsData ? 'logistics'
  : never;

export type StepValidationResult<T> = 
  | { step: StepData<T>; status: 'valid'; data: T }
  | { step: StepData<T>; status: 'invalid'; errors: ValidationError[] };

// =====================================================
// FORM STATE TRANSITION TYPES
// =====================================================

export type FormTransition = 
  | { type: 'UPDATE_FIELD'; field: string; value: any }
  | { type: 'VALIDATE_FIELD'; field: string }
  | { type: 'VALIDATE_STEP'; step: TripCreationStep }
  | { type: 'NEXT_STEP'; from: TripCreationStep; to: TripCreationStep }
  | { type: 'PREV_STEP'; from: TripCreationStep; to: TripCreationStep }
  | { type: 'SUBMIT_FORM'; data: TripFormData }
  | { type: 'RESET_FORM' }
  | { type: 'SET_ERRORS'; errors: ValidationError[] };

export type FormReducer = (state: FormState<TripFormData>, action: FormTransition) => FormState<TripFormData>;

// =====================================================
// ADVANCED UTILITY TYPES
// =====================================================

// Deep partial for nested objects
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Pick by value type
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

// Extract coordinate fields
type CoordinateFields<T> = PickByType<T, [number, number]>;

// Extract date fields
type DateFields<T> = PickByType<T, string>;

// Extract array fields
type ArrayFields<T> = {
  [K in keyof T]: T[K] extends any[] ? K : never
}[keyof T];

// =====================================================
// TYPE GUARDS FOR TRIP CREATION
// =====================================================

export function isSuccessfulTripCreation(response: TripCreationResponse): response is Extract<TripCreationResponse, { success: true }> {
  return response.success === true;
}

export function isFailedTripCreation(response: TripCreationResponse): response is Extract<TripCreationResponse, { success: false }> {
  return response.success === false;
}

export function isFieldError(error: ValidationError): error is Extract<ValidationError, { type: 'field' }> {
  return error.type === 'field';
}

export function isCrossFieldError(error: ValidationError): error is Extract<ValidationError, { type: 'cross_field' }> {
  return error.type === 'cross_field';
}

export function isValidationError<T>(result: ValidationResult<T>): result is Extract<ValidationResult<T>, { status: 'invalid' }> {
  return result.status === 'invalid';
}

export function isValidValidation<T>(result: ValidationResult<T>): result is Extract<ValidationResult<T>, { status: 'valid' }> {
  return result.status === 'valid';
}

// =====================================================
// SMART DEFAULTS TYPES
// =====================================================

export interface UserTripPreferences {
  defaultCostSharing: CostSharingMethod;
  defaultGenderPreference: GenderPreference;
  defaultWaitingTime: number;
  defaultMaxPax: number;
  favoriteTags: string[];
  commonDestinations: LocationInput[];
  commonPickupPoints: LocationInput[];
}

export interface SmartDefaults {
  suggestions: Partial<TripFormData>;
  confidence: Record<keyof TripFormData, number>;
  reasoning: Record<keyof TripFormData, string>;
}

// =====================================================
// FORM BUILDER PATTERN TYPES
// =====================================================

export class TripFormBuilder<T extends Record<string, any> = {}> {
  private data: Partial<T> = {};
  private validation: ValidationConfig<T>['rules'] = {};

  withData<K extends string, V>(field: K, value: V): TripFormBuilder<T & Record<K, V>> {
    this.data[field as keyof T] = value as any;
    return this as any;
  }

  withValidation<K extends keyof T>(
    field: K, 
    rule: ValidationRule<T, K>
  ): TripFormBuilder<T> {
    if (!this.validation[field]) {
      this.validation[field] = [];
    }
    this.validation[field]!.push(rule);
    return this;
  }

  build(): { data: Partial<T>; validation: ValidationConfig<T>['rules'] } {
    return {
      data: this.data,
      validation: this.validation,
    };
  }
}

// =====================================================
// AUTO-SAVE AND PERSISTENCE TYPES
// =====================================================

export interface FormDraft {
  id: string;
  step: TripCreationStep;
  data: DeepPartial<TripFormData>;
  timestamp: Date;
  version: string;
}

export interface AutoSaveConfig {
  enabled: boolean;
  debounceMs: number;
  storageKey: string;
  maxDrafts: number;
  cleanupAfterDays: number;
}

// =====================================================
// TYPE ASSERTION HELPERS
// =====================================================

export type AssertEqual<T, U> = [T] extends [U] ? [U] extends [T] ? true : false : false;

// Compile-time type tests
type TestTripTypes = {
  testFormDataStructure: AssertEqual<
    TripFormData,
    {
      start_date: string;
      end_date: string;
      joined_by: string;
      region_address: string;
      region_coordinates: [number, number];
      title: string;
      description: string;
      slug: string;
      tags: string[];
      max_pax: number;
      gender_preference: GenderPreference;
      cost_sharing: CostSharingMethod;
      estimated_budget: number | null;
      pickup_address: string;
      pickup_coordinates: [number, number];
      pickup_dates: string;
      waiting_time: number;
      dropoff_address: string;
      dropoff_coordinates: [number, number];
      dropoff_dates: string;
    }
  >;
  testResponseDiscrimination: AssertEqual<
    TripCreationResponse,
    { success: true; trip_id: string; data: TripCreationSummary } | { success: false; error: TripCreationError }
  >;
  testErrorDiscrimination: AssertEqual<
    TripCreationError,
    { code: 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'CONSTRAINT_VIOLATION' | 'PERMISSION_DENIED' | 'DEPENDENCY_FAILED' | 'UNKNOWN_ERROR' }
  >;
};