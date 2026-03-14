import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabase.zapmaxx.com.br';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.oZLb7-dVHorv0edH8kS9IWjO7uF0Fzll3ii7FA881DU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
