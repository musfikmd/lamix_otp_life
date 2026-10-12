'use strict';

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR_SUPABASE')) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  console.log('✅ Supabase Client Connected Successfully!');
} else {
  console.log('⚠️ Supabase credentials not set or incomplete. Running with in-memory fallback.');
}

module.exports = { supabase };
