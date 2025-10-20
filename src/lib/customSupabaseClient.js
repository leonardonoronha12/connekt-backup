import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ucsijwfarkrljbkdvrbd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2lqd2ZhcmtybGpia2R2cmJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDYwODksImV4cCI6MjA3NTk4MjA4OX0.-H3eogCZ4YNE4Fr8y_-c-T88VRGehUGlgiQtr7xaglY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);