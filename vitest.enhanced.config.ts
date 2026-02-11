import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    // Test environment configuration
    environment: 'node',
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/testing/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 80,
          statements: 80
        },
        // Critical paths should have higher coverage
        'src/actions/trips.ts': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    
    // Test organization
    include: [
      'src/testing/**/*.{test,spec}.{js,ts,jsx,tsx}'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '.git/',
      'coverage/'
    ],
    
    // Performance testing
    setupFiles: ['src/testing/utils/test-setup.ts'],
    testTimeout: 10000, // 10 seconds for complex tests
    hookTimeout: 10000,
    
    // Reporting
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results.xml'
    },
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 2
      }
    }
  },
  
  // // Define custom test suites
  // testMatch: {
  //   unit: 'src/testing/unit/**/*.test.ts',
  //   integration: 'src/testing/integration/**/*.test.ts',
  //   performance: 'src/testing/performance/**/*.test.ts'
  // }
});
