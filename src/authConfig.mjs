const env=import.meta.env||{};
const url=env.VITE_SUPABASE_URL;
const anonKey=env.VITE_SUPABASE_ANON_KEY;

export const authProject=Object.freeze({url,anonKey});
export const authConfigured=Boolean(url&&anonKey&&/^https:\/\//.test(url));
export const authRedirect=()=>`${location.origin}/`;
