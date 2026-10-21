import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {ApiError} from './errors.mjs';

const categories=['electronics','books_media','home','outdoors','clothing','other'];
const conditions=['like_new','good','visible_wear'];
const uuid={type:'string',format:'uuid'};

const fail=(status,code,message)=>{throw new ApiError(status,code,message)};
function tokenFrom(request){
 const header=request.headers.authorization||'';
 const match=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(header);
 if(!match)fail(401,'unauthorized','Sign-in is required.');
 return match[1];
}
function requireUser(authenticate,repository){
 return async(request,reply)=>{
  let principal;
  try{principal=await authenticate(tokenFrom(request))}catch{return reply.code(401).send({error:'unauthorized',message:'The session is invalid or expired.'})}
  if(!principal?.subject)return reply.code(401).send({error:'unauthorized',message:'The session is invalid or expired.'});
  try{
   request.user=await repository.ensureProfile(principal);
   if(request.user.accountStatus!=='active')return reply.code(403).send({error:'account_unavailable',message:'This account is not available.'});
  }catch(error){request.log.error({err:error},'Unable to load account profile');return reply.code(503).send({error:'service_unavailable',message:'The account service is temporarily unavailable.'})}
 };
}
async function requireModerator(request,reply){
 if(!['moderator','admin'].includes(request.user?.accountRole))return reply.code(403).send({error:'moderator_required',message:'Moderator privileges are required.'});
}
function safeStorageKey(value){return typeof value==='string'&&value.length<=240&&!value.startsWith('/')&&!value.includes('..')&&/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(value)}

export function buildApi({repository,authenticate,allowedOrigins=[],logger=false,rateLimitOptions={}}){
 if(!repository)throw new Error('A repository implementation is required.');
 if(typeof authenticate!=='function')throw new Error('A JWT authenticator is required.');
 const app=Fastify({logger,bodyLimit:64*1024,trustProxy:false});
 app.register(helmet,{contentSecurityPolicy:false});
 app.register(cors,{origin:allowedOrigins.length?allowedOrigins:false,credentials:true,methods:['GET','POST','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Authorization']});
 app.register(rateLimit,{max:120,timeWindow:'1 minute',...rateLimitOptions});
 const auth=requireUser(authenticate,repository);

 app.setErrorHandler((error,request,reply)=>{
  if(error instanceof ApiError)return reply.code(error.statusCode).send({error:error.code,message:error.message});
  if(error.validation)return reply.code(400).send({error:'invalid_request',message:'Request fields are invalid.'});
  request.log.error({err:error},'Unhandled API error');
  return reply.code(500).send({error:'internal_error',message:'The request could not be completed.'});
 });
 app.setNotFoundHandler((_request,reply)=>reply.code(404).send({error:'not_found',message:'The requested endpoint was not found.'}));

 app.get('/health/live',{config:{rateLimit:false}},async()=>({status:'ok'}));
 app.get('/health/ready',{config:{rateLimit:false}},async(_request,reply)=>{
  try{await repository.health();return {status:'ready'}}catch{reply.code(503);return {status:'not_ready'}}
 });

 app.get('/api/v1/me',{preHandler:auth},async request=>request.user);
 app.patch('/api/v1/me',{
  preHandler:auth,
  schema:{body:{type:'object',additionalProperties:false,minProperties:1,properties:{displayName:{type:'string',minLength:1,maxLength:40},countryCode:{type:'string',pattern:'^[A-Z]{2}$'},city:{type:'string',maxLength:80},locale:{type:'string',minLength:2,maxLength:16,pattern:'^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$'}}}}
 },async request=>repository.updateProfile(request.user.id,request.body));
 app.get('/api/v1/me/listings',{preHandler:auth},async request=>({items:await repository.listMyListings(request.user.id)}));
 app.patch('/api/v1/me/listings/:listingId',{
  preHandler:auth,
  schema:{params:{type:'object',required:['listingId'],properties:{listingId:uuid}},body:{type:'object',additionalProperties:false,required:['title','description','flaws','category','condition','desiredItems','countryCode','city'],properties:{title:{type:'string',minLength:2,maxLength:80},description:{type:'string',minLength:5,maxLength:3000},flaws:{type:'string',minLength:1,maxLength:500},category:{type:'string',enum:categories},condition:{type:'string',enum:conditions},desiredItems:{type:'string',maxLength:200},imageKey:{type:'string',minLength:1,maxLength:240},countryCode:{type:'string',pattern:'^[A-Z]{2}$'},city:{type:'string',minLength:1,maxLength:80},area:{type:'string',maxLength:80}}}}
 },async request=>{
  if(request.body.imageKey&&!safeStorageKey(request.body.imageKey))fail(400,'invalid_image_key','The image must be uploaded to the configured image service first.');
  return repository.updateListing(request.user.id,request.params.listingId,request.body);
 });
 app.delete('/api/v1/me/listings/:listingId',{
  preHandler:auth,
  schema:{params:{type:'object',required:['listingId'],properties:{listingId:uuid}}}
 },async(request,reply)=>{await repository.hideListing(request.user.id,request.params.listingId);return reply.code(204).send()});
 app.post('/api/v1/me/listings/:listingId/restore',{
  preHandler:auth,
  schema:{params:{type:'object',required:['listingId'],properties:{listingId:uuid}}}
 },async request=>repository.restoreListing(request.user.id,request.params.listingId));
 app.get('/api/v1/me/favorites',{preHandler:auth},async request=>({items:await repository.listFavorites(request.user.id)}));
 app.get('/api/v1/me/blocks',{preHandler:auth},async request=>({items:await repository.listBlocks(request.user.id)}));
 app.get('/api/v1/me/reports',{preHandler:auth},async request=>({items:await repository.listMyReports(request.user.id)}));
 app.get('/api/v1/listings',{
  schema:{querystring:{type:'object',additionalProperties:false,properties:{countryCode:{type:'string',pattern:'^[A-Z]{2}$'},city:{type:'string',maxLength:80},category:{type:'string',enum:categories},limit:{type:'integer',minimum:1,maximum:50,default:20},offset:{type:'integer',minimum:0,maximum:10000,default:0}}}}
 },async request=>({items:await repository.listListings(request.query)}));
 app.post('/api/v1/listings',{
  preHandler:auth,
  schema:{body:{type:'object',additionalProperties:false,required:['title','description','flaws','category','condition','imageKey','countryCode','city'],properties:{title:{type:'string',minLength:2,maxLength:80},description:{type:'string',minLength:5,maxLength:3000},flaws:{type:'string',minLength:1,maxLength:500},category:{type:'string',enum:categories},condition:{type:'string',enum:conditions},desiredItems:{type:'string',maxLength:200},imageKey:{type:'string',minLength:1,maxLength:240},countryCode:{type:'string',pattern:'^[A-Z]{2}$'},city:{type:'string',minLength:1,maxLength:80},area:{type:'string',maxLength:80}}}}
 },async(request,reply)=>{
  if(!safeStorageKey(request.body.imageKey))fail(400,'invalid_image_key','The image must be uploaded to the configured image service first.');
  const listing=await repository.createListing(request.user.id,request.body);
  return reply.code(201).send(listing);
 });
 app.post('/api/v1/listings/:listingId/favorite',{
  preHandler:auth,
  schema:{params:{type:'object',required:['listingId'],properties:{listingId:uuid}}}
 },async(request,reply)=>{await repository.setFavorite(request.user.id,request.params.listingId,true);return reply.code(204).send()});
 app.delete('/api/v1/listings/:listingId/favorite',{
  preHandler:auth,
  schema:{params:{type:'object',required:['listingId'],properties:{listingId:uuid}}}
 },async(request,reply)=>{await repository.setFavorite(request.user.id,request.params.listingId,false);return reply.code(204).send()});

 app.get('/api/v1/offers',{preHandler:auth},async request=>({items:await repository.listOffers(request.user.id)}));
 app.post('/api/v1/offers',{
  preHandler:auth,
  schema:{body:{type:'object',additionalProperties:false,required:['requestedListingId','offeredListingId'],properties:{requestedListingId:uuid,offeredListingId:uuid,note:{type:'string',maxLength:500,default:''}}}}
 },async(request,reply)=>reply.code(201).send(await repository.createOffer(request.user.id,request.body)));
 app.post('/api/v1/offers/:offerId/respond',{
  preHandler:auth,
  schema:{params:{type:'object',required:['offerId'],properties:{offerId:uuid}},body:{type:'object',additionalProperties:false,required:['action'],properties:{action:{type:'string',enum:['accept','reject','cancel']}}}}
 },async(request)=>repository.respondToOffer(request.user.id,request.params.offerId,request.body.action));
 app.post('/api/v1/offers/:offerId/confirm',{
  preHandler:auth,
  schema:{params:{type:'object',required:['offerId'],properties:{offerId:uuid}}}
 },async(request)=>repository.confirmHandoff(request.user.id,request.params.offerId));
 app.post('/api/v1/offers/:offerId/reviews',{
  preHandler:auth,
  schema:{params:{type:'object',required:['offerId'],properties:{offerId:uuid}},body:{type:'object',additionalProperties:false,required:['stars'],properties:{stars:{type:'integer',minimum:1,maximum:5},body:{type:'string',maxLength:1000,default:''}}}}
 },async(request,reply)=>reply.code(201).send(await repository.createReview(request.user.id,request.params.offerId,request.body)));
 app.get('/api/v1/me/reviews',{preHandler:auth},async request=>repository.listMyReviews(request.user.id));
 app.get('/api/v1/profiles/:userId/reviews',{
  schema:{params:{type:'object',required:['userId'],properties:{userId:uuid}}}
 },async request=>repository.listReviews(request.params.userId));

 app.get('/api/v1/conversations',{preHandler:auth},async request=>({items:await repository.listConversations(request.user.id)}));
 app.post('/api/v1/conversations',{
  preHandler:auth,
  schema:{body:{type:'object',additionalProperties:false,required:['listingId'],properties:{listingId:uuid}}}
 },async(request,reply)=>reply.code(201).send(await repository.openConversation(request.user.id,request.body.listingId)));
 app.get('/api/v1/conversations/:conversationId/messages',{
  preHandler:auth,
  schema:{params:{type:'object',required:['conversationId'],properties:{conversationId:uuid}},querystring:{type:'object',additionalProperties:false,properties:{limit:{type:'integer',minimum:1,maximum:100,default:100}}}}
 },async request=>({items:await repository.listMessages(request.user.id,request.params.conversationId,request.query)}));
 app.post('/api/v1/conversations/:conversationId/messages',{
  preHandler:auth,
  schema:{params:{type:'object',required:['conversationId'],properties:{conversationId:uuid}},body:{type:'object',additionalProperties:false,required:['body'],properties:{body:{type:'string',minLength:1,maxLength:2000}}}}
 },async(request,reply)=>reply.code(201).send(await repository.sendMessage(request.user.id,request.params.conversationId,request.body.body)));

 app.post('/api/v1/reports',{
  preHandler:auth,
  schema:{body:{type:'object',additionalProperties:false,required:['targetType','targetId','reason'],properties:{targetType:{type:'string',enum:['listing','user','message']},targetId:uuid,reason:{type:'string',minLength:2,maxLength:80},details:{type:'string',maxLength:1000,default:''}}}}
 },async(request,reply)=>reply.code(201).send(await repository.createReport(request.user.id,request.body)));
 app.post('/api/v1/blocks',{
  preHandler:auth,
  schema:{body:{type:'object',additionalProperties:false,required:['userId'],properties:{userId:uuid}}}
 },async(request,reply)=>{await repository.blockUser(request.user.id,request.body.userId);return reply.code(204).send()});

 app.get('/api/v1/admin/listings/pending',{preHandler:[auth,requireModerator]},async()=>({items:await repository.listPendingListings()}));
 app.post('/api/v1/admin/listings/:listingId/moderate',{
  preHandler:[auth,requireModerator],
  schema:{params:{type:'object',required:['listingId'],properties:{listingId:uuid}},body:{type:'object',additionalProperties:false,required:['decision'],properties:{decision:{type:'string',enum:['approve','reject']},reason:{type:'string',maxLength:1000,default:''}}}}
 },async request=>repository.moderateListing(request.user.id,request.params.listingId,request.body));
 app.get('/api/v1/admin/reports',{
  preHandler:[auth,requireModerator],
  schema:{querystring:{type:'object',additionalProperties:false,properties:{status:{type:'string',enum:['open','reviewing'],default:'open'}}}}
 },async request=>({items:await repository.listReports(request.query)}));
 app.post('/api/v1/admin/reports/:reportId/resolve',{
  preHandler:[auth,requireModerator],
  schema:{params:{type:'object',required:['reportId'],properties:{reportId:uuid}},body:{type:'object',additionalProperties:false,required:['decision'],properties:{decision:{type:'string',enum:['resolve','dismiss']},reason:{type:'string',maxLength:1000,default:''}}}}
 },async request=>repository.resolveReport(request.user.id,request.params.reportId,request.body));

 return app;
}
