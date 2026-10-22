const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read from .env file
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const SUPABASE_URL = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Supabase URL:", SUPABASE_URL);
  
  // Test listing tables/views by hitting the OpenAPI schema or checking via RPC/queries if possible.
  // We can try to select from 'triagem' and 'provincias' to see if they exist.
  console.log("Checking if 'triagem' exists...");
  const { data: triagemData, error: triagemError } = await supabase
    .from('triagem')
    .select('*')
    .limit(1);
  
  if (triagemError) {
    console.log("Error querying 'triagem':", triagemError.message);
  } else {
    console.log("Successfully queried 'triagem':", triagemData);
  }

  console.log("Checking if 'provincias' exists...");
  const { data: provinciasData, error: provinciasError } = await supabase
    .from('provincias')
    .select('*')
    .limit(1);
  
  if (provinciasError) {
    console.log("Error querying 'provincias':", provinciasError.message);
  } else {
    console.log("Successfully queried 'provincias':", provinciasData);
  }
}

main().catch(err => {
  console.error("Error running script:", err);
});
