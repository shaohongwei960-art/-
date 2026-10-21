import {ApiError} from './errors.mjs';

const publicListing=row=>({
 id:row.id,ownerId:row.owner_id,ownerName:row.owner_name,title:row.title,description:row.description,flaws:row.flaws,
 category:row.category,condition:row.condition,desiredItems:row.desired_items,imageKey:row.image_key,
 countryCode:row.country_code,city:row.city,area:row.area,status:row.status,createdAt:row.created_at
});
const offerView=row=>({
 id:row.id,requesterId:row.requester_id,recipientId:row.recipient_id,requestedListingId:row.requested_listing_id,
 offeredListingId:row.offered_listing_id,requestedTitle:row.requested_title,offeredTitle:row.offered_title,
 ...(row.requested_listing?{requestedListing:{...publicListing(row.requested_listing),moderationStatus:row.requested_listing.moderation_status}}:{}),
 ...(row.offered_listing?{offeredListing:{...publicListing(row.offered_listing),moderationStatus:row.offered_listing.moderation_status}}:{}),
 note:row.note,status:row.status,requesterConfirmed:row.requester_confirmed,recipientConfirmed:row.recipient_confirmed,
 createdAt:row.created_at,updatedAt:row.updated_at
});
const messageView=row=>({id:row.id,conversationId:row.conversation_id,senderId:row.sender_id,body:row.body,createdAt:row.created_at});
const conversationView=row=>({id:row.id,listingId:row.listing_id,listingTitle:row.listing_title,otherUserId:row.other_user_id,otherUserName:row.other_user_name,lastMessage:row.last_message||'',lastMessageAt:row.last_message_at||row.updated_at,updatedAt:row.updated_at});
const reportView=row=>({id:row.id,reporterId:row.reporter_id,targetType:row.target_type,targetId:row.target_id,reason:row.reason,details:row.details,status:row.status,createdAt:row.created_at});
const reviewView=row=>({id:row.id,offerId:row.offer_id,reviewerId:row.reviewer_id,revieweeId:row.reviewee_id,reviewerName:row.reviewer_name,...(row.reviewee_name?{revieweeName:row.reviewee_name}:{}),stars:row.stars,body:row.body,createdAt:row.created_at});
const fail=(status,code,message)=>{throw new ApiError(status,code,message)};

export function createPostgresRepository(pool){
 async function transaction(work){
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result}
  catch(error){try{await client.query('ROLLBACK')}catch{}throw error}
  finally{client.release()}
 }
 async function lockListings(client,ids){
  const {rows}=await client.query('SELECT id,owner_id,status,moderation_status FROM listings WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
  return new Map(rows.map(row=>[row.id,row]));
 }
 async function hasBlock(client,a,b){
  const {rows}=await client.query('SELECT 1 FROM user_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1',[a,b]);
  return rows.length>0;
 }
 async function conversationById(client,userId,conversationId){
  const {rows}=await client.query(`SELECT c.*,l.title AS listing_title,
   CASE WHEN c.owner_id=$2 THEN c.guest_id ELSE c.owner_id END AS other_user_id,
   p.display_name AS other_user_name,last.body AS last_message,last.created_at AS last_message_at,
   (c.owner_id=$2 OR c.guest_id=$2) AS is_member,
   EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=c.owner_id AND b.blocked_id=c.guest_id) OR (b.blocker_id=c.guest_id AND b.blocked_id=c.owner_id)) AS is_blocked
   FROM conversations c JOIN listings l ON l.id=c.listing_id
   JOIN profiles p ON p.id=CASE WHEN c.owner_id=$2 THEN c.guest_id ELSE c.owner_id END
   LEFT JOIN LATERAL (SELECT body,created_at FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last ON true
   WHERE c.id=$1`,[conversationId,userId]);
  const conversation=rows[0];
  if(!conversation||!conversation.is_member)fail(404,'conversation_not_found','This conversation was not found.');
  if(conversation.is_blocked)fail(403,'blocked','This conversation is unavailable.');
  return conversationView(conversation);
 }
 return Object.freeze({
  async health(){await pool.query('SELECT 1')},
  async ensureProfile(principal){
   const {rows}=await pool.query(`INSERT INTO profiles(auth_subject,display_name) VALUES($1,$2)
    ON CONFLICT(auth_subject) DO UPDATE SET display_name=CASE WHEN profiles.display_name='新用户' AND EXCLUDED.display_name<>'' THEN EXCLUDED.display_name ELSE profiles.display_name END
    RETURNING id,display_name,country_code,city,locale,account_role,account_status`,[principal.subject,principal.displayName||'新用户']);
   const row=rows[0];
   return {id:row.id,displayName:row.display_name,countryCode:row.country_code,city:row.city,locale:row.locale,accountRole:row.account_role,accountStatus:row.account_status};
  },
  async updateProfile(userId,input){
   const cityProvided=Object.hasOwn(input,'city');
   const {rows}=await pool.query(`UPDATE profiles SET display_name=COALESCE($2,display_name),country_code=COALESCE($3,country_code),
    city=CASE WHEN $4::boolean THEN NULLIF($5,'') ELSE city END,locale=COALESCE($6,locale),updated_at=now()
    WHERE id=$1 AND account_status='active' RETURNING id,display_name,country_code,city,locale,account_role,account_status`,
   [userId,input.displayName??null,input.countryCode??null,cityProvided,input.city??'',input.locale??null]);
   if(!rows[0])fail(404,'profile_not_found','This profile is unavailable.');
   const row=rows[0];return {id:row.id,displayName:row.display_name,countryCode:row.country_code,city:row.city,locale:row.locale,accountRole:row.account_role,accountStatus:row.account_status};
  },
  async listListings({countryCode,city,category,limit=20,offset=0}={}){
   const where=["l.status='available'","l.moderation_status='approved'","p.account_status='active'"];
   const params=[];
   for(const [column,value] of [['l.country_code',countryCode],['l.city',city],['l.category',category]])if(value){params.push(value);where.push(`${column}=$${params.length}`)}
   params.push(Math.min(Math.max(Number(limit)||20,1),50));
   const limitArg=params.length;
   params.push(Math.max(Number(offset)||0,0));
   const {rows}=await pool.query(`SELECT l.*,p.display_name AS owner_name FROM listings l JOIN profiles p ON p.id=l.owner_id WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT $${limitArg} OFFSET $${params.length}`,params);
   return rows.map(publicListing);
  },
  async listMyListings(userId){
   const {rows}=await pool.query('SELECT l.*,p.display_name AS owner_name FROM listings l JOIN profiles p ON p.id=l.owner_id WHERE l.owner_id=$1 ORDER BY l.created_at DESC LIMIT 100',[userId]);
   return rows.map(row=>({...publicListing(row),moderationStatus:row.moderation_status}));
  },
  async updateListing(ownerId,listingId,input){
   return transaction(async client=>{
    const {rows}=await client.query(`SELECT l.*,p.display_name AS owner_name FROM listings l JOIN profiles p ON p.id=l.owner_id WHERE l.id=$1 AND l.owner_id=$2 FOR UPDATE OF l`,[listingId,ownerId]);
    const listing=rows[0];if(!listing)fail(404,'listing_not_found','This listing was not found.');
    if(['reserved','exchanged','pending_review'].includes(listing.status))fail(409,'listing_not_editable','This listing cannot be edited in its current state.');
    const {rows:updated}=await client.query(`UPDATE listings SET title=$3,description=$4,flaws=$5,category=$6,condition=$7,
     desired_items=COALESCE(NULLIF($8,''),'Any reasonable offer'),image_key=COALESCE($9,image_key),country_code=$10,city=$11,area=$12,
     status='pending_review',moderation_status='pending',updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *`,
    [listingId,ownerId,input.title.trim(),input.description.trim(),input.flaws.trim(),input.category,input.condition,input.desiredItems,input.imageKey??null,input.countryCode,input.city.trim(),input.area?.trim()||null]);
    await client.query("UPDATE swap_offers SET status='cancelled',updated_at=now() WHERE status='pending' AND (requested_listing_id=$1 OR offered_listing_id=$1)",[listingId]);
    return {...publicListing({...updated[0],owner_name:listing.owner_name}),moderationStatus:updated[0].moderation_status};
   });
  },
  async hideListing(ownerId,listingId){
   await transaction(async client=>{
    const {rows}=await client.query('SELECT status FROM listings WHERE id=$1 AND owner_id=$2 FOR UPDATE',[listingId,ownerId]);
    if(!rows[0])fail(404,'listing_not_found','This listing was not found.');
    if(['reserved','exchanged'].includes(rows[0].status))fail(409,'listing_not_hideable','This listing cannot be hidden in its current state.');
    await client.query("UPDATE listings SET status='hidden',updated_at=now() WHERE id=$1 AND owner_id=$2",[listingId,ownerId]);
    await client.query("UPDATE swap_offers SET status='cancelled',updated_at=now() WHERE status='pending' AND (requested_listing_id=$1 OR offered_listing_id=$1)",[listingId]);
   });
  },
  async restoreListing(ownerId,listingId){
   const {rows}=await pool.query(`UPDATE listings SET status='available',updated_at=now()
    WHERE id=$1 AND owner_id=$2 AND status='hidden' AND moderation_status='approved'
    RETURNING id,owner_id,title,description,flaws,category,condition,desired_items,image_key,country_code,city,area,status,created_at`,[listingId,ownerId]);
   if(!rows[0]){
    const {rows:exists}=await pool.query('SELECT 1 FROM listings WHERE id=$1 AND owner_id=$2',[listingId,ownerId]);
    if(!exists.length)fail(404,'listing_not_found','This listing was not found.');
    fail(409,'listing_not_restorable','Only an approved, hidden listing can be restored.');
   }
   const {rows:owner}=await pool.query('SELECT display_name FROM profiles WHERE id=$1',[ownerId]);
   return {...publicListing({...rows[0],owner_name:owner[0]?.display_name||'You'}),moderationStatus:'approved'};
  },
  async listFavorites(userId){
   const {rows}=await pool.query(`SELECT l.*,p.display_name AS owner_name FROM favorites f JOIN listings l ON l.id=f.listing_id
    JOIN profiles p ON p.id=l.owner_id WHERE f.user_id=$1 ORDER BY f.created_at DESC LIMIT 100`,[userId]);
   return rows.map(row=>({...publicListing(row),moderationStatus:row.moderation_status}));
  },
  async listBlocks(userId){
   const {rows}=await pool.query('SELECT blocked_id AS user_id FROM user_blocks WHERE blocker_id=$1 ORDER BY created_at DESC LIMIT 500',[userId]);
   return rows.map(row=>({userId:row.user_id}));
  },
  async listMyReports(userId){
   const {rows}=await pool.query('SELECT * FROM reports WHERE reporter_id=$1 ORDER BY created_at DESC LIMIT 100',[userId]);
   return rows.map(reportView);
  },
  async createListing(ownerId,input){
   const {rows}=await pool.query(`INSERT INTO listings(owner_id,title,description,flaws,category,condition,desired_items,image_key,country_code,city,area)
    SELECT p.id,$2,$3,$4,$5,$6,COALESCE(NULLIF($7,''),'Any reasonable offer'),$8,$9,$10,$11
    FROM profiles p WHERE p.id=$1 AND p.account_status='active'
    RETURNING id,owner_id,title,description,flaws,category,condition,desired_items,image_key,country_code,city,area,status,created_at`,
    [ownerId,input.title.trim(),input.description.trim(),input.flaws.trim(),input.category,input.condition,input.desiredItems||'',input.imageKey,input.countryCode,input.city.trim(),input.area?.trim()||null]);
   if(!rows[0])fail(403,'account_unavailable','This account cannot publish listings.');
   return {...publicListing({...rows[0],owner_name:'You'}),moderationStatus:'pending'};
  },
  async setFavorite(userId,listingId,enabled){
   if(enabled){
    const {rows}=await pool.query(`WITH eligible AS (
     SELECT l.id FROM listings l JOIN profiles p ON p.id=l.owner_id
     WHERE l.id=$2 AND l.status='available' AND l.moderation_status='approved' AND p.account_status='active' AND l.owner_id<>$1
    ), inserted AS (
     INSERT INTO favorites(user_id,listing_id) SELECT $1,id FROM eligible
     ON CONFLICT(user_id,listing_id) DO NOTHING RETURNING listing_id
    ) SELECT eligible.id FROM eligible LEFT JOIN inserted ON inserted.listing_id=eligible.id`,[userId,listingId]);
    if(!rows.length)fail(404,'listing_not_found','This listing is not available.');
    return;
   }
   await pool.query('DELETE FROM favorites WHERE user_id=$1 AND listing_id=$2',[userId,listingId]);
  },
  async listOffers(userId){
   const {rows}=await pool.query(`SELECT o.*,rl.title AS requested_title,ol.title AS offered_title,
    to_jsonb(rl)||jsonb_build_object('owner_name',rp.display_name) AS requested_listing,
    to_jsonb(ol)||jsonb_build_object('owner_name',op.display_name) AS offered_listing
    FROM swap_offers o JOIN listings rl ON rl.id=o.requested_listing_id JOIN listings ol ON ol.id=o.offered_listing_id
    JOIN profiles rp ON rp.id=rl.owner_id JOIN profiles op ON op.id=ol.owner_id
    WHERE o.requester_id=$1 OR o.recipient_id=$1 ORDER BY o.created_at DESC LIMIT 100`,[userId]);
   return rows.map(offerView);
  },
  async createOffer(requesterId,{requestedListingId,offeredListingId,note=''}){
   if(requestedListingId===offeredListingId)fail(400,'invalid_offer','Choose two different listings.');
   try{return await transaction(async client=>{
    const listings=await lockListings(client,[requestedListingId,offeredListingId]);
    const requested=listings.get(requestedListingId),offered=listings.get(offeredListingId);
    if(!requested||!offered)fail(404,'listing_not_found','One of the listings is unavailable.');
    if(offered.owner_id!==requesterId||requested.owner_id===requesterId)fail(403,'invalid_offer','You can only offer your own item for someone else’s listing.');
    if([requested,offered].some(item=>item.status!=='available'||item.moderation_status!=='approved'))fail(409,'listing_unavailable','One of the listings is no longer available.');
    if(await hasBlock(client,requesterId,requested.owner_id))fail(403,'blocked','This exchange is unavailable.');
    const {rows}=await client.query(`INSERT INTO swap_offers(requester_id,recipient_id,requested_listing_id,offered_listing_id,note)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,[requesterId,requested.owner_id,requestedListingId,offeredListingId,note.trim()]);
    return offerView({...rows[0],requested_title:null,offered_title:null});
   })}catch(error){if(error.code==='23505')fail(409,'duplicate_offer','A matching pending offer already exists.');throw error}
  },
  async respondToOffer(userId,offerId,action){
   const result=await transaction(async client=>{
    const {rows}=await client.query('SELECT * FROM swap_offers WHERE id=$1 FOR UPDATE',[offerId]);
    const offer=rows[0];if(!offer)fail(404,'offer_not_found','This offer was not found.');
    if(action==='accept'||action==='reject'){
     if(offer.recipient_id!==userId)fail(403,'not_offer_recipient','Only the listing owner can respond to this offer.');
     if(offer.status!=='pending')fail(409,'offer_not_pending','This offer is no longer pending.');
     if(action==='reject'){
      const {rows:updated}=await client.query("UPDATE swap_offers SET status='rejected',updated_at=now() WHERE id=$1 RETURNING *",[offerId]);
      return offerView({...updated[0],requested_title:null,offered_title:null});
     }
     const listings=await lockListings(client,[offer.requested_listing_id,offer.offered_listing_id]);
     const requested=listings.get(offer.requested_listing_id),offered=listings.get(offer.offered_listing_id);
     if(!requested||!offered||requested.owner_id!==userId||offered.owner_id!==offer.requester_id||[requested,offered].some(item=>item.status!=='available'||item.moderation_status!=='approved'))fail(409,'listing_unavailable','One of the listings is no longer available.');
     if(await hasBlock(client,offer.requester_id,offer.recipient_id))fail(403,'blocked','This exchange is unavailable.');
     await client.query("UPDATE listings SET status='reserved',reserved_offer_id=$1,updated_at=now() WHERE id=ANY($2::uuid[])",[offerId,[offer.requested_listing_id,offer.offered_listing_id]]);
     const {rows:updated}=await client.query("UPDATE swap_offers SET status='accepted',updated_at=now() WHERE id=$1 RETURNING *",[offerId]);
     return offerView({...updated[0],requested_title:null,offered_title:null});
    }
    if(action==='cancel'){
     if(![offer.requester_id,offer.recipient_id].includes(userId))fail(403,'not_offer_participant','You are not part of this offer.');
     if(offer.status==='pending'&&offer.requester_id!==userId)fail(403,'not_offer_requester','The recipient cannot cancel a pending offer.');
     if(!['pending','accepted'].includes(offer.status))fail(409,'offer_not_cancellable','This offer cannot be cancelled now.');
     const {rows:updated}=await client.query("UPDATE swap_offers SET status='cancelled',updated_at=now() WHERE id=$1 RETURNING *",[offerId]);
     await client.query("UPDATE listings SET status='available',reserved_offer_id=NULL,updated_at=now() WHERE reserved_offer_id=$1",[offerId]);
     return offerView({...updated[0],requested_title:null,offered_title:null});
    }
    fail(400,'invalid_action','Unsupported offer action.');
   });
   if(action==='accept'&&result.status==='accepted'){
    // Cleanup runs after the reservation transaction commits to avoid lock-order deadlocks with other accepts.
    try{await pool.query(`UPDATE swap_offers SET status='cancelled',updated_at=now()
     WHERE id<>$1 AND status='pending' AND (requested_listing_id=ANY($2::uuid[]) OR offered_listing_id=ANY($2::uuid[]))`,[offerId,[result.requestedListingId,result.offeredListingId]])}catch{}
   }
   return result;
  },
  async confirmHandoff(userId,offerId){
   return transaction(async client=>{
    const {rows}=await client.query('SELECT * FROM swap_offers WHERE id=$1 FOR UPDATE',[offerId]);
    const offer=rows[0];if(!offer)fail(404,'offer_not_found','This offer was not found.');
    if(![offer.requester_id,offer.recipient_id].includes(userId))fail(403,'not_offer_participant','You are not part of this offer.');
    if(!['accepted','partial'].includes(offer.status))fail(409,'offer_not_confirmable','This offer is not awaiting handoff confirmation.');
    const requesterConfirmed=offer.requester_confirmed||offer.requester_id===userId;
    const recipientConfirmed=offer.recipient_confirmed||offer.recipient_id===userId;
    const status=requesterConfirmed&&recipientConfirmed?'completed':'partial';
    const {rows:updated}=await client.query(`UPDATE swap_offers SET requester_confirmed=$2,recipient_confirmed=$3,status=$4,updated_at=now() WHERE id=$1 RETURNING *`,[offerId,requesterConfirmed,recipientConfirmed,status]);
    if(status==='completed')await client.query("UPDATE listings SET status='exchanged',reserved_offer_id=NULL,updated_at=now() WHERE reserved_offer_id=$1",[offerId]);
    return offerView({...updated[0],requested_title:null,offered_title:null});
   });
  },
  async createReport(reporterId,{targetType,targetId,reason,details=''}){
   const table=targetType==='listing'?'listings':targetType==='user'?'profiles':'messages';
   const {rows}=await pool.query(`INSERT INTO reports(reporter_id,target_type,target_id,reason,details)
    SELECT $1,$2,$3,$4,$5 WHERE EXISTS (SELECT 1 FROM ${table} WHERE id=$3) RETURNING *`,[reporterId,targetType,targetId,reason.trim(),details.trim()]);
   if(!rows[0])fail(404,'report_target_not_found','The reported content was not found.');
   return reportView(rows[0]);
  },
  async blockUser(blockerId,blockedId){
   if(blockerId===blockedId)fail(400,'invalid_block','You cannot block your own account.');
   const {rows}=await pool.query(`WITH target AS (
    SELECT id FROM profiles WHERE id=$2 AND account_status='active'
   ), added AS (
    INSERT INTO user_blocks(blocker_id,blocked_id) SELECT $1,id FROM target ON CONFLICT DO NOTHING RETURNING blocked_id
   ) SELECT target.id FROM target LEFT JOIN added ON added.blocked_id=target.id`,[blockerId,blockedId]);
   if(!rows.length)fail(404,'user_not_found','This account was not found.');
  },
  async openConversation(userId,listingId){
   return transaction(async client=>{
    const {rows:existing}=await client.query('SELECT id FROM conversations WHERE listing_id=$1 AND (owner_id=$2 OR guest_id=$2) LIMIT 1',[listingId,userId]);
    if(existing[0])return conversationById(client,userId,existing[0].id);
    const {rows}=await client.query(`SELECT l.id,l.owner_id,l.status,l.moderation_status,p.account_status,
     EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=l.owner_id) OR (b.blocker_id=l.owner_id AND b.blocked_id=$2)) AS is_blocked
     FROM listings l JOIN profiles p ON p.id=l.owner_id WHERE l.id=$1 FOR UPDATE OF l`,[listingId,userId]);
    const listing=rows[0];if(!listing||listing.account_status!=='active')fail(404,'listing_not_found','This listing was not found.');
    if(listing.owner_id===userId)fail(400,'invalid_conversation','You cannot start a conversation with yourself.');
    if(listing.status!=='available'||listing.moderation_status!=='approved')fail(409,'listing_unavailable','This listing is no longer available.');
    if(listing.is_blocked)fail(403,'blocked','This conversation is unavailable.');
    const {rows:created}=await client.query('INSERT INTO conversations(listing_id,owner_id,guest_id) VALUES($1,$2,$3) ON CONFLICT(listing_id,guest_id) DO NOTHING RETURNING id',[listingId,listing.owner_id,userId]);
    const conversationId=created[0]?.id||(await client.query('SELECT id FROM conversations WHERE listing_id=$1 AND guest_id=$2',[listingId,userId])).rows[0]?.id;
    return conversationById(client,userId,conversationId);
   });
  },
  async listConversations(userId){
   const {rows}=await pool.query(`SELECT c.*,l.title AS listing_title,
    CASE WHEN c.owner_id=$1 THEN c.guest_id ELSE c.owner_id END AS other_user_id,
    p.display_name AS other_user_name,last.body AS last_message,last.created_at AS last_message_at
    FROM conversations c JOIN listings l ON l.id=c.listing_id
    JOIN profiles p ON p.id=CASE WHEN c.owner_id=$1 THEN c.guest_id ELSE c.owner_id END
    LEFT JOIN LATERAL (SELECT body,created_at FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last ON true
    WHERE (c.owner_id=$1 OR c.guest_id=$1)
    AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=c.owner_id AND b.blocked_id=c.guest_id) OR (b.blocker_id=c.guest_id AND b.blocked_id=c.owner_id))
    ORDER BY c.updated_at DESC LIMIT 100`,[userId]);
   return rows.map(conversationView);
  },
  async listMessages(userId,conversationId,{limit=100}={}){
   const safeLimit=Math.min(Math.max(Number(limit)||100,1),100);
   const {rows}=await pool.query(`SELECT m.*,
    EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=c.owner_id AND b.blocked_id=c.guest_id) OR (b.blocker_id=c.guest_id AND b.blocked_id=c.owner_id)) AS is_blocked
    FROM conversations c
    LEFT JOIN LATERAL (SELECT * FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT $3) m ON true
    WHERE c.id=$1 AND (c.owner_id=$2 OR c.guest_id=$2) ORDER BY m.created_at ASC`,[conversationId,userId,safeLimit]);
   if(!rows.length)fail(404,'conversation_not_found','This conversation was not found.');
   if(rows[0].is_blocked)fail(403,'blocked','This conversation is unavailable.');
   return rows.filter(row=>row.id).map(messageView);
  },
  async sendMessage(userId,conversationId,body){
   const text=body.trim();if(!text||text.length>2000||Array.from(text).some(char=>{const code=char.codePointAt(0);return code<32||code===127}))fail(400,'invalid_message','Message text is invalid.');
   return transaction(async client=>{
    const {rows}=await client.query(`SELECT c.*,
     EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=c.owner_id AND b.blocked_id=c.guest_id) OR (b.blocker_id=c.guest_id AND b.blocked_id=c.owner_id)) AS is_blocked
     FROM conversations c WHERE c.id=$1 FOR UPDATE`,[conversationId]);
    const conversation=rows[0];if(!conversation||![conversation.owner_id,conversation.guest_id].includes(userId))fail(404,'conversation_not_found','This conversation was not found.');
    if(conversation.is_blocked)fail(403,'blocked','This conversation is unavailable.');
    const {rows:inserted}=await client.query('INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING *',[conversationId,userId,text]);
    await client.query('UPDATE conversations SET updated_at=now() WHERE id=$1',[conversationId]);
    return messageView(inserted[0]);
   });
  },
  async createReview(reviewerId,offerId,{stars,body=''}){
   try{return await transaction(async client=>{
    const {rows}=await client.query(`SELECT o.*,p.display_name AS reviewer_name FROM swap_offers o
     JOIN profiles p ON p.id=$2 WHERE o.id=$1 FOR UPDATE OF o`,[offerId,reviewerId]);
    const offer=rows[0];if(!offer)fail(404,'offer_not_found','This offer was not found.');
    if(offer.status!=='completed')fail(409,'review_not_available','Reviews are available after both users confirm the exchange.');
    if(![offer.requester_id,offer.recipient_id].includes(reviewerId))fail(403,'not_offer_participant','You are not part of this exchange.');
    const revieweeId=offer.requester_id===reviewerId?offer.recipient_id:offer.requester_id;
    const {rows:created}=await client.query('INSERT INTO reviews(offer_id,reviewer_id,reviewee_id,stars,body) VALUES($1,$2,$3,$4,$5) RETURNING *',[offerId,reviewerId,revieweeId,stars,body.trim()]);
    return reviewView({...created[0],reviewer_name:offer.reviewer_name});
   })}catch(error){if(error.code==='23505')fail(409,'review_exists','You have already reviewed this exchange.');throw error}
  },
  async listReviews(userId){
   const [{rows},{rows:summary}]=await Promise.all([
    pool.query(`SELECT r.*,p.display_name AS reviewer_name FROM reviews r JOIN profiles p ON p.id=r.reviewer_id WHERE r.reviewee_id=$1 ORDER BY r.created_at DESC LIMIT 100`,[userId]),
    pool.query('SELECT COUNT(*)::int AS count,AVG(stars)::float AS average FROM reviews WHERE reviewee_id=$1',[userId])
   ]);
   return {items:rows.map(reviewView),reviewCount:summary[0].count,averageStars:summary[0].average===null?null:Number(summary[0].average.toFixed(2))};
  },
  async listMyReviews(userId){
   const {rows}=await pool.query(`SELECT r.*,p.display_name AS reviewee_name FROM reviews r JOIN profiles p ON p.id=r.reviewee_id WHERE r.reviewer_id=$1 ORDER BY r.created_at DESC LIMIT 100`,[userId]);
   return {items:rows.map(reviewView)};
  },
  async listPendingListings(){
   const {rows}=await pool.query(`SELECT l.*,p.display_name AS owner_name FROM listings l JOIN profiles p ON p.id=l.owner_id
    WHERE l.status='pending_review' AND l.moderation_status='pending' ORDER BY l.created_at ASC LIMIT 100`);
   return rows.map(row=>({...publicListing(row),moderationStatus:row.moderation_status}));
  },
  async moderateListing(actorId,listingId,{decision,reason=''}){
   return transaction(async client=>{
    const {rows}=await client.query('SELECT l.*,p.display_name AS owner_name FROM listings l JOIN profiles p ON p.id=l.owner_id WHERE l.id=$1 FOR UPDATE OF l',[listingId]);
    const listing=rows[0];if(!listing)fail(404,'listing_not_found','This listing was not found.');
    if(listing.status!=='pending_review'||listing.moderation_status!=='pending')fail(409,'listing_already_reviewed','This listing has already been reviewed.');
    const approved=decision==='approve';
    const {rows:updated}=await client.query(`UPDATE listings SET status=$2,moderation_status=$3,updated_at=now() WHERE id=$1 RETURNING *`,[listingId,approved?'available':'rejected',approved?'approved':'rejected']);
    await client.query('INSERT INTO moderation_actions(actor_id,target_type,target_id,action,reason) VALUES($1,$2,$3,$4,$5)',[actorId,'listing',listingId,decision,reason.trim()]);
    return {...publicListing({...updated[0],owner_name:listing.owner_name}),moderationStatus:updated[0].moderation_status};
   });
  },
  async listReports({status='open'}={}){
   const {rows}=await pool.query(`SELECT * FROM reports WHERE status=$1 ORDER BY created_at ASC LIMIT 100`,[status]);
   return rows.map(reportView);
  },
  async resolveReport(actorId,reportId,{decision,reason=''}){
   return transaction(async client=>{
    const {rows}=await client.query('SELECT * FROM reports WHERE id=$1 FOR UPDATE',[reportId]);
    const report=rows[0];if(!report)fail(404,'report_not_found','This report was not found.');
    if(!['open','reviewing'].includes(report.status))fail(409,'report_already_resolved','This report has already been closed.');
    const status=decision==='resolve'?'resolved':'dismissed';
    const {rows:updated}=await client.query('UPDATE reports SET status=$2,resolved_at=now() WHERE id=$1 RETURNING *',[reportId,status]);
    await client.query('INSERT INTO moderation_actions(actor_id,target_type,target_id,action,reason) VALUES($1,$2,$3,$4,$5)',[actorId,'report',reportId,decision,reason.trim()]);
    return reportView(updated[0]);
   });
  }
 });
}
