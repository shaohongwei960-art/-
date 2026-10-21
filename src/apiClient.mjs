const env=import.meta.env||{};
export const apiBaseUrl=String(env.VITE_API_BASE_URL||'').trim().replace(/\/+$/,'');
export const apiConfigured=Boolean(apiBaseUrl);

export class ApiRequestError extends Error{
 constructor(status,code,message){super(message);this.name='ApiRequestError';this.status=status;this.code=code}
}

export function createApiClient({baseUrl=apiBaseUrl,accessToken,fetchImpl=globalThis.fetch}={}){
 if(!baseUrl)throw new Error('VITE_API_BASE_URL is not configured.');
 if(typeof fetchImpl!=='function')throw new Error('A Fetch-compatible implementation is required.');
 const root=`${baseUrl}${baseUrl.endsWith('/api')?'/v1':'/api/v1'}`;
 async function request(path,{method='GET',body,query}={}){
  const search=query?new URLSearchParams(Object.entries(query).filter(([,value])=>value!==undefined&&value!==null&&value!=='')).toString():'';
  const response=await fetchImpl(`${root}${path}${search?`?${search}`:''}`,{
   method,
   headers:{Accept:'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`} :{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},
   ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  if(response.status===204)return null;
  let payload=null;
  try{payload=await response.json()}catch{}
  if(!response.ok)throw new ApiRequestError(response.status,payload?.error||'request_failed',payload?.message||'The request could not be completed.');
  return payload;
 }
 const byId=id=>encodeURIComponent(String(id));
 return Object.freeze({
  request,
  getProfile:()=>request('/me'),
  updateProfile:patch=>request('/me',{method:'PATCH',body:patch}),
  listListings:query=>request('/listings',{query}),
  listMyListings:()=>request('/me/listings'),
  createListing:payload=>request('/listings',{method:'POST',body:payload}),
  updateListing:(id,payload)=>request(`/me/listings/${byId(id)}`,{method:'PATCH',body:payload}),
  hideListing:id=>request(`/me/listings/${byId(id)}`,{method:'DELETE'}),
  restoreListing:id=>request(`/me/listings/${byId(id)}/restore`,{method:'POST',body:{}}),
  listFavorites:()=>request('/me/favorites'),
  setFavorite:(id,enabled)=>request(`/listings/${byId(id)}/favorite`,{method:enabled?'POST':'DELETE'}),
  listOffers:()=>request('/offers'),
  createOffer:payload=>request('/offers',{method:'POST',body:payload}),
  respondToOffer:(id,action)=>request(`/offers/${byId(id)}/respond`,{method:'POST',body:{action}}),
  confirmHandoff:id=>request(`/offers/${byId(id)}/confirm`,{method:'POST',body:{}}),
  createReview:(id,payload)=>request(`/offers/${byId(id)}/reviews`,{method:'POST',body:payload}),
  getReviews:userId=>request(`/profiles/${byId(userId)}/reviews`),
  listMyReviews:()=>request('/me/reviews'),
  listConversations:()=>request('/conversations'),
  openConversation:listingId=>request('/conversations',{method:'POST',body:{listingId}}),
  listMessages:(conversationId,query)=>request(`/conversations/${byId(conversationId)}/messages`,{query}),
  sendMessage:(conversationId,body)=>request(`/conversations/${byId(conversationId)}/messages`,{method:'POST',body:{body}}),
  createReport:payload=>request('/reports',{method:'POST',body:payload}),
  blockUser:userId=>request('/blocks',{method:'POST',body:{userId}}),
  listBlocks:()=>request('/me/blocks'),
  listMyReports:()=>request('/me/reports')
 });
}
