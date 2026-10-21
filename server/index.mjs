import pg from 'pg';
import {loadServerConfig,assertServerConfig} from './config.mjs';
import {createJwtAuthenticator} from './jwtAuth.mjs';
import {createPostgresRepository} from './postgresRepository.mjs';
import {buildApi} from './app.mjs';

const config=assertServerConfig(loadServerConfig());
const {Pool}=pg;
const pool=new Pool({
 connectionString:config.databaseUrl,
 max:10,
 idleTimeoutMillis:30_000,
 connectionTimeoutMillis:5_000,
 ssl:config.databaseSsl==='require'?{rejectUnauthorized:true}:undefined
});
const repository=createPostgresRepository(pool);
const authenticate=createJwtAuthenticator({jwksUrl:config.authJwksUrl,issuer:config.authIssuer,audience:config.authAudience});
const app=buildApi({repository,authenticate,allowedOrigins:config.allowedOrigins,logger:{level:config.logLevel}});

await app.listen({host:config.host,port:config.port});
app.log.info({port:config.port},'Huanhuan API listening');

let closing=false;
async function close(signal){
 if(closing)return;closing=true;
 app.log.info({signal},'Shutting down API');
 try{await app.close();await pool.end();process.exitCode=0}
 catch(error){app.log.error({err:error},'Shutdown failed');process.exitCode=1}
}
process.once('SIGINT',()=>void close('SIGINT'));
process.once('SIGTERM',()=>void close('SIGTERM'));
