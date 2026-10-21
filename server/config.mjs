const csv=value=>String(value||'').split(',').map(part=>part.trim()).filter(Boolean);

export function loadServerConfig(env=process.env){
 const port=Number(env.API_PORT||8080);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('API_PORT must be an integer between 1 and 65535.');
 return Object.freeze({
  host:env.API_HOST||'0.0.0.0',
  port,
  databaseUrl:env.DATABASE_URL||'',
  databaseSsl:env.DATABASE_SSL||'prefer',
  authJwksUrl:env.AUTH_JWKS_URL||'',
  authIssuer:env.AUTH_ISSUER||'',
  authAudience:env.AUTH_AUDIENCE||'',
  allowedOrigins:csv(env.CORS_ALLOWED_ORIGINS),
  logLevel:env.LOG_LEVEL||'info',
  nodeEnv:env.NODE_ENV||'development'
 });
}

export function assertServerConfig(config){
 const missing=[];
 if(!config.databaseUrl)missing.push('DATABASE_URL');
 if(!config.authJwksUrl)missing.push('AUTH_JWKS_URL');
 if(!config.authIssuer)missing.push('AUTH_ISSUER');
 if(!config.authAudience)missing.push('AUTH_AUDIENCE');
 if(missing.length)throw new Error(`Missing required server configuration: ${missing.join(', ')}`);
 let database;
 try{database=new URL(config.databaseUrl)}catch{throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');}
 if(!['postgres:','postgresql:'].includes(database.protocol))throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
 let jwks;
 try{jwks=new URL(config.authJwksUrl)}catch{throw new Error('AUTH_JWKS_URL must be a valid URL.');}
 const localDevelopment=config.nodeEnv!=='production'&&['localhost','127.0.0.1','::1'].includes(jwks.hostname);
 if(jwks.protocol!=='https:'&&!localDevelopment)throw new Error('AUTH_JWKS_URL must use HTTPS except on localhost during development.');
 return config;
}
