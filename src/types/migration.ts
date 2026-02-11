/**
 * Advanced Migration Types with Conditional Types and Discriminated Unions
 * Built using TypeScript advanced patterns for type-safe database migrations
 */

// =====================================================
// CORE MIGRATION TYPES
// =====================================================

export type MigrationVersion = `${number}.${number}.${number}`; // Semantic versioning pattern
export type MigrationStatus = 
  | { type: 'pending'; createdAt: Date; dependencies?: string[] }
  | { type: 'running'; startedAt: Date; progress: number }
  | { type: 'completed'; completedAt: Date; duration: number; checksum: string }
  | { type: 'failed'; failedAt: Date; error: string; retryCount: number }
  | { type: 'rolled_back'; rolledBackAt: Date; previousVersion: MigrationVersion };

export type MigrationDirection = 'up' | 'down';

export interface Migration<Name extends string = string, Version extends MigrationVersion = MigrationVersion> {
  name: Name;
  version: Version;
  description: string;
  status: MigrationStatus;
  dependencies: string[];
  checksum: string;
  rollbackScript?: string;
}

// =====================================================
// CONDITIONAL TYPES FOR MIGRATION OPERATIONS
// =====================================================

type ExtractMigrationName<T extends string> = 
  T extends `${infer Name}.${number}.${number}` ? Name : never;

type ExtractVersionNumber<T extends string> = 
  T extends `${string}.${infer Major}.${infer Minor}` ? `${Major}.${Minor}` : never;

type IsNewerVersion<V1 extends MigrationVersion, V2 extends MigrationVersion> = 
  ExtractVersionNumber<V1> extends ExtractVersionNumber<V2> 
    ? false 
    : true;

type MigrationState<T extends Migration> = {
  [K in keyof T]: T[K];
} & {
  direction: MigrationDirection;
  timestamp: Date;
};

// =====================================================
// TYPE-SAFE MIGRATION RESULT TYPES
// =====================================================

export type MigrationResult<T> = 
  | { success: true; data: T; warnings?: string[] }
  | { success: false; error: MigrationError };

export type MigrationError = 
  | { code: 'VALIDATION_FAILED'; field: string; message: string }
  | { code: 'DEPENDENCY_MISSING'; dependency: string; message: string }
  | { code: 'VERSION_CONFLICT'; current: MigrationVersion; required: MigrationVersion }
  | { code: 'DATABASE_ERROR'; sqlState: string; message: string }
  | { code: 'ROLLBACK_FAILED'; reason: string; message: string }
  | { code: 'CHECKSUM_MISMATCH'; expected: string; actual: string }
  | { code: 'PERMISSION_DENIED'; operation: string; message: string };

// =====================================================
// MIGRATION CONFIGURATION TYPES
// =====================================================

export interface MigrationConfig {
  databaseUrl: string;
  migrationsPath: string;
  backupPath: string;
  retryAttempts: number;
  timeoutMs: number;
  dryRun: boolean;
  force: boolean;
}

export type MigrationOptions = {
  targetVersion?: MigrationVersion;
  direction?: MigrationDirection;
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
  verbose?: boolean;
};

// =====================================================
// MIGRATION EXECUTION CONTEXT
// =====================================================

export interface MigrationContext {
  version: MigrationVersion;
  direction: MigrationDirection;
  transaction: any; // Database transaction object
  logger: MigrationLogger;
  config: MigrationConfig;
}

export interface MigrationLogger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

// =====================================================
// TYPE GUARDS AND PREDICATES
// =====================================================

export function isPendingMigration(status: MigrationStatus): status is Extract<MigrationStatus, { type: 'pending' }> {
  return status.type === 'pending';
}

export function isCompletedMigration(status: MigrationStatus): status is Extract<MigrationStatus, { type: 'completed' }> {
  return status.type === 'completed';
}

export function isFailedMigration(status: MigrationStatus): status is Extract<MigrationStatus, { type: 'failed' }> {
  return status.type === 'failed';
}

export function isRollbackMigration(status: MigrationStatus): status is Extract<MigrationStatus, { type: 'rolled_back' }> {
  return status.type === 'rolled_back';
}

export function isSuccessfulMigration<T>(result: MigrationResult<T>): result is Extract<MigrationResult<T>, { success: true }> {
  return result.success === true;
}

export function isFailedMigrationResult<T>(result: MigrationResult<T>): result is Extract<MigrationResult<T>, { success: false }> {
  return result.success === false;
}

// =====================================================
// UTILITY TYPES FOR MIGRATION OPERATIONS
// =====================================================

type MigrationFunction<T extends MigrationContext> = (context: T) => Promise<void>;
type RollbackFunction<T extends MigrationContext> = (context: T) => Promise<void>;

export interface MigrationScript<T extends MigrationContext = MigrationContext> {
  up: MigrationFunction<T>;
  down?: RollbackFunction<T>;
  validate?: (context: T) => Promise<boolean>;
}

// Database operation result type
export type DatabaseResult<T> = 
  | { success: true; rows: T[]; affectedRows?: number }
  | { success: false; error: string; sqlState: string };

// Migration step result
export type MigrationStepResult = 
  | { step: string; status: 'completed'; duration: number }
  | { step: string; status: 'failed'; error: string; duration: number };

// =====================================================
// TYPE ASSERTION HELPERS
// =====================================================

export type AssertEqual<T, U> = [T] extends [U] ? [U] extends [T] ? true : false : false;
export type ExpectError<T extends never> = T;

// Type tests (compile-time validation)
type TestMigrationTypes = {
  testVersionFormat: AssertEqual<MigrationVersion, '1.0.0'>;
  testStatusDiscrimination: AssertEqual<
    MigrationStatus,
    { type: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back' }
  >;
  testResultDiscrimination: AssertEqual<
    MigrationResult<string>,
    { success: true; data: string; warnings?: string[] } | { success: false; error: MigrationError }
  >;
};