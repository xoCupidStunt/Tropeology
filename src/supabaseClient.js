import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase environment variables. Create a .env file (see .env.example) ' +
    'with REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY, or set them in your Vercel project settings.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
