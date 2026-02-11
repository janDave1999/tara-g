// Simple test to verify Supabase connection
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

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

console.log('🔑 Testing Supabase connection...');
console.log('URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
console.log('Service Key:', supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : '❌ Missing');
console.log('Anon Key:', process.env.SUPABASE_ANON_KEY ? `${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...` : '❌ Missing');

try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test a simple query
    const { data, error } = await supabase.from('information_schema.tables').select('table_name').limit(1);
    
    if (error) {
        console.error('❌ Connection test failed:', error);
    } else {
        console.log('✅ Connection successful!');
        console.log('📊 Sample data:', data);
    }
} catch (err) {
    console.error('❌ Connection error:', err.message);
}