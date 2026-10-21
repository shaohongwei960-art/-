import {assetUrl} from './assets.mjs';

const categoryToApi=Object.freeze({'数码电子':'electronics','图书文娱':'books_media','家居生活':'home','运动户外':'outdoors','服饰配件':'clothing','其他好物':'other'});
const categoryFromApi=Object.freeze({electronics:'数码电子',books_media:'图书文娱',home:'家居生活',outdoors:'运动户外',clothing:'服饰配件',other:'其他好物'});
const conditionToApi=Object.freeze({'近新':'like_new','使用良好':'good','有明显使用痕迹':'visible_wear'});
const conditionFromApi=Object.freeze({like_new:'近新',good:'使用良好',visible_wear:'有明显使用痕迹'});
const imageForCategory=Object.freeze({electronics:assetUrl('images/camera.jpg'),books_media:assetUrl('images/books.jpg'),home:assetUrl('images/coffee.jpg'),outdoors:assetUrl('images/tent.jpg'),clothing:assetUrl('images/books.jpg'),other:assetUrl('images/plant.jpg')});
const statusFromApi=Object.freeze({available:'available',hidden:'hidden',reserved:'locked',exchanged:'exchanged',pending_review:'pending_review',rejected:'rejected'});

export function toApiListingPayload(item,{countryCode='CN',placeholderImage=true}={}){
 const category=categoryToApi[item.category]||item.category;
 const payload={title:item.title,description:item.description,flaws:item.flaws,category,condition:conditionToApi[item.condition]||item.condition,
  desiredItems:item.wish||'Any reasonable offer',countryCode:item.countryCode||countryCode,city:item.city||'',area:item.area||''};
 if(item.imageKey)payload.imageKey=item.imageKey;
 else if(placeholderImage)payload.imageKey=`prototype/placeholder/${category}.jpg`;
 return payload;
}

export function fromApiListing(listing,meId){
 return {id:listing.id,title:listing.title,image:listing.imageUrl||imageForCategory[listing.category]||imageForCategory.other,imageKey:listing.imageKey,
  category:categoryFromApi[listing.category]||listing.category,wish:listing.desiredItems||'Any reasonable offer',owner:listing.ownerId===meId?'me':listing.ownerId,
  name:listing.ownerName||'换换用户',condition:conditionFromApi[listing.condition]||listing.condition,distance:null,city:listing.city||'',area:listing.area||'',
  countryCode:listing.countryCode||'CN',description:listing.description||'',flaws:listing.flaws||'',status:statusFromApi[listing.status]||listing.status,
  moderationStatus:listing.moderationStatus||null,created:Number.isFinite(Date.parse(listing.createdAt))?Date.parse(listing.createdAt):0};
}

function fromApiOffer(offer,meId){
 const direction=offer.requesterId===meId?'outgoing':'incoming';
 return {id:offer.id,from:offer.offeredListingId,to:offer.requestedListingId,
  direction,status:offer.status,note:offer.note||'',mineConfirmed:direction==='outgoing'?offer.requesterConfirmed:offer.recipientConfirmed,
  theirsConfirmed:direction==='outgoing'?offer.recipientConfirmed:offer.requesterConfirmed,created:Number.isFinite(Date.parse(offer.createdAt))?Date.parse(offer.createdAt):0};
}

const localTime=(value,locale)=>{
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'':date.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'});
};

export async function loadRemoteAppState(client,{locale='zh-CN'}={}){
 const profile=await client.getProfile();
 const [feed,myListings,favorites,offers,conversations,reviews,blocks,reports]=await Promise.all([
  client.listListings({countryCode:profile.countryCode||'CN',limit:50}),client.listMyListings(),client.listFavorites(),client.listOffers(),client.listConversations(),client.listMyReviews(),client.listBlocks(),client.listMyReports()
 ]);
 const conversationRows=(conversations?.items||[]).slice(0,30);
 const threads=await Promise.all(conversationRows.map(async conversation=>({conversation,messages:await client.listMessages(conversation.id,{limit:100})})));
 const itemById=new Map();
 for(const item of [...(feed?.items||[]),...(myListings?.items||[]),...(favorites?.items||[])])itemById.set(item.id,item);
 for(const offer of offers?.items||[]){if(offer.requestedListing)itemById.set(offer.requestedListing.id,offer.requestedListing);if(offer.offeredListing)itemById.set(offer.offeredListing.id,offer.offeredListing)}
 const items=[...itemById.values()].map(item=>fromApiListing(item,profile.id));
 const mappedMessages=threads.flatMap(({conversation,messages:thread})=>(thread?.items||[]).map(message=>({
  id:message.id,peer:conversation.otherUserId,name:conversation.otherUserName,itemId:conversation.listingId,mine:message.senderId===profile.id,
  text:message.body,time:localTime(message.createdAt,locale),createdAt:message.createdAt
 })));
 return {profile,conversations:conversationRows,state:{items,profile,conversations:conversationRows,favorites:(favorites?.items||[]).map(item=>item.id),offers:(offers?.items||[]).map(offer=>fromApiOffer(offer,profile.id)),messages:mappedMessages,
  blocked:(blocks?.items||[]).map(item=>item.userId),reports:reports?.items||[],reviews:(reviews?.items||[]).map(review=>({offerId:review.offerId,stars:review.stars,text:review.body,reviewerName:review.reviewerName,createdAt:review.createdAt}))},
  conversationIds:Object.fromEntries(conversationRows.map(conversation=>[conversation.otherUserId,conversation.id]))};
}

export function mapApiError(error){
 if(error?.status===401)return '登录状态已失效，请重新登录后再试。';
 if(error?.status===403)return error.code==='account_unavailable'?'账号暂不可用，请联系平台支持。':'当前账号无权执行此操作。';
 if(error?.status===404)return '内容可能已删除或不可见，请刷新后重试。';
 if(error?.status===409)return '数据状态已变化，请刷新后重试。';
 if(error?.status===429)return '操作太频繁，请稍后重试。';
 return error?.message||'服务暂时不可用，请稍后重试。';
}
