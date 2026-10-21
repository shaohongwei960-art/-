import {randomUUID} from 'node:crypto';
import {ApiError} from '../errors.mjs';
const fail=(status,code,message)=>{throw new ApiError(status,code,message)};
const now=()=>new Date().toISOString();

export function createMemoryRepository(){
 const profiles=new Map(),subjects=new Map(),listings=new Map(),offers=new Map(),favorites=new Set(),blocks=new Set(),reports=[],conversations=new Map(),messages=new Map(),reviews=[];
 const blockKey=(a,b)=>`${a}:${b}`;
 const isBlocked=(a,b)=>blocks.has(blockKey(a,b))||blocks.has(blockKey(b,a));
 const listingView=item=>({...item});
 const offerView=offer=>({...offer});
 const getListing=(id)=>listings.get(id);
 const conversationView=(conversation,userId)=>{
  const otherUserId=conversation.ownerId===userId?conversation.guestId:conversation.ownerId;
  const thread=messages.get(conversation.id)||[],lastMessage=thread.at(-1);
  return {id:conversation.id,listingId:conversation.listingId,listingTitle:getListing(conversation.listingId)?.title||'',otherUserId,otherUserName:profiles.get(otherUserId)?.displayName||'User',lastMessage:lastMessage?.body||'',lastMessageAt:lastMessage?.createdAt||conversation.updatedAt,updatedAt:conversation.updatedAt};
 };
 return Object.freeze({
  async health(){return true},
  async ensureProfile(principal){
   let id=subjects.get(principal.subject);
   if(!id){id=randomUUID();subjects.set(principal.subject,id);profiles.set(id,{id,displayName:principal.displayName||'Demo user',countryCode:'CN',city:null,locale:'zh-CN',accountRole:'user',accountStatus:'active'})}
   return {...profiles.get(id)};
  },
  async updateProfile(userId,input){
   const profile=profiles.get(userId);if(!profile||profile.accountStatus!=='active')fail(404,'profile_not_found','This profile is unavailable.');
   for(const field of ['displayName','countryCode','locale'])if(input[field]!==undefined)profile[field]=input[field].trim();
   if(input.city!==undefined)profile.city=input.city.trim()||null;
   profile.updatedAt=now();return {...profile};
  },
  async listListings({countryCode,city,category,limit=20,offset=0}={}){
   return [...listings.values()].filter(item=>item.status==='available'&&item.moderationStatus==='approved'&&(!countryCode||item.countryCode===countryCode)&&(!city||item.city===city)&&(!category||item.category===category)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(offset,offset+limit).map(listingView);
  },
  async listMyListings(userId){return [...listings.values()].filter(item=>item.ownerId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(listingView)},
  async updateListing(ownerId,listingId,input){
   const item=getListing(listingId);if(!item||item.ownerId!==ownerId)fail(404,'listing_not_found','This listing was not found.');
   if(['reserved','exchanged','pending_review'].includes(item.status))fail(409,'listing_not_editable','This listing cannot be edited in its current state.');
   Object.assign(item,{title:input.title.trim(),description:input.description.trim(),flaws:input.flaws.trim(),category:input.category,condition:input.condition,desiredItems:input.desiredItems.trim()||'Any reasonable offer',imageKey:input.imageKey||item.imageKey,countryCode:input.countryCode,city:input.city.trim(),area:input.area?.trim()||null,status:'pending_review',moderationStatus:'pending',updatedAt:now()});
   delete item.moderationReason;
   for(const offer of offers.values())if(offer.status==='pending'&&(offer.requestedListingId===listingId||offer.offeredListingId===listingId)){offer.status='cancelled';offer.updatedAt=now()}
   return listingView(item);
  },
  async hideListing(ownerId,listingId){
   const item=getListing(listingId);if(!item||item.ownerId!==ownerId)fail(404,'listing_not_found','This listing was not found.');
   if(['reserved','exchanged'].includes(item.status))fail(409,'listing_not_hideable','This listing cannot be hidden in its current state.');
   item.status='hidden';item.updatedAt=now();
   for(const offer of offers.values())if(offer.status==='pending'&&(offer.requestedListingId===listingId||offer.offeredListingId===listingId)){offer.status='cancelled';offer.updatedAt=now()}
  },
  async restoreListing(ownerId,listingId){
   const item=getListing(listingId);if(!item||item.ownerId!==ownerId)fail(404,'listing_not_found','This listing was not found.');
   if(item.status!=='hidden'||item.moderationStatus!=='approved')fail(409,'listing_not_restorable','Only an approved, hidden listing can be restored.');
   item.status='available';item.updatedAt=now();return listingView(item);
  },
  async listFavorites(userId){return [...favorites].filter(key=>key.startsWith(`${userId}:`)).map(key=>listings.get(key.slice(userId.length+1))).filter(Boolean).map(listingView)},
  async listBlocks(userId){return [...blocks].filter(key=>key.startsWith(`${userId}:`)).map(key=>({userId:key.slice(userId.length+1)}))},
  async listMyReports(userId){return reports.filter(report=>report.reporterId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(report=>({...report}))},
  async createListing(ownerId,input){
   const owner=profiles.get(ownerId);if(!owner||owner.accountStatus!=='active')fail(403,'account_unavailable','This account cannot publish listings.');
   const item={id:randomUUID(),ownerId,ownerName:owner.displayName,title:input.title.trim(),description:input.description.trim(),flaws:input.flaws.trim(),category:input.category,condition:input.condition,desiredItems:input.desiredItems||'Any reasonable offer',imageKey:input.imageKey,countryCode:input.countryCode,city:input.city.trim(),area:input.area?.trim()||null,status:'pending_review',moderationStatus:'pending',createdAt:now()};
   listings.set(item.id,item);return listingView(item);
  },
  async setFavorite(userId,listingId,enabled){
   const item=getListing(listingId);if(enabled&&(!item||item.status!=='available'||item.moderationStatus!=='approved'||item.ownerId===userId))fail(404,'listing_not_found','This listing is not available.');
   const key=`${userId}:${listingId}`;enabled?favorites.add(key):favorites.delete(key);
  },
  async listOffers(userId){return [...offers.values()].filter(offer=>offer.requesterId===userId||offer.recipientId===userId).map(offer=>({...offerView(offer),requestedListing:listingView(getListing(offer.requestedListingId)),offeredListing:listingView(getListing(offer.offeredListingId))}))},
  async createOffer(requesterId,{requestedListingId,offeredListingId,note=''}){
   const requested=getListing(requestedListingId),offered=getListing(offeredListingId);
   if(!requested||!offered)fail(404,'listing_not_found','One of the listings is unavailable.');
   if(offered.ownerId!==requesterId||requested.ownerId===requesterId)fail(403,'invalid_offer','You can only offer your own item for someone else’s listing.');
   if([requested,offered].some(item=>item.status!=='available'||item.moderationStatus!=='approved'))fail(409,'listing_unavailable','One of the listings is no longer available.');
   if(isBlocked(requesterId,requested.ownerId))fail(403,'blocked','This exchange is unavailable.');
   if([...offers.values()].some(offer=>offer.status==='pending'&&offer.requesterId===requesterId&&offer.requestedListingId===requestedListingId&&offer.offeredListingId===offeredListingId))fail(409,'duplicate_offer','A matching pending offer already exists.');
   const offer={id:randomUUID(),requesterId,recipientId:requested.ownerId,requestedListingId,offeredListingId,note:note.trim(),status:'pending',requesterConfirmed:false,recipientConfirmed:false,createdAt:now(),updatedAt:now()};
   offers.set(offer.id,offer);return offerView(offer);
  },
  async respondToOffer(userId,offerId,action){
   const offer=offers.get(offerId);if(!offer)fail(404,'offer_not_found','This offer was not found.');
   if(action==='accept'||action==='reject'){
    if(offer.recipientId!==userId)fail(403,'not_offer_recipient','Only the listing owner can respond to this offer.');
    if(offer.status!=='pending')fail(409,'offer_not_pending','This offer is no longer pending.');
    if(action==='reject'){offer.status='rejected';offer.updatedAt=now();return offerView(offer)}
    const requested=getListing(offer.requestedListingId),offered=getListing(offer.offeredListingId);
    if(!requested||!offered||requested.ownerId!==userId||offered.ownerId!==offer.requesterId||[requested,offered].some(item=>item.status!=='available'||item.moderationStatus!=='approved'))fail(409,'listing_unavailable','One of the listings is no longer available.');
    if(isBlocked(offer.requesterId,offer.recipientId))fail(403,'blocked','This exchange is unavailable.');
    for(const item of [requested,offered]){item.status='reserved';item.reservedOfferId=offer.id}
    offer.status='accepted';offer.updatedAt=now();
    for(const other of offers.values())if(other.id!==offer.id&&other.status==='pending'&&[other.requestedListingId,other.offeredListingId].some(id=>[requested.id,offered.id].includes(id))){other.status='cancelled';other.updatedAt=now()}
    return offerView(offer);
   }
   if(action==='cancel'){
    if(offer.requesterId!==userId&&offer.recipientId!==userId)fail(403,'not_offer_participant','You are not part of this offer.');
    if(offer.status==='pending'&&offer.requesterId!==userId)fail(403,'not_offer_requester','The recipient cannot cancel a pending offer.');
    if(!['pending','accepted'].includes(offer.status))fail(409,'offer_not_cancellable','This offer cannot be cancelled now.');
    offer.status='cancelled';offer.updatedAt=now();
    for(const item of [getListing(offer.requestedListingId),getListing(offer.offeredListingId)])if(item?.reservedOfferId===offer.id){item.status='available';item.reservedOfferId=null}
    return offerView(offer);
   }
   fail(400,'invalid_action','Unsupported offer action.');
  },
  async confirmHandoff(userId,offerId){
   const offer=offers.get(offerId);if(!offer)fail(404,'offer_not_found','This offer was not found.');
   if(offer.requesterId!==userId&&offer.recipientId!==userId)fail(403,'not_offer_participant','You are not part of this offer.');
   if(!['accepted','partial'].includes(offer.status))fail(409,'offer_not_confirmable','This offer is not awaiting handoff confirmation.');
   if(offer.requesterId===userId)offer.requesterConfirmed=true;else offer.recipientConfirmed=true;
   offer.status=offer.requesterConfirmed&&offer.recipientConfirmed?'completed':'partial';offer.updatedAt=now();
   if(offer.status==='completed')for(const item of [getListing(offer.requestedListingId),getListing(offer.offeredListingId)])if(item?.reservedOfferId===offer.id){item.status='exchanged';item.reservedOfferId=null}
   return offerView(offer);
  },
  async createReport(reporterId,input){
   const targetExists=input.targetType==='listing'?listings.has(input.targetId):input.targetType==='user'?profiles.has(input.targetId):[...messages.values()].some(thread=>thread.some(message=>message.id===input.targetId));
   if(!targetExists)fail(404,'report_target_not_found','The reported content was not found.');
   const report={id:randomUUID(),reporterId,targetType:input.targetType,targetId:input.targetId,reason:input.reason.trim(),details:(input.details||'').trim(),status:'open',createdAt:now()};reports.push(report);return {...report};
  },
  async blockUser(blockerId,blockedId){
   if(blockerId===blockedId)fail(400,'invalid_block','You cannot block your own account.');
   if(!profiles.has(blockedId))fail(404,'user_not_found','This account was not found.');
   blocks.add(blockKey(blockerId,blockedId));
  },
  async openConversation(userId,listingId){
   const existing=[...conversations.values()].find(item=>item.listingId===listingId&&(item.ownerId===userId||item.guestId===userId));
   if(existing){if(isBlocked(existing.ownerId,existing.guestId))fail(403,'blocked','This conversation is unavailable.');return conversationView(existing,userId)}
   const listing=getListing(listingId);if(!listing)fail(404,'listing_not_found','This listing was not found.');
   if(listing.ownerId===userId)fail(400,'invalid_conversation','You cannot start a conversation with yourself.');
   if(listing.status!=='available'||listing.moderationStatus!=='approved')fail(409,'listing_unavailable','This listing is no longer available.');
   if(isBlocked(userId,listing.ownerId))fail(403,'blocked','This conversation is unavailable.');
   const conversation={id:randomUUID(),listingId,ownerId:listing.ownerId,guestId:userId,createdAt:now(),updatedAt:now()};
   conversations.set(conversation.id,conversation);messages.set(conversation.id,[]);return conversationView(conversation,userId);
  },
  async listConversations(userId){
   return [...conversations.values()].filter(item=>(item.ownerId===userId||item.guestId===userId)&&!isBlocked(item.ownerId,item.guestId)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(item=>conversationView(item,userId));
  },
  async listMessages(userId,conversationId,{limit=100}={}){
   const conversation=conversations.get(conversationId);if(!conversation||![conversation.ownerId,conversation.guestId].includes(userId))fail(404,'conversation_not_found','This conversation was not found.');
   if(isBlocked(conversation.ownerId,conversation.guestId))fail(403,'blocked','This conversation is unavailable.');
   return (messages.get(conversationId)||[]).slice(-Math.min(Math.max(Number(limit)||100,1),100)).map(message=>({...message}));
  },
  async sendMessage(userId,conversationId,body){
   const conversation=conversations.get(conversationId);if(!conversation||![conversation.ownerId,conversation.guestId].includes(userId))fail(404,'conversation_not_found','This conversation was not found.');
   if(isBlocked(conversation.ownerId,conversation.guestId))fail(403,'blocked','This conversation is unavailable.');
   const text=body.trim();if(!text||text.length>2000||Array.from(text).some(char=>{const code=char.codePointAt(0);return code<32||code===127}))fail(400,'invalid_message','Message text is invalid.');
   const message={id:randomUUID(),conversationId,senderId:userId,body:text,createdAt:now()};messages.get(conversationId).push(message);conversation.updatedAt=message.createdAt;return {...message};
  },
  async createReview(reviewerId,offerId,{stars,body=''}){
   const offer=offers.get(offerId);if(!offer)fail(404,'offer_not_found','This offer was not found.');
   if(offer.status!=='completed')fail(409,'review_not_available','Reviews are available after both users confirm the exchange.');
   if(![offer.requesterId,offer.recipientId].includes(reviewerId))fail(403,'not_offer_participant','You are not part of this exchange.');
   if(reviews.some(review=>review.offerId===offerId&&review.reviewerId===reviewerId))fail(409,'review_exists','You have already reviewed this exchange.');
   const review={id:randomUUID(),offerId,reviewerId,revieweeId:offer.requesterId===reviewerId?offer.recipientId:offer.requesterId,reviewerName:profiles.get(reviewerId)?.displayName||'User',stars,body:body.trim(),createdAt:now()};reviews.push(review);return {...review};
  },
  async listReviews(userId){
   const items=reviews.filter(review=>review.revieweeId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(review=>({...review}));
   const average=items.length?items.reduce((sum,review)=>sum+review.stars,0)/items.length:null;
   return {items,reviewCount:reviews.filter(review=>review.revieweeId===userId).length,averageStars:average===null?null:Number(average.toFixed(2))};
  },
  async listMyReviews(userId){return {items:reviews.filter(review=>review.reviewerId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(review=>({...review,revieweeName:profiles.get(review.revieweeId)?.displayName||'User'}))}},
  async listPendingListings(){return [...listings.values()].filter(item=>item.status==='pending_review'&&item.moderationStatus==='pending').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(0,100).map(listingView)},
  async moderateListing(actorId,listingId,{decision,reason=''}){
   const listing=getListing(listingId);if(!listing)fail(404,'listing_not_found','This listing was not found.');
   if(listing.status!=='pending_review'||listing.moderationStatus!=='pending')fail(409,'listing_already_reviewed','This listing has already been reviewed.');
   listing.status=decision==='approve'?'available':'rejected';listing.moderationStatus=decision==='approve'?'approved':'rejected';listing.moderationReason=reason.trim();listing.moderatedBy=actorId;listing.updatedAt=now();return listingView(listing);
  },
  async listReports({status='open'}={}){return reports.filter(report=>report.status===status).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(0,100).map(report=>({...report}))},
  async resolveReport(actorId,reportId,{decision,reason=''}){
   const report=reports.find(item=>item.id===reportId);if(!report)fail(404,'report_not_found','This report was not found.');
   if(!['open','reviewing'].includes(report.status))fail(409,'report_already_resolved','This report has already been closed.');
   report.status=decision==='resolve'?'resolved':'dismissed';report.resolvedAt=now();report.moderatedBy=actorId;report.resolutionReason=reason.trim();return {...report};
  },
  async setAccountRoleForTest(userId,accountRole){const profile=profiles.get(userId);if(profile)profile.accountRole=accountRole},
  async seedApprovedListing(ownerId,input={}){
   const profile=profiles.get(ownerId);if(!profile)throw new Error('Seed owner must exist.');
   const item={id:input.id||randomUUID(),ownerId,ownerName:profile.displayName,title:input.title||'Sample item',description:'A tested sample listing.',flaws:'No known issues.',category:'other',condition:'good',desiredItems:'Any reasonable offer',imageKey:'test/sample.jpg',countryCode:'CN',city:'成都',area:null,status:'available',moderationStatus:'approved',createdAt:now()};
   listings.set(item.id,item);return listingView(item);
  },
  async debugSnapshot(){return {profiles:[...profiles.values()],listings:[...listings.values()],offers:[...offers.values()],favorites:[...favorites],blocks:[...blocks],reports:[...reports],conversations:[...conversations.values()],messages:[...messages.values()].flat(),reviews:[...reviews]}}
 });
}
