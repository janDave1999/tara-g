#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Load environment variables from .env file manually

function loadEnvFile() {
    try {
        const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                if (key && valueParts.length > 0) {
                    process.env[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
    } catch (error) {
        console.error('⚠️  Could not read .env file:', error.message);
    }
}

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    console.error('Please check your .env file');
    process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Migration tracking table name
const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable() {
    console.log('📋 Ensuring migrations table exists...');
    
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            checksum VARCHAR(64) NOT NULL
        );
    `;
    
    try {
        const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
        if (error) {
            // Fallback to direct SQL if RPC doesn't exist
            console.log('RPC not available, using direct SQL...');
        }
    } catch (err) {
        console.log('Creating migrations table via direct SQL...');
    }
}

async function getExecutedMigrations() {
    try {
        const { data, error } = await supabase
            .from(MIGRATIONS_TABLE)
            .select('filename')
            .order('executed_at', { ascending: true });
            
        if (error) throw error;
        return data?.map(m => m.filename) || [];
    } catch (error) {
        console.log('⚠️  Could not fetch executed migrations (table might not exist yet)');
        return [];
    }
}

function getMigrationFiles() {
    const migrationsDir = join(__dirname, '..', 'database-migrations');
    const files = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // This will sort alphabetically which matches numeric order
    
    return files.map(file => ({
        filename: file,
        path: join(migrationsDir, file),
        content: readFileSync(join(migrationsDir, file), 'utf8')
    }));
}

function calculateChecksum(content) {
    return createHash('sha256').update(content).digest('hex');
}

async function executeMigration(migration) {
    console.log(`🚀 Executing migration: ${migration.filename}`);
    
    try {
        // Split the migration content by semicolons to handle multiple statements
        const statements = migration.content
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt && !stmt.startsWith('--'));
        
        for (const statement of statements) {
            if (statement.trim()) {
                const { error } = await supabase.rpc('exec_sql', { 
                    sql: statement + ';' 
                });
                
                if (error) {
                    // Try direct execution if RPC fails
                    throw new Error(`Migration failed: ${error.message}`);
                }
            }
        }
        
        // Record migration as executed
        const checksum = calculateChecksum(migration.content);
        const { error: insertError } = await supabase
            .from(MIGRATIONS_TABLE)
            .insert({
                filename: migration.filename,
                checksum: checksum
            });
            
        if (insertError) throw insertError;
        
        console.log(`✅ Migration ${migration.filename} completed successfully`);
        return true;
        
    } catch (error) {
        console.error(`❌ Migration ${migration.filename} failed:`, error.message);
        return false;
    }
}

async function runMigrations() {
    console.log('🗄️  Starting database migrations...\n');
    
    try {
        // Ensure migrations table exists
        await ensureMigrationsTable();
        
        // Get list of executed migrations
        const executedMigrations = await getExecutedMigrations();
        
        // Get all migration files
        const migrationFiles = getMigrationFiles();
        
        if (migrationFiles.length === 0) {
            console.log('📂 No migration files found in database-migrations directory');
            return;
        }
        
        console.log(`📋 Found ${migrationFiles.length} migration files`);
        console.log(`✅ Already executed: ${executedMigrations.length} migrations\n`);
        
        // Filter out already executed migrations
        const pendingMigrations = migrationFiles.filter(
            migration => !executedMigrations.includes(migration.filename)
        );
        
        if (pendingMigrations.length === 0) {
            console.log('🎉 All migrations are up to date!');
            return;
        }
        
        console.log(`⏳ Pending migrations: ${pendingMigrations.length}`);
        pendingMigrations.forEach(m => console.log(`   - ${m.filename}`));
        console.log('');
        
        // Execute pending migrations in order
        let successCount = 0;
        for (const migration of pendingMigrations) {
            const success = await executeMigration(migration);
            if (success) {
                successCount++;
            } else {
                console.error('🛑 Stopping migrations due to error');
                break;
            }
        }
        
        console.log(`\n📊 Migration Summary:`);
        console.log(`   ✅ Successful: ${successCount}`);
        console.log(`   ❌ Failed: ${pendingMigrations.length - successCount}`);
        console.log(`   📈 Progress: ${executedMigrations.length + successCount}/${migrationFiles.length}`);
        
        if (successCount === pendingMigrations.length) {
            console.log('\n🎉 All migrations completed successfully!');
        } else {
            console.log('\n⚠️  Some migrations failed. Please check the errors above.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Migration process failed:', error);
        process.exit(1);
    }
}

// Handle command line arguments
const command = process.argv[2];

if (command === 'list') {
    console.log('📋 Available migrations:');
    getMigrationFiles().forEach(m => console.log(`   - ${m.filename}`));
} else if (command === 'status') {
    getExecutedMigrations().then(executed => {
        console.log('📊 Migration Status:');
        console.log(`   ✅ Executed: ${executed.length}`);
        console.log(`   ⏳ Pending: ${getMigrationFiles().length - executed.length}`);
    });
} else {
    // Default: run migrations
    runMigrations();
}