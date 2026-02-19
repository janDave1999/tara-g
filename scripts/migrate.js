#!/usr/bin/env node

/**
 * Database migration runner for Tara G!
 *
 * PREREQUISITES — run these once in the Supabase SQL editor before using this script:
 *
 *   -- 1. Migration tracking table
 *   CREATE TABLE IF NOT EXISTS schema_migrations (
 *     id SERIAL PRIMARY KEY,
 *     filename VARCHAR(255) NOT NULL UNIQUE,
 *     executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     checksum VARCHAR(64) NOT NULL
 *   );
 *
 *   -- 2. Helper function that allows the script to execute arbitrary SQL
 *   CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void
 *   LANGUAGE plpgsql SECURITY DEFINER AS $$
 *   BEGIN
 *     EXECUTE sql;
 *   END;
 *   $$;
 *
 * Usage:
 *   node scripts/migrate.js           — run pending migrations
 *   node scripts/migrate.js list      — list all migration files
 *   node scripts/migrate.js status    — show executed vs pending count
 *   node scripts/migrate.js setup     — print the prerequisite SQL above
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

function loadEnvFile() {
    try {
        const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    process.env[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
    } catch {
        console.error('⚠️  Could not read .env file');
    }
}

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const MIGRATIONS_TABLE = 'schema_migrations';

const SETUP_SQL = `
-- Run this once in the Supabase SQL editor before using migrate.js

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64) NOT NULL
);

CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE sql;
END;
$$;
`.trim();

async function checkPrerequisites() {
    // Verify schema_migrations table exists
    const { error } = await supabase.from(MIGRATIONS_TABLE).select('id').limit(1);
    if (error) {
        console.error('❌ Migrations table not found. Run setup SQL first:\n');
        console.log(SETUP_SQL);
        console.error('\nOr run: node scripts/migrate.js setup');
        process.exit(1);
    }

    // Verify exec_sql RPC exists
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
    if (rpcError) {
        console.error('❌ exec_sql function not found. Run setup SQL first:\n');
        console.log(SETUP_SQL);
        console.error('\nOr run: node scripts/migrate.js setup');
        process.exit(1);
    }
}

async function getExecutedMigrations() {
    const { data, error } = await supabase
        .from(MIGRATIONS_TABLE)
        .select('filename')
        .order('executed_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch executed migrations: ${error.message}`);
    return data?.map(m => m.filename) || [];
}

function getMigrationFiles() {
    const migrationsDir = join(__dirname, '..', 'database-migrations');
    const files = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

    return files.map(file => ({
        filename: file,
        path: join(migrationsDir, file),
        content: readFileSync(join(migrationsDir, file), 'utf8'),
    }));
}

function calculateChecksum(content) {
    return createHash('sha256').update(content).digest('hex');
}

async function executeMigration(migration) {
    console.log(`🚀 Executing migration: ${migration.filename}`);

    try {
        const statements = migration.content
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--'));

        for (const statement of statements) {
            if (statement.trim()) {
                const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
                if (error) throw new Error(`Statement failed: ${error.message}`);
            }
        }

        const { error: insertError } = await supabase
            .from(MIGRATIONS_TABLE)
            .insert({ filename: migration.filename, checksum: calculateChecksum(migration.content) });

        if (insertError) throw insertError;

        console.log(`✅ ${migration.filename} completed`);
        return true;
    } catch (error) {
        console.error(`❌ ${migration.filename} failed:`, error.message);
        return false;
    }
}

async function runMigrations() {
    console.log('🗄️  Starting database migrations...\n');

    await checkPrerequisites();

    const executedMigrations = await getExecutedMigrations();
    const migrationFiles = getMigrationFiles();

    if (migrationFiles.length === 0) {
        console.log('📂 No migration files found in database-migrations/');
        return;
    }

    const pending = migrationFiles.filter(m => !executedMigrations.includes(m.filename));

    console.log(`📋 Found ${migrationFiles.length} files | ✅ Executed: ${executedMigrations.length} | ⏳ Pending: ${pending.length}\n`);

    if (pending.length === 0) {
        console.log('🎉 All migrations are up to date!');
        return;
    }

    pending.forEach(m => console.log(`   - ${m.filename}`));
    console.log('');

    let successCount = 0;
    for (const migration of pending) {
        const ok = await executeMigration(migration);
        if (ok) {
            successCount++;
        } else {
            console.error('🛑 Stopping due to error');
            break;
        }
    }

    console.log(`\n📊 Summary: ✅ ${successCount} succeeded | ❌ ${pending.length - successCount} failed`);

    if (successCount < pending.length) {
        process.exit(1);
    } else {
        console.log('🎉 All migrations completed successfully!');
    }
}

const command = process.argv[2];

if (command === 'setup') {
    console.log('Run the following SQL in your Supabase SQL editor:\n');
    console.log(SETUP_SQL);
} else if (command === 'list') {
    console.log('📋 Migration files:');
    getMigrationFiles().forEach(m => console.log(`   - ${m.filename}`));
} else if (command === 'status') {
    getExecutedMigrations().then(executed => {
        const total = getMigrationFiles().length;
        console.log(`📊 Executed: ${executed.length} | Pending: ${total - executed.length} | Total: ${total}`);
    });
} else {
    runMigrations();
}
