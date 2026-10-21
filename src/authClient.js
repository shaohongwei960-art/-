import {createClient} from '@supabase/supabase-js';
import {authConfigured,authProject} from './authConfig.mjs';

// Only a publishable/anon key belongs in browser code, NEVER a service-role key.
export const authClient=authConfigured?createClient(authProject.url,authProject.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}):null;
