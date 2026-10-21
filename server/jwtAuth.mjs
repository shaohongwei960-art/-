import {createRemoteJWKSet,jwtVerify} from 'jose';

export function createJwtAuthenticator({jwksUrl,issuer,audience}){
 const jwks=createRemoteJWKSet(new URL(jwksUrl));
 return async token=>{
  const {payload}=await jwtVerify(token,jwks,{issuer,audience});
  if(typeof payload.sub!=='string'||payload.sub.length<1||payload.sub.length>255)throw new Error('Invalid subject');
  const metadata=payload.user_metadata&&typeof payload.user_metadata==='object'?payload.user_metadata:{};
  return {
   subject:payload.sub,
   displayName:String(metadata.display_name||metadata.name||payload.name||'').slice(0,40)
  };
 };
}
