import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const authConfigured=Boolean(url&&key&&/^https:\/\//.test(url));
// Only a publishable/anon key belongs in browser code, NEVER a service-role key.
export const authClient=authConfigured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}):null;
export const authRedirect=()=>`${location.origin}/`;
