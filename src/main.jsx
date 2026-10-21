import React, {useState, useEffect, useRef, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {assetUrl} from './assets.mjs';
import {ArrowUpRight, ArrowRight, ArrowLeft, ArrowLeftRight, Search, MapPin, ChevronDown, ChevronRight, Heart, Plus, X, Check, CheckCheck, Camera, Headphones, BookOpen, Armchair, Tent, Shirt, Shapes, LayoutGrid, MessageCircle, Package, Leaf, ShieldCheck, Sparkles, SlidersHorizontal, Bell, Send, Upload, ImagePlus, MoreHorizontal, Flag, Ban, Clock, CircleCheck, Info, Star, LogOut, Settings, Home, User, RefreshCw, Eye, EyeOff} from 'lucide-react';
import '@fontsource-variable/noto-sans-sc';
import {categories, initialState, itemStatus, updateState} from './store.mjs';
import './style.css';
import './swap-matching.css';
import InstallApp from './InstallApp.jsx';
import AuthEntry from './AuthEntry.jsx';
import {LocaleProvider,LanguagePicker,useLocale} from './LocaleContext.jsx';
import {createLocalDemoRepository} from './localDemoRepository.mjs';
import {getSwapMatch} from './swapMatching.mjs';
import {apiConfigured,apiBaseUrl,createApiClient} from './apiClient.mjs';
import {loadRemoteAppState,toApiListingPayload,fromApiListing,mapApiError} from './apiRepository.mjs';
// Local exchange demo data is isolated per authenticated account; never migrate the shared guest store.
const localDemoRepository=createLocalDemoRepository();
const categoryIcons=[LayoutGrid,Headphones,BookOpen,Armchair,Tent,Shirt,Shapes];
const statusNames={available:'可交换',locked:'交换中',exchanged:'已交换',hidden:'已下架',pending_review:'审核中',rejected:'未通过'};
const offerNames={pending:'待回复',accepted:'待交接',partial:'等待双方确认',completed:'已完成',cancelled:'已取消',rejected:'已拒绝',disputed:'待核实'};
const avatarColors=['#ece3d5','#e0e7d4','#e6dcd4','#e0e5e9','#eeded8','#e4dfeb'];
function Avatar({name='你',large=false}){return <span className={`avatar ${large?'large':''}`} style={{background:avatarColors[name.codePointAt(0)%6]}}>{name.slice(0,1)}</span>}
const emptyAppState=()=>({items:[],profile:{displayName:'',countryCode:'CN',city:'',locale:'zh-CN'},conversations:[],favorites:[],offers:[],messages:[],blocked:[],reports:[],reviews:[]});
function App({user,accessToken}){
 const {t,locale,setLocale}=useLocale();
 const [forceLocalMode,setForceLocalMode]=useState(false);
 const apiMode=Boolean(accessToken&&apiConfigured&&!forceLocalMode);
 const apiClient=useMemo(()=>apiMode?createApiClient({baseUrl:apiBaseUrl,accessToken}):null,[apiMode,accessToken]);
 const [state,setState]=useState(()=>apiMode?emptyAppState():localDemoRepository.load(user.id));
 const [apiProfile,setApiProfile]=useState(null),[apiLoading,setApiLoading]=useState(apiMode),[apiError,setApiError]=useState(''),[apiRevision,setApiRevision]=useState(0),[conversationIds,setConversationIds]=useState({});
 const [page,setPage]=useState(()=>['exchanges','messages','profile'].includes(location.hash.slice(1))?location.hash.slice(1):'home');
 const [modal,setModal]=useState(null),[toast,setToast]=useState(''),[city,setCity]=useState('全部城市'),[category,setCategory]=useState('全部好物'),[feed,setFeed]=useState('为你发现'),[query,setQuery]=useState(''),[searchText,setSearchText]=useState(''),[condition,setCondition]=useState('全部成色'),[radius,setRadius]=useState('不限距离'),[sort,setSort]=useState('推荐排序'),[profileTab,setProfileTab]=useState('我的闲置'),[exchangeTab,setExchangeTab]=useState('全部'),[chatPeer,setChatPeer]=useState('u2');
 const stateRef=useRef(state),skipLocalSave=useRef(false),apiModeRef=useRef(apiMode);stateRef.current=state;
 function notify(text){setToast(t(text))}
 function dispatch(action){const before=stateRef.current,next=updateState(before,action);stateRef.current=next;setState(next);return next!==before}
 function refreshApi(){setApiRevision(value=>value+1)}
 function applyState(next){stateRef.current=next;setState(next)}
 function handleApiError(error){notify(mapApiError(error))}
 useEffect(()=>{
  if(!apiMode){
   apiModeRef.current=false;setApiProfile(null);setApiError('');setApiLoading(false);setConversationIds({});
   const local=localDemoRepository.load(user.id);stateRef.current=local;skipLocalSave.current=true;setState(local);
   return;
  }
  const enteringApiMode=!apiModeRef.current;apiModeRef.current=true;
  if(enteringApiMode){const empty=emptyAppState();stateRef.current=empty;setState(empty);setApiProfile(null);setConversationIds({});setChatPeer('')}
  let active=true;setApiLoading(true);setApiError('');
  loadRemoteAppState(apiClient,{locale}).then(result=>{
   if(!active)return;
   stateRef.current=result.state;setState(result.state);setApiProfile(result.profile);setConversationIds(result.conversationIds);
   setChatPeer(result.conversations?.[0]?.otherUserId||'');
  }).catch(error=>{if(active)setApiError(mapApiError(error))}).finally(()=>{if(active)setApiLoading(false)});
  return ()=>{active=false};
 },[apiMode,apiClient,locale,apiRevision,user.id]);
 useEffect(()=>{if(apiMode)return;if(skipLocalSave.current){skipLocalSave.current=false;return}try{localDemoRepository.save(user.id,state)}catch{setToast(t('本机存储空间不足，当前更改可能无法保留。请减少上传图片。'))}},[state,user.id,apiMode]);
 useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),3500);return ()=>clearTimeout(timer)}},[toast]);
 useEffect(()=>{const onHash=()=>setPage(['exchanges','messages','profile'].includes(location.hash.slice(1))?location.hash.slice(1):'home');window.addEventListener('hashchange',onHash);return ()=>window.removeEventListener('hashchange',onHash)},[]);
 function go(next){setPage(next);location.hash=next;window.scrollTo({top:0,behavior:'smooth'})}
 async function openChat(item){
  if(state.blocked.includes(item.owner)){notify('你已拉黑这位用户。可在设置中重置演示数据。');return}
  if(apiMode){
   try{
    const conversation=await apiClient.openConversation(item.id);
    setConversationIds(previous=>({...previous,[conversation.otherUserId]:conversation.id}));
    applyState({...stateRef.current,conversations:[conversation,...(stateRef.current.conversations||[]).filter(value=>value.id!==conversation.id)]});
    setChatPeer(conversation.otherUserId);setModal(null);go('messages');return;
   }catch(error){handleApiError(error);return}
  }
  setChatPeer(item.owner);
  if(!state.messages.some(message=>message.peer===item.owner))dispatch({type:'message',message:{id:crypto.randomUUID(),peer:item.owner,name:item.name,itemId:item.id,mine:false,text:'这是演示会话。你可以在这里发送消息，消息只会保存在当前浏览器。',time:'刚刚',system:true}});
  setModal(null);go('messages');
 }
 function toggleFavorite(id){
  if(!apiMode){dispatch({type:'favorite',id});return}
  const enabled=!stateRef.current.favorites.includes(id);
  apiClient.setFavorite(id,enabled).then(()=>{const favorites=new Set(stateRef.current.favorites);if(enabled)favorites.add(id);else favorites.delete(id);applyState({...stateRef.current,favorites:[...favorites]})}).catch(handleApiError);
 }
 async function sendChat(text){
  if(!apiMode){dispatch({type:'message',message:{id:crypto.randomUUID(),peer:chatPeer,name:stateRef.current.messages.find(message=>message.peer===chatPeer)?.name||'对方',itemId:stateRef.current.messages.find(message=>message.peer===chatPeer)?.itemId,mine:true,text,time:new Date().toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}});return true}
  const conversationId=conversationIds[chatPeer];if(!conversationId){notify('请先打开一件物品的对话。');return false}
  try{
   const sent=await apiClient.sendMessage(conversationId,text),createdAt=sent?.createdAt||new Date().toISOString();
   const conversation=stateRef.current.conversations.find(value=>value.id===conversationId);
   const message={id:sent?.id||crypto.randomUUID(),peer:chatPeer,name:conversation?.otherUserName||'换换用户',itemId:conversation?.listingId,mine:true,text:sent?.body||text,time:new Date(createdAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}),createdAt};
   applyState({...stateRef.current,messages:[...stateRef.current.messages,message],conversations:stateRef.current.conversations.map(value=>value.id===conversationId?{...value,lastMessage:text,lastMessageAt:createdAt}:value)});
   return true;
  }catch(error){handleApiError(error);return false}
 }
 async function saveListing(item,existing){
  if(!apiMode){
   if(existing)dispatch({type:'edit',item});else dispatch({type:'publish',item});
   setModal(null);setProfileTab('我的闲置');go('profile');notify(existing?'物品已更新。':'发布成功！你的好物已保存到本机。');return;
  }
  try{
   const payload=toApiListingPayload(item,{countryCode:apiProfile?.countryCode||'CN'});
   const saved=existing?await apiClient.updateListing(existing.id,payload):await apiClient.createListing(payload);
   const mapped=fromApiListing(saved,apiProfile?.id||stateRef.current.profile?.id);
   const nextOffers=existing?stateRef.current.offers.map(offer=>offer.status==='pending'&&(offer.from===existing.id||offer.to===existing.id)?{...offer,status:'cancelled'}:offer):stateRef.current.offers;
   applyState({...stateRef.current,items:stateRef.current.items.some(value=>value.id===mapped.id)?stateRef.current.items.map(value=>value.id===mapped.id?mapped:value):[mapped,...stateRef.current.items],offers:nextOffers});
   setModal(null);setProfileTab('我的闲置');go('profile');notify(existing?'修改已提交，物品需重新审核。':'物品已提交，审核通过后会出现在公开列表。');
  }catch(error){handleApiError(error)}
 }
 async function changeListingVisibility(item,status){
  if(!apiMode){dispatch({type:'visibility',id:item.id});notify(status==='hidden'?'物品已重新上架':'物品已下架');return}
  try{
   let changed;
   if(status==='hidden')changed=fromApiListing(await apiClient.restoreListing(item.id),apiProfile?.id||stateRef.current.profile?.id);
   else{await apiClient.hideListing(item.id);changed={...item,status:'hidden'}}
   const offers=stateRef.current.offers.map(offer=>offer.status==='pending'&&(offer.from===item.id||offer.to===item.id)?{...offer,status:'cancelled'}:offer);
   applyState({...stateRef.current,items:stateRef.current.items.map(value=>value.id===item.id?changed:value),offers});
   setModal(null);notify(status==='hidden'?'物品已重新上架。':'物品已下架。');
  }catch(error){handleApiError(error)}
 }
 async function saveProfile(profile){
  if(!apiMode){dispatch({type:'profile',profile});setModal(null);notify('个人资料已保存到本机。');if(profile.locale)setLocale(profile.locale);return}
  try{
   const updated=await apiClient.updateProfile(profile);setApiProfile(updated);applyState({...stateRef.current,profile:updated});setModal(null);notify('个人资料已更新。');if(profile.locale)setLocale(profile.locale);
  }catch(error){handleApiError(error)}
 }
 function browse(){go('home');setTimeout(()=>document.getElementById('discover')?.scrollIntoView({behavior:'smooth',block:'start'}),80)}
 const pendingCount=useMemo(()=>state.offers.reduce((count,offer)=>count+(offer.direction==='incoming'&&offer.status==='pending'?1:0),0),[state.offers]);
 const myItems=useMemo(()=>state.items.filter(item=>item.owner==='me'),[state.items]);
 const availableMyItems=useMemo(()=>myItems.filter(item=>itemStatus(state,item.id)==='available'),[state,myItems]);
 const matchByItem=useMemo(()=>new Map(state.items.filter(item=>item.owner!=='me').map(item=>[item.id,getSwapMatch(item,availableMyItems)])),[state.items,availableMyItems]);
 const filtered=useMemo(()=>state.items.filter(i=>i.owner!=='me'&&itemStatus(state,i.id)!=='hidden'&&itemStatus(state,i.id)!=='pending_review'&&itemStatus(state,i.id)!=='rejected'&&!state.blocked.includes(i.owner)&&(city==='全部城市'||i.city===city)&&(category==='全部好物'||i.category===category)&&(!query||`${i.title} ${i.wish} ${i.description}`.toLowerCase().includes(query.toLowerCase()))&&(condition==='全部成色'||i.condition===condition)&&(radius==='不限距离'||i.distance===null||i.distance<=parseInt(radius))).sort((a,b)=>{
  if(feed==='附近好物'||sort==='距离最近')return (a.distance??Infinity)-(b.distance??Infinity);
  if(feed==='最新发布'||sort==='最新发布')return b.created-a.created;
  return (matchByItem.get(b.id)?.score||0)-(matchByItem.get(a.id)?.score||0)||String(a.id).localeCompare(String(b.id));
 }),[state,city,category,query,condition,radius,sort,feed,matchByItem]);
 const favoriteItems=useMemo(()=>state.items.filter(item=>state.favorites.includes(item.id)),[state.items,state.favorites]);
 const selectedChat=useMemo(()=>state.messages.filter(message=>message.peer===chatPeer),[state.messages,chatPeer]);
 const apiConversation=(state.conversations||[]).find(conversation=>conversation.otherUserId===chatPeer);
 const chatInfo=apiMode?(apiConversation?{...apiConversation,name:apiConversation.otherUserName,itemId:apiConversation.listingId}:null):selectedChat[0];
 const peers=useMemo(()=>apiMode?(state.conversations||[]).map(conversation=>({peer:conversation.otherUserId,name:conversation.otherUserName,text:conversation.lastMessage,time:conversation.lastMessageAt?new Date(conversation.lastMessageAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}):''})):[...new Map(state.messages.map(message=>[message.peer,message])).values()],[state.messages,state.conversations,apiMode,locale]);
 function submitSearch(e){e.preventDefault();setQuery(searchText.trim());go('home');setTimeout(()=>document.getElementById('discover')?.scrollIntoView({behavior:'smooth'}),80)}
 return <>
  <InstallApp/>
  <div className="utility-bar"><div className="shell utility-inner"><span><Leaf size={13}/> {t('少一点闲置，多一点可能。')}</span><span className={`api-mode-pill ${apiMode?'connected':''}`} role="status">{t(apiMode?(apiError?'后端 API 暂不可用':apiLoading?'正在连接后端 API…':'后端 API 模式'):'本机演示模式')}</span><button onClick={()=>setModal({type:'about'})}>{t(apiMode?'关于服务器数据模式':'交互原型 · 演示数据')} <Info size={12}/></button>{apiMode&&apiError&&<button onClick={refreshApi}>{t('重试连接')}</button>}{accessToken&&apiConfigured&&<button onClick={()=>{setForceLocalMode(value=>!value);setApiRevision(value=>value+1)}}>{t(apiMode?'切换本机演示':'连接后端 API')}</button>}<LanguagePicker/></div></div>
  <header className="header"><div className="shell header-inner">
   <button className="brand" onClick={()=>go('home')} aria-label={t('换换首页')}><span className="brand-icon"><ArrowLeftRight size={26} strokeWidth={2.6}/></span><span>换换<span className="brand-english">HUANHUAN</span></span></button>
   <nav className="desktop-nav"><button className={page==='home'?'active':''} onClick={()=>go('home')}>{t('发现好物')}</button><button className={page==='exchanges'?'active':''} onClick={()=>go('exchanges')}>{t('我的交换')}{pendingCount>0&&<i/>}</button><button className={page==='messages'?'active':''} onClick={()=>go('messages')}>{t('消息')}</button></nav>
   <form className="header-search" onSubmit={submitSearch}><Search size={17}/><input aria-label={t('搜一搜，发现想换的好物')} placeholder={t('搜一搜，发现想换的好物')} value={searchText} onChange={e=>setSearchText(e.target.value)}/><kbd>↵</kbd></form>
   <button className="button primary publish-top" onClick={()=>setModal({type:'publish'})}><Plus size={18}/>{t('发布闲置')}</button><button className="profile-button" aria-label={t('我的主页')} onClick={()=>go('profile')}><Avatar/></button>
  </div></header>
  {apiMode&&apiError&&<div className="shell api-error-banner" role="alert"><Info size={17}/><span>{t(apiError)}</span><button className="text-button" onClick={refreshApi}>{t('重试连接')}</button></div>}
  <main className="shell">
  {page==='home'&&<>
   <section className="hero">
    <div className="hero-copy"><div className="eyebrow"><span/> {t('让好物循环，让生活常新')}</div><h1>{t('你的闲置，')}<br/>{t('别人的')}<span className="heart-word">{t('心动')}<svg viewBox="0 0 175 13" aria-hidden="true"><path d="M3 9 Q85 -3 171 7"/></svg></span>。</h1><p>{t('不必买新的，也能遇见新的喜欢。')}<br/>{t('用一件闲置，交换生活的另一种可能。')}</p><div className="hero-actions"><button className="button primary" onClick={browse}>{t('发现心动好物')} <ArrowUpRight size={18}/></button><button className="hero-secondary" onClick={()=>setModal({type:'how'})}>{t('第一次来？了解怎么换')} <ArrowRight size={15}/></button></div><div className="hero-foot"><span className="little-avatars"><Avatar name="小"/><Avatar name="林"/><Avatar name="阿"/></span><span>{t('让每一份喜欢，都有新的归处')} <Heart size={13}/></span></div></div>
    <div className="hero-visual"><img src={assetUrl('images/hero.jpg')} alt={t('相机、书籍、帆布包和陶杯组成的闲置好物静物')}/><span className="floating-note"><span><ArrowLeftRight size={17}/></span> {t('好物不闲置，喜欢有回音')}</span><span className="hero-photo-caption">A NEW HOME FOR YOUR OLD FAVORITES</span></div>
   </section>
   <section className="benefits" aria-label={t('平台特点')}><div><ArrowLeftRight/><span><strong>{t('以物换物')}</strong><small>{t('不谈价格，只谈喜欢')}</small></span></div><div><MapPin/><span><strong>{t('发现附近')}</strong><small>{t('同城见面，轻松交换')}</small></span></div><div><ShieldCheck/><span><strong>{t('双方自愿')}</strong><small>{t('聊得投缘，换得安心')}</small></span></div><div><Leaf/><span><strong>{t('让好物循环')}</strong><small>{t('给闲置一个新的故事')}</small></span></div></section>
   <section className="categories" aria-label={t('物品分类')}>{categories.map((c,i)=>{const Icon=categoryIcons[i];return <button key={c} onClick={()=>{setCategory(c);document.getElementById('discover')?.scrollIntoView({behavior:'smooth',block:'start'})}} className={category===c?'selected':''}><span className="category-symbol"><Icon strokeWidth={1.5}/></span><span>{t(c)}</span></button>})}</section>
   <section className="discover" id="discover"><div className="section-title"><div><span className="section-kicker">GOOD THINGS, SECOND STORIES</span><h2>{t('下一件心动，就在这里')}<span className="green-dot"/></h2></div><button className="location-button" onClick={()=>setModal({type:'city'})}><MapPin size={15}/>{t(city)} <ChevronDown size={14}/></button></div>
   <div className="feed-tools"><div className="feed-tabs">{['为你发现','附近好物','最新发布'].map(f=><button key={f} disabled={apiMode&&f==='附近好物'} title={t(apiMode&&f==='附近好物'?'距离服务尚未接入':'')} onClick={()=>setFeed(f)} className={feed===f?'active':''}>{t(f)}</button>)}</div><div className="filter-tools"><select aria-label={t('物品排序')} value={sort} onChange={e=>setSort(e.target.value)}><option value="推荐排序">{t('推荐排序')}</option><option value="最新发布">{t('最新发布')}</option><option value="距离最近" disabled={apiMode}>{t('距离最近')}</option></select><button onClick={()=>setModal({type:'filter'})} className={condition!=='全部成色'||radius!=='不限距离'?'filter-active':''}><SlidersHorizontal size={15}/>{t('筛选')}</button></div></div>
   {(query||city!=='全部城市'||category!=='全部好物'||condition!=='全部成色'||radius!=='不限距离')&&<div className="active-filters"><span>{t('找到')} {filtered.length} {t('件好物')}</span>{[query,city!=='全部城市'&&city,category!=='全部好物'&&category,condition!=='全部成色'&&condition,radius!=='不限距离'&&radius].filter(Boolean).map(x=><span className="tag" key={x}>{t(x)}</span>)}<button onClick={()=>{setQuery('');setSearchText('');setCity('全部城市');setCategory('全部好物');setCondition('全部成色');setRadius('不限距离')}}>{t('清除筛选')} <X size={13}/></button></div>}
   {filtered.length?<div className="product-grid">{filtered.map(i=><ProductCard key={i.id} item={i} status={itemStatus(state,i.id)} match={matchByItem.get(i.id)} favorite={state.favorites.includes(i.id)} onFavorite={()=>toggleFavorite(i.id)} onClick={()=>setModal({type:'detail',itemId:i.id})}/>)}</div>:<Empty icon={Search} title="暂时没有找到合适的好物" text="试试其他关键词、分类，或者看看其他城市的闲置。" action="看看全部好物" onAction={()=>{setQuery('');setSearchText('');setCategory('全部好物');setCondition('全部成色');setRadius('不限距离');setCity('全部城市')}}/>}
   {filtered.length>0&&<div className="feed-end"><span/><Leaf size={15}/><p>{t('好物不在多，遇见喜欢的刚刚好')}</p><span/></div>}
   </section>
   <section className="publish-banner"><div className="banner-symbol"><Package size={37} strokeWidth={1.4}/><span><Leaf size={17}/></span></div><div><span className="section-kicker">MAKE ROOM FOR SOMETHING NEW</span><h3>{t('你的闲置，也许正是别人想找的。')}</h3><p>{t('拍张照，写下想换的东西。让下一次心动，从这里开始。')}</p></div><button className="button primary" onClick={()=>setModal({type:'publish'})}><Plus size={17}/> {t('发布第一件闲置')}</button></section>
  </>}
  {page==='exchanges'&&<section className="workspace"><PageHeading eyebrow="A LITTLE GIVE, A LITTLE GET" title="我的交换" subtitle="每一次交换，都是一段新的相遇。"/><div className="page-tabs">{['全部','收到的','发出的','进行中','已结束'].map(tab=><button className={exchangeTab===tab?'active':''} key={tab} onClick={()=>setExchangeTab(tab)}>{t(tab)}{tab==='收到的'&&pendingCount>0&&<span>{pendingCount}</span>}</button>)}</div><div className="exchange-list">{state.offers.filter(o=>exchangeTab==='全部'||exchangeTab==='收到的'&&o.direction==='incoming'||exchangeTab==='发出的'&&o.direction==='outgoing'||exchangeTab==='进行中'&&['accepted','partial','disputed'].includes(o.status)||exchangeTab==='已结束'&&['completed','cancelled','rejected'].includes(o.status)).map(o=>{const from=state.items.find(i=>i.id===o.from),to=state.items.find(i=>i.id===o.to);return <button className="exchange-card" key={o.id} onClick={()=>setModal({type:'exchange',offerId:o.id})}><div className="exchange-card-top"><span><Avatar name={o.direction==='incoming'?from.name:to.name}/>{o.direction==='incoming'?from.name:to.name}<small>{t(o.direction==='incoming'?'向你发起了交换':'你发起的交换')}</small></span><span className={`status-pill ${o.status}`}>{t(offerNames[o.status])}</span></div><div className="exchange-pair"><MiniItem item={o.direction==='incoming'?to:from} caption="我的物品"/><span className="swap-circle"><ArrowLeftRight size={23}/></span><MiniItem item={o.direction==='incoming'?from:to} caption="对方的物品"/></div><div className="exchange-card-bottom"><p>{o.note||t('一起让闲置流动起来吧。')}</p><span>{t('查看详情')} <ArrowRight size={15}/></span></div></button>})}</div>{!state.offers.some(o=>exchangeTab==='全部'||exchangeTab==='收到的'&&o.direction==='incoming'||exchangeTab==='发出的'&&o.direction==='outgoing'||exchangeTab==='进行中'&&['accepted','partial','disputed'].includes(o.status)||exchangeTab==='已结束'&&['completed','cancelled','rejected'].includes(o.status))&&<Empty icon={ArrowLeftRight} title="这里还没有交换记录" text="去发现一件喜欢的东西，用你的闲置发起交换吧。" action="去逛逛" onAction={browse}/>}</section>}
  {page==='messages'&&<section className="workspace"><PageHeading eyebrow="SAY HELLO TO A NEW STORY" title="消息" subtitle="从一句你好，开始一次交换。"/><div className="chat-layout"><aside className="chat-list"><h3>{t('全部会话')} <span>{peers.length}</span></h3>{peers.map(p=><button key={p.peer} onClick={()=>setChatPeer(p.peer)} className={chatPeer===p.peer?'active':''}><Avatar name={p.name}/><span><strong>{p.name}<small>{p.time}</small></strong><p>{p.text||t('还没有消息')}</p></span></button>)}</aside><div className="chat-main">{chatInfo?<><div className="chat-title"><div><Avatar name={chatInfo.name}/><span><strong>{chatInfo.name}</strong><small>{t(apiMode?'通过服务器发送 · 非即时推送':'演示联系人 · 非实时聊天')}</small></span></div><button className="icon-button" aria-label={t('举报或拉黑用户')} onClick={()=>setModal({type:'report',peer:chatPeer})}><MoreHorizontal size={22}/></button></div>{(()=>{const i=state.items.find(i=>i.id===chatInfo.itemId);return i&&<button className="chat-item" onClick={()=>setModal({type:'detail',itemId:i.id})}><img src={i.image} alt=""/><span><strong>{i.title}</strong><small>{t('想换：')}{i.wish}</small></span><ChevronRight size={18}/></button>})()}<div className="chat-bubbles"><p className="chat-date">{t(apiMode?'聊天消息通过后端 API 加载':'演示会话 · 消息仅保存在本机')}</p>{selectedChat.map(m=><div key={m.id} className={`message-row ${m.mine?'mine':''}`}><Avatar name={m.mine?'你':m.name}/><div><p>{m.text}</p><small>{m.time}</small></div></div>)}</div><ChatInput apiMode={apiMode} disabled={state.blocked.includes(chatPeer)} onSend={sendChat}/></>:<Empty icon={MessageCircle} title="选择一个会话" text="你可以从物品详情联系发布者。"/>}</div></div></section>}
  {page==='profile'&&<section className="workspace"><div className="profile-hero"><Avatar name={apiMode?(apiProfile?.displayName||state.profile?.displayName||'你'):(state.profile?.displayName||'你')} large/><div><span className="section-kicker">MY LITTLE CORNER</span><h1>{t('你好，')}{apiMode?(apiProfile?.displayName||state.profile?.displayName||'换换用户'):(state.profile?.displayName||'生活收藏家')}</h1><p>{(apiProfile?.city||state.profile?.city||city)!=='全部城市'&&<><MapPin size={14}/> {t(apiProfile?.city||state.profile?.city||city)} · </>}{t(apiMode?'后端账户':'本机演示账户')}</p></div><div className="profile-hero-actions"><button className="button secondary small" onClick={()=>setModal({type:'profile'})}>{t('编辑资料')}</button><button className="icon-button settings" aria-label={t('设置')} onClick={()=>setModal({type:'settings'})}><Settings size={21}/></button></div></div><div className="profile-stats"><div><strong>{myItems.length}</strong><span>{t('我的闲置')}</span></div><div><strong>{state.offers.filter(o=>o.status==='completed').length}</strong><span>{t('完成交换')}</span></div><div><strong>{state.favorites.length}</strong><span>{t('收藏好物')}</span></div></div><div className="profile-title"><div className="page-tabs">{['我的闲置','我的收藏','我的评价'].map(tab=><button className={profileTab===tab?'active':''} key={tab} onClick={()=>setProfileTab(tab)}>{t(tab)}</button>)}</div><button className="button primary small" onClick={()=>setModal({type:'publish'})}><Plus size={16}/>{t('发布闲置')}</button></div>{profileTab==='我的评价'?state.reviews.length?<div className="review-list">{state.reviews.map(r=><div key={r.offerId} className="review-card"><strong>{t('我发出的评价')}</strong><span>{'★'.repeat(r.stars)}{'☆'.repeat(5-r.stars)}</span><p>{r.text||t('这次交换很愉快。')}</p></div>)}</div>:<Empty icon={Star} title="还没有交换评价" text="完成交换后，可以为这次相遇留下评价。"/>:<div className="product-grid profile-grid">{(profileTab==='我的闲置'?myItems:favoriteItems).map(i=><ProductCard key={i.id} item={i} status={itemStatus(state,i.id)} favorite={state.favorites.includes(i.id)} onFavorite={()=>toggleFavorite(i.id)} onClick={()=>setModal({type:'detail',itemId:i.id})}/>)}</div>}{profileTab==='我的收藏'&&!favoriteItems.length&&<Empty icon={Heart} title="把喜欢的好物留在这里" text="点击物品上的爱心，即可收藏。" action="发现好物" onAction={browse}/>}</section>}
  </main>
  <footer className="footer"><div className="shell footer-inner"><div><span className="footer-brand"><ArrowLeftRight size={20}/> 换换</span><span>{t('让闲置，再次被喜欢。')}</span></div><div><button onClick={()=>setModal({type:'how'})}>{t('交换指南')}</button><button onClick={()=>setModal({type:'safety'})}>{t('安全与隐私')}</button><span className="footer-note">{t('为喜欢交换 · 为生活留白')}</span></div></div></footer>
  <nav className="mobile-nav">{[{key:'home',label:'首页',icon:Home},{key:'messages',label:'消息',icon:MessageCircle},{key:'publish',label:'发布',icon:Plus},{key:'exchanges',label:'交换',icon:ArrowLeftRight},{key:'profile',label:'我的',icon:User}].map(n=><button key={n.key} className={`${page===n.key?'active':''} ${n.key==='publish'?'mobile-publish':''}`} onClick={()=>n.key==='publish'?setModal({type:'publish'}):go(n.key)}><n.icon size={21}/><span>{t(n.label)}</span></button>)}</nav>
  {toast&&<div className="toast" role="status"><CircleCheck size={18}/>{toast}</div>}
  {modal&&<Modal key={modal.type} wide={['detail','publish','editListing','exchange'].includes(modal.type)} onClose={()=>setModal(null)} title={{detail:'好物详情',publish:'发布闲置',editListing:'编辑物品',profile:'个人资料设置',offer:'发起交换',exchange:'交换详情',how:'交换，其实很简单',city:'选择所在城市',filter:'找到合适的好物',about:'欢迎来到换换',safety:'安心交换小贴士',settings:'演示设置',report:'举报与拉黑',review:'为这次交换留下评价'}[modal.type]}>
   {modal.type==='detail'&&(()=>{
    const i=state.items.find(x=>x.id===modal.itemId);if(!i)return null;
    const status=itemStatus(state,i.id),canEdit=!['locked','exchanged','pending_review'].includes(status);
    const canRestore=status==='hidden'&&(!apiMode||i.moderationStatus==='approved');
    return <div className="detail-layout"><div className="detail-image"><img src={i.image} alt={i.title}/><span className="photo-indicator">1 / 1</span></div><div className="detail-copy">
     <div className="detail-tags"><span className="tag">{t(i.condition)}</span><span className="tag neutral">{t(i.category)}</span><span className="tag neutral">{t(statusNames[status]||status)}</span></div><h2>{i.title}</h2>
     <p className="detail-location"><MapPin size={14}/>{t(i.city)}{i.area?` · ${t(i.area)}`:''}{i.owner!=='me'&&i.distance!==null&&` · ${t('距你约')} ${i.distance} km (${t('演示')})`}</p>
     <div className="wish-box"><ArrowLeftRight size={20}/><div><small>{t('我想换')}</small><strong>{i.wish}</strong></div></div><h4>{t('关于这件好物')}</h4><p className="description">{i.description}</p><p className="flaws"><Info size={14}/><span>{t('成色说明：')}{i.flaws}</span></p>
     <div className="detail-owner"><Avatar name={i.name}/><div><strong>{i.name}</strong><small>{t(i.owner==='me'?'我的闲置':apiMode?'换换用户':'演示发布者 · 同城见面交换')}</small></div>{i.owner!=='me'&&<button className="icon-button" aria-label={t('举报物品')} onClick={()=>setModal({type:'report',peer:i.owner,itemId:i.id})}><Flag size={17}/></button>}</div>
     <div className="detail-actions">{i.owner==='me'?<><button className="button secondary" disabled={!canEdit} onClick={()=>setModal({type:'editListing',itemId:i.id})}><Eye size={17}/>{t('编辑物品')}</button><button className="button secondary" disabled={['locked','exchanged'].includes(status)||(status==='hidden'&&!canRestore)} onClick={()=>changeListingVisibility(i,status)}>{status==='hidden'?<Eye size={17}/>:<EyeOff size={17}/>} {t(status==='hidden'?(canRestore?'重新上架':'等待审核'):'下架物品')}</button></>:<><button className={`icon-button favorite-detail ${state.favorites.includes(i.id)?'saved':''}`} aria-label={t('收藏物品')} onClick={()=>toggleFavorite(i.id)}><Heart size={20} fill={state.favorites.includes(i.id)?'currentColor':'none'}/></button><button className="button secondary" onClick={()=>openChat(i)}>{t('聊一聊')}</button><button className="button primary" disabled={status!=='available'||state.blocked.includes(i.owner)} onClick={()=>setModal({type:'offer',itemId:i.id})}><ArrowLeftRight size={17}/>{t(status==='available'?'我想换':statusNames[status]||status)}</button></>}</div>
     <p className="mini-notice"><ShieldCheck size={13}/> {t('双方自愿 · 不涉及现金 · 当面检查后交接')}</p></div></div>;
   })()}
   {modal.type==='offer'&&<OfferForm state={state} item={state.items.find(i=>i.id===modal.itemId)} onPublish={()=>setModal({type:'publish'})} onSubmit={async(from,note)=>{
    if(apiMode){try{
     const offer=await apiClient.createOffer({requestedListingId:modal.itemId,offeredListingId:from,note});
     const mapped={id:offer.id,from:offer.offeredListingId,to:offer.requestedListingId,direction:'outgoing',status:offer.status,note:offer.note||note,mineConfirmed:false,theirsConfirmed:false,created:Date.now()};
     applyState({...stateRef.current,offers:[mapped,...stateRef.current.offers]});setModal({type:'exchange',offerId:offer.id});notify('交换申请已发送，等待对方回应。');
    }catch(error){handleApiError(error)}return}
    const id=crypto.randomUUID();if(dispatch({type:'offer',id,from,to:modal.itemId,note})){setModal({type:'exchange',offerId:id});notify('交换申请已发送（本机演示）')}else notify('这组物品已有申请，或物品已不可交换。');
   }}/>}
   {(modal.type==='publish'||modal.type==='editListing')&&(()=>{const existing=modal.type==='editListing'?state.items.find(item=>item.id===modal.itemId):null;return <PublishForm city={city} initialItem={existing} remoteMode={apiMode} onSubmit={item=>saveListing(item,existing)}/>})()}
   {modal.type==='exchange'&&<ExchangeDetail state={state} offer={state.offers.find(o=>o.id===modal.offerId)} isApiMode={apiMode} transition={async action=>{
    if(!apiMode){const success=dispatch({type:'transition',id:modal.offerId,action});notify(success?({accept:'双方物品已锁定，可以协商交接了。',reject:'已拒绝本次交换',cancel:'已取消，物品已释放',mine:'已记录你的交接确认',theirs:'已模拟对方确认',dispute:'已记录问题，物品保持锁定；演示不会提交真实客服。'}[action]):'当前状态不支持此操作，物品可能已有其他交换。');return}
    const current=stateRef.current.offers.find(offer=>offer.id===modal.offerId);if(!current)return;
    try{
     if(action==='dispute'){
      const reportedListingId=current.direction==='incoming'?current.from:current.to;
      const report=await apiClient.createReport({targetType:'listing',targetId:reportedListingId,reason:'交换过程中遇到问题',details:current.note||''});applyState({...stateRef.current,reports:[report,...stateRef.current.reports]});notify('问题已提交到平台处理队列。');return;
     }
     const updated=action==='mine'?await apiClient.confirmHandoff(modal.offerId):await apiClient.respondToOffer(modal.offerId,action);
     const outgoing=current.direction==='outgoing';
     const changed={...current,status:updated.status,mineConfirmed:outgoing?updated.requesterConfirmed:updated.recipientConfirmed,theirsConfirmed:outgoing?updated.recipientConfirmed:updated.requesterConfirmed};
     const overlaps=offer=>[offer.from,offer.to].some(id=>id===current.from||id===current.to);
     const offers=stateRef.current.offers.map(offer=>offer.id===current.id?changed:(['accepted','completed','cancelled','rejected'].includes(updated.status)&&offer.status==='pending'&&overlaps(offer)?{...offer,status:'cancelled'}:offer));
     applyState({...stateRef.current,offers});
     notify(({accept:'已接受交换，双方物品已锁定。',reject:'已拒绝本次交换。',cancel:'交换已取消。',mine:'已记录你的交接确认。'})[action]||'状态已更新。');
    }catch(error){handleApiError(error)}
   }} onChat={openChat} onReview={()=>setModal({type:'review',offerId:modal.offerId})}/> }
   {modal.type==='review'&&<ReviewForm onSubmit={async(stars,text)=>{
    if(apiMode){try{const review=await apiClient.createReview(modal.offerId,{stars,body:text});applyState({...stateRef.current,reviews:[{offerId:review.offerId,stars:review.stars,text:review.body,reviewerName:review.reviewerName,createdAt:review.createdAt},...stateRef.current.reviews]});setModal(null);notify('评价已提交。')}catch(error){handleApiError(error)}return}
    dispatch({type:'review',review:{offerId:modal.offerId,stars,text}});setModal(null);notify('评价已保存，谢谢你的分享。');
   }}/>}
   {modal.type==='city'&&<CityForm city={city} onApply={value=>{setCity(value);setModal(null)}}/>}
   {modal.type==='filter'&&<FilterForm condition={condition} radius={radius} apiMode={apiMode} onApply={(c,r)=>{setCondition(c);setRadius(r);setModal(null)}}/>}
   {modal.type==='how'&&<div className="simple-modal how-modal"><p className="muted">{t('没有价格，没有复杂规则。喜欢，就换一换。')}</p>{[{icon:Camera,title:'01  晒出闲置',text:'拍一张实物照片，写下成色和想换的东西。'},{icon:Heart,title:'02  发现心动',text:'逛一逛，选中喜欢的好物，用自己的物品发起交换。'},{icon:MessageCircle,title:'03  聊聊再决定',text:'双方都愿意后接受申请，约定公开场所见面。'},{icon:ArrowLeftRight,title:'04  交换新的喜欢',text:'当面检查，自愿交接，双方确认完成。'}].map(s=><div className="how-step" key={s.title}><span><s.icon size={23}/></span><div><h3>{t(s.title)}</h3><p>{t(s.text)}</p></div></div>)}<button className="button primary full" onClick={()=>{setModal(null);browse()}}>{t('开始发现好物')} <ArrowRight size={17}/></button></div>}
   {modal.type==='about'&&<div className="simple-modal"><div className="info-illustration"><ArrowLeftRight size={35}/></div><h2>{t('让闲置，再次被喜欢。')}</h2><p>{t(apiMode?'当前页面已启用配置的后端 API，可读取和提交账户、物品、收藏、交换及消息数据。':'这是「换换」的可交互设计原型。你可以在本机浏览、收藏、发布物品并体验交换流程。')}</p><div className="notice-box"><Info size={19}/><p>{t(apiMode?'API 请求会发送到已配置的后端；数据是否持久化取决于该服务的仓库配置。短信/邮件身份服务、图片对象存储和真实客服尚未接入。可随时切换本机演示模式。':'本机演示数据只保存在当前浏览器，不会发送给其他用户；没有真实审核、客服、物流或支付服务。高价值物品仅用于展示，不代表上线开放品类。')}</p></div><button className="button primary full" onClick={()=>setModal(null)}>{t('知道了，去逛逛')}</button></div>}
   {modal.type==='safety'&&<div className="simple-modal safety-modal"><ShieldCheck size={38}/><h2>{t('放心交换，从彼此尊重开始。')}</h2><ul><li>{t('如实说明物品瑕疵，不交换违禁品、药品或危险物品。')}</li><li>{t('优先白天在公开场所见面，不向陌生人透露家庭住址。')}</li><li>{t('交接前检查实物，不满意可以拒绝，不强迫交换。')}</li><li>{t('不支付订金、保证金或差价，不发送验证码。')}</li><li>{t('遇到问题可保留记录；涉及人身危险请及时联系当地适当机构。')}</li></ul><div className="notice-box"><Info size={18}/><p>{t(apiMode?'举报会提交给后端，但人工审核、客服和图片存储仍取决于运营配置。请勿填写身份证、住址等敏感信息；原型不会读取精确位置。':'本原型没有真实审核或人工客服。请勿上传身份证、住址等敏感信息。上传图片会缩放并重新编码；原型不读取位置权限。你可以在设置里清除全部本机数据。')}</p></div></div>}
   {modal.type==='settings'&&<div className="simple-modal"><h3>{t(apiMode?'账户数据设置':'这是你的本机演示空间')}</h3><p className="muted">{t(apiMode?'物品、收藏、交换和消息通过已配置的后端 API 同步。':'收藏、消息和交换记录保存在当前浏览器。当前账号的交换体验数据不会同步到其他设备。')}</p><div className="settings-row"><span>{t('已记录举报')}</span><strong>{state.reports.length}</strong></div><div className="settings-row"><span>{t('已拉黑用户')}</span><strong>{state.blocked.length}</strong></div>{!apiMode&&<button className="button secondary full" onClick={()=>{if(window.confirm(t('确定清除本机数据吗？你发布的物品、聊天和交换记录都会被删除，恢复初始演示内容。'))){const fresh=initialState();stateRef.current=fresh;setState(fresh);setChatPeer('u2');setModal(null);notify('已恢复初始演示数据')}}}><RefreshCw size={17}/>{t('重置全部演示数据')}</button>}</div>}
   {modal.type==='profile'&&<ProfileForm profile={{...(apiMode?(apiProfile||state.profile||{}):(state.profile||{})),locale}} onSubmit={saveProfile}/>}
   {modal.type==='report'&&<ReportForm apiMode={apiMode} onReport={async(reason,text)=>{
    if(apiMode){try{const report=await apiClient.createReport({targetType:modal.itemId?'listing':'user',targetId:modal.itemId||modal.peer,reason,details:text});applyState({...stateRef.current,reports:[report,...stateRef.current.reports]});setModal(null);notify('举报已提交到平台审核队列。')}catch(error){handleApiError(error)}return}
    dispatch({type:'report',report:{id:crypto.randomUUID(),peer:modal.peer,itemId:modal.itemId,reason,text}});setModal(null);notify('举报已记录在本机；原型不接入真实客服。');
   }} onBlock={async()=>{
    if(apiMode){try{await apiClient.blockUser(modal.peer);const current=stateRef.current;applyState({...current,blocked:[...new Set([...current.blocked,modal.peer])],conversations:current.conversations.filter(conversation=>conversation.otherUserId!==modal.peer),messages:current.messages.filter(message=>message.peer!==modal.peer)});if(chatPeer===modal.peer)setChatPeer('');setModal(null);notify('已拉黑该用户。')}catch(error){handleApiError(error)}return}
    dispatch({type:'block',peer:modal.peer});setModal(null);notify('已拉黑：隐藏该用户物品并停止发消息。已有交换仍可处理。');
   }}/>}
  </Modal>}
 </>;
}
function ProductCard({item:i,status,favorite,onFavorite,onClick,match}){const {t}=useLocale();return <article className="product-card"><div className={`product-photo photo-${i.id}`}><button className="photo-open" onClick={onClick} aria-label={`${t('查看')}${i.title}`}><img loading="lazy" src={i.image} alt={i.title}/></button><span className="condition-badge">{t(status!=='available'?statusNames[status]:i.condition)}</span><button className={`favorite-button ${favorite?'saved':''}`} aria-label={`${t(favorite?'取消收藏':'收藏')}${i.title}`} aria-pressed={favorite} onClick={onFavorite}><Heart size={18} strokeWidth={1.7} fill={favorite?'currentColor':'none'}/></button></div><div className="product-info"><button className="product-name" onClick={onClick}>{i.title}</button>{match?.mutual&&<span className="match-badge" title={t('根据双方填写的换物心愿初步匹配，不代表一定成交。')}><Sparkles size={12}/>{t('可能双向心愿匹配')}</span>}<div className="product-wish"><ArrowLeftRight size={14}/><span>{t('想换')}</span><strong>{i.wish}</strong></div><div className="product-owner"><span><Avatar name={i.name}/>{i.name}</span><small><MapPin size={11}/>{i.owner==='me'?t('我的物品'):i.distance===null?t('未提供距离'):i.distance===undefined?t('同城'):t(`${i.distance} km`)}</small></div></div></article>}
function PageHeading({eyebrow,title,subtitle}){const {t}=useLocale();return <div className="page-heading"><span className="section-kicker">{t(eyebrow)}</span><h1>{t(title)}</h1><p>{t(subtitle)}</p></div>}
function MiniItem({item,caption}){const {t}=useLocale();return <div className="mini-item"><img src={item.image} alt={item.title}/><div><small>{t(caption)}</small><strong>{item.title}</strong><span>{t(item.condition)}</span></div></div>}
function Empty({icon:Icon,title,text,action,onAction}){const {t}=useLocale();return <div className="empty"><span><Icon size={31} strokeWidth={1.3}/></span><h3>{t(title)}</h3><p>{t(text)}</p>{action&&<button className="button secondary" onClick={onAction}>{t(action)}<ArrowRight size={15}/></button>}</div>}
function Modal({children,title,onClose,wide}){
 const {t}=useLocale();
 const ref=useRef();const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{const previous=document.activeElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.focus();function key(e){if(e.key==='Escape')closeRef.current();if(e.key==='Tab'){const focusables=Array.from(ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, select, [tabindex="0"]')).filter(el=>el.offsetParent!==null);const first=focusables[0],last=focusables.at(-1);if(!first){e.preventDefault();return}if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus()}}}document.addEventListener('keydown',key);return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus()}},[]);
 return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section ref={ref} className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}><div className="modal-header"><h2 id="dialog-title">{t(title)}</h2><button className="icon-button" onClick={onClose} aria-label={t('关闭弹窗')}><X size={21}/></button></div>{children}</section></div>
}
function OfferForm({item,state,onSubmit,onPublish}){
 const {t}=useLocale();
 const [selected,setSelected]=useState(null),[note,setNote]=useState('');
 const mine=state.items.filter(i=>i.owner==='me'&&itemStatus(state,i.id)==='available');
 return <form className="simple-modal offer-form" onSubmit={e=>{e.preventDefault();if(selected)onSubmit(selected,note)}}>
  <p className="muted">{t('用一件闲置，交换新的喜欢。')}</p>
  <div className="offer-target"><MiniItem item={item} caption="我想换到"/></div>
  <h3>{t('选择你用来交换的物品')} <small>{t('一次选择 1 件')}</small></h3>
  {mine.length?<div className="choose-items">{mine.map(i=><label key={i.id} className={selected===i.id?'selected':''}><input type="radio" name="offer-item" value={i.id} checked={selected===i.id} onChange={()=>setSelected(i.id)} required/><img src={i.image} alt=""/><span><strong>{i.title}</strong><small>{t(i.condition)}</small></span><span className="radio-mark">{selected===i.id&&<Check size={13}/>}</span></label>)}</div>:<div className="no-items"><Package size={25}/><p>{t('还没有可交换的闲置')}</p><button type="button" className="button secondary" onClick={onPublish}>{t('先发布一件')}</button></div>}
  <label className="field">{t('想对对方说的话')} <small>{t('选填')}</small><textarea placeholder={t('你好，很喜欢你的好物！看看我的这件合不合适？')} maxLength={300} rows={3} value={note} onChange={e=>setNote(e.target.value)}/></label>
  <p className="mini-notice"><ShieldCheck size={14}/>{t('接受前可撤回，不涉及现金或保证金。')}</p>
  <button className="button primary full" type="submit" disabled={!selected}><Send size={16}/>{t('确认发送申请')}</button>
 </form>;
}
function ProfileForm({profile={},onSubmit}){
 const {t,languages:languageOptions}=useLocale();
 const [draft,setDraft]=useState({displayName:profile?.displayName||'',countryCode:profile?.countryCode||'CN',city:profile?.city||'',locale:profile?.locale||'zh-CN'});
 return <form className="simple-modal profile-form" onSubmit={event=>{event.preventDefault();onSubmit({...draft,displayName:draft.displayName.trim(),countryCode:draft.countryCode.trim().toUpperCase(),city:draft.city.trim()})}}>
  <p className="muted">{t('更新你的公开资料和界面语言。不要填写家庭住址等敏感信息。')}</p>
  <label className="field">{t('昵称')}<input required maxLength={40} value={draft.displayName} onChange={event=>setDraft({...draft,displayName:event.target.value})} placeholder={t('输入昵称')}/></label>
  <div className="field-row"><label className="field">{t('国家/地区代码')}<input required maxLength={2} minLength={2} pattern="[A-Za-z]{2}" value={draft.countryCode} onChange={event=>setDraft({...draft,countryCode:event.target.value.toUpperCase()})} placeholder="CN"/><small>{t('例如 CN、US、JP')}</small></label><label className="field">{t('所在城市')}<input maxLength={80} value={draft.city} onChange={event=>setDraft({...draft,city:event.target.value})} placeholder={t('例如 成都、Los Angeles')}/></label></div>
  <label className="field">{t('界面语言')}<select value={draft.locale} onChange={event=>setDraft({...draft,locale:event.target.value})}>{languageOptions.map(language=><option key={language.code} value={language.code}>{language.label}</option>)}</select></label>
  <button type="submit" className="button primary full"><Check size={16}/>{t('保存资料')}</button>
 </form>;
}
function PublishForm({city,onSubmit,initialItem,remoteMode=false}){
 const {t}=useLocale();
 const [image,setImage]=useState(initialItem?.image||''),[uploading,setUploading]=useState(false),[error,setError]=useState('');
 async function upload(file){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('请选择不超过 5MB 的 JPG、PNG 或 WebP 图片。');return}
  setUploading(true);setError('');
  try{const bitmap=await createImageBitmap(file),scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);setImage(canvas.toDataURL('image/jpeg',0.75));bitmap.close()}
  catch{setError('这张图片暂时无法读取，请换一张。')}
  finally{setUploading(false)}
 }
 return <form className="publish-form" onSubmit={event=>{
  event.preventDefault();const data=new FormData(event.currentTarget);
  if(!image){setError('请先上传一张物品照片。');return}
  if(!data.get('title').trim()||!data.get('description').trim()||!data.get('flaws').trim()||!data.get('city').trim()){setError('请完整填写物品标题、说明、城市和瑕疵信息。');return}
  onSubmit({...initialItem,id:initialItem?.id??Date.now(),owner:'me',name:'你',image,imageKey:initialItem?.imageKey,
   title:data.get('title').trim(),description:data.get('description').trim(),flaws:data.get('flaws').trim(),category:data.get('category'),condition:data.get('condition'),wish:data.get('wish').trim()||'都可以，聊聊看',city:data.get('city').trim(),area:initialItem?.area||'同城见面',distance:initialItem?.distance??0,status:initialItem?.status||'available',created:initialItem?.created||Date.now()});
 }}>
  <div className="publish-intro"><span><Leaf size={20}/></span><p>{t(initialItem?'更新这件好物的信息。':'让你的闲置，开启下一段故事。')}<small>{t(remoteMode?'后端 API 已连接；图片对象存储尚未接入，所选照片仅用于本地预览。':'当前为本机演示，请勿上传敏感信息。')}</small></p></div>
  <div className="publish-columns"><div><label className={`upload-zone ${image?'has-image':''}`}><input aria-label={t('上传物品照片')} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>upload(event.target.files[0])}/>{image?<><img src={image} alt={t('物品照片预览')}/><span className="change-photo"><Camera size={16}/>{t('更换照片')}</span></>:<><span className="upload-icon"><ImagePlus size={33} strokeWidth={1.4}/></span><strong>{uploading?t('正在处理图片…'):t('上传一张好物照片')}</strong><span>JPG / PNG / WebP · {t('不超过 5MB')}</span><small>{t('自然光、真实成色，会更容易被喜欢')}</small></>}</label><p className="mini-notice"><Camera size={13}/>{t('请拍清物品全貌，也别藏起小瑕疵。')}</p></div>
   <div className="publish-fields"><label className="field">{t('给好物起个名字')}<input name="title" required minLength={2} maxLength={80} defaultValue={initialItem?.title||''} placeholder={t('例如：陪我读过好时光的 KINFOLK')}/></label><div className="field-row"><label className="field">{t('物品分类')}<select name="category" defaultValue={initialItem?.category||categories[1]}>{categories.slice(1).map(categoryName=><option key={categoryName} value={categoryName}>{t(categoryName)}</option>)}</select></label><label className="field">{t('成色')}<select name="condition" defaultValue={initialItem?.condition||'使用良好'}><option value="使用良好">{t('使用良好')}</option><option value="近新">{t('近新')}</option><option value="有明显使用痕迹">{t('有明显使用痕迹')}</option></select></label></div>
   <label className="field">{t('介绍一下它')}<textarea name="description" required minLength={5} rows={3} maxLength={1000} defaultValue={initialItem?.description||''} placeholder={t('它有什么特别的地方？包含哪些配件？')}/></label><label className="field">{t('瑕疵说明')}<input name="flaws" required maxLength={500} defaultValue={initialItem?.flaws||''} placeholder={t('如：封面边角轻微磨损 / 无已知瑕疵')}/></label></div></div>
  <div className="publish-bottom"><label className="field">{t('你想换什么？')}<small>{t('选填')}</small><input name="wish" maxLength={200} defaultValue={initialItem?.wish||''} placeholder={t('例如：书籍、咖啡器具；留空则接受其他提议')}/></label><label className="field">{t('所在城市')}<input name="city" maxLength={80} defaultValue={initialItem?.city|| (city==='全部城市'?'':city)} placeholder={t('例如 Los Angeles、Tokyo、上海')} required/></label></div>
  <label className="consent"><input type="checkbox" required/>{t('我有权处置该物品，已如实描述，不发布违禁或危险物品。')}</label>{error&&<p className="form-error" role="alert">{t(error)}</p>}
  <div className="publish-submit"><span><ShieldCheck size={14}/>{t('不涉及现金，仅实物交换')}</span><button type="submit" className="button primary" disabled={uploading}><Plus size={17}/>{t(initialItem?'保存修改':'提交审核')}</button></div>
 </form>;
}
function ExchangeDetail({state,offer:o,isApiMode=false,transition,onChat,onReview}){
 const {t}=useLocale();
 const [confirm,setConfirm]=useState('');
 if(!o)return <div className="simple-modal"><p className="muted">{t('正在加载交换记录…')}</p></div>;
 const from=state.items.find(i=>i.id===o.from),to=state.items.find(i=>i.id===o.to),mine=o.direction==='incoming'?to:from,other=o.direction==='incoming'?from:to;
 if(!mine||!other)return <div className="simple-modal"><p className="muted">{t('物品资料暂未加载，请刷新后重试。')}</p></div>;
 const reviewed=state.reviews.some(r=>r.offerId===o.id),blocked=state.blocked.includes(other.owner);
 const available=itemStatus(state,o.from)==='available'&&itemStatus(state,o.to)==='available';
 const statusText={pending:o.direction==='incoming'?'有一件好物在等你的回应。':'申请已保存，等待对方回应。',accepted:'双方物品已锁定，聊一聊交接时间和地点吧。',partial:'只有双方都确认实际交接，交换才会完成。',completed:'谢谢你，让一件好物有了新的故事。',cancelled:'交换已取消，未交付的物品已解除本次锁定。',rejected:'这次没有遇到合适的，去看看其他好物吧。',disputed:isApiMode?'已记录异常，等待平台处理。':'已记录异常，物品保持锁定。原型不提供真实客服处理。'};
 return <div className="exchange-detail"><div className={`exchange-status ${o.status}`}><span>{o.status==='completed'?<CircleCheck size={27}/>:<ArrowLeftRight size={27}/>}</span><div><h2>{t(offerNames[o.status])}</h2><p>{t(statusText[o.status])}</p></div></div>
  <div className="exchange-pair detail-pair"><MiniItem item={mine} caption="我提供的物品"/><span className="swap-circle"><ArrowLeftRight size={23}/></span><MiniItem item={other} caption="对方提供的物品"/></div>
  {o.note&&<div className="exchange-note"><MessageCircle size={17}/><p>{o.note}</p></div>}
  <div className="exchange-guidance"><ShieldCheck size={19}/><div><strong>{t('同城见面，检查后再交换')}</strong><p>{t('请在聊天中约定公开地点与时间。只有实际交付后才确认；不满意可以不换。')}</p></div></div>
  {['accepted','partial','completed'].includes(o.status)&&<div className="confirmation-tracker"><span className={o.mineConfirmed?'done':''}>{o.mineConfirmed?<CheckCheck size={19}/>:<Clock size={19}/>} {t(o.mineConfirmed?'我已确认交接':'我尚未确认')}</span><span className={o.theirsConfirmed?'done':''}>{o.theirsConfirmed?<CheckCheck size={19}/>:<Clock size={19}/>} {t(o.theirsConfirmed?'对方已确认交接':'对方尚未确认')}</span></div>}
  {confirm?<div className="confirm-box"><strong>{t(confirm==='mine'?'确认已经当面检查并交付物品吗？':'确定结束这次交换吗？')}</strong><p>{t(confirm==='mine'?'确认后若发生问题，物品会保持锁定并进入问题处理。':'这次申请将结束；未被其他交换占用的物品恢复可交换。')}</p><div><button className="button secondary" onClick={()=>setConfirm('')}>{t('再想想')}</button><button className="button primary" onClick={()=>{transition(confirm);setConfirm('')}}>{t(confirm==='mine'?'确认已交接':'确认操作')}</button></div></div>:<div className="exchange-actions">
   {!blocked&&<button className="button secondary" onClick={()=>onChat(other)}><MessageCircle size={16}/>{t('联系对方')}</button>}
   {o.status==='pending'&&o.direction==='incoming'&&<><button className="button secondary" onClick={()=>setConfirm('reject')}>{t('婉拒')}</button><button className="button primary" disabled={!available||blocked} onClick={()=>transition('accept')}>{t('接受交换')}</button></>}
   {o.status==='pending'&&o.direction==='outgoing'&&<button className="button secondary" onClick={()=>setConfirm('cancel')}>{t('撤回申请')}</button>}
   {o.status==='accepted'&&<button className="text-button" onClick={()=>setConfirm('cancel')}>{t('取消交换')}</button>}
   {['accepted','partial'].includes(o.status)&&!o.mineConfirmed&&<button className="button primary" onClick={()=>setConfirm('mine')}>{t('我已完成交接')}</button>}
   {['accepted','partial'].includes(o.status)&&<button className="text-button" onClick={()=>transition('dispute')}>{t('遇到问题')}</button>}
   {o.status==='completed'&&<button className="button primary" disabled={reviewed} onClick={onReview}><Star size={16}/>{t(reviewed?'已评价':'评价这次交换')}</button>}
  </div>}
  {o.status==='pending'&&!available&&<p className="form-error">{t('其中一件物品正在其他交换中，暂时无法接受。')}</p>}
  {!isApiMode&&(o.direction==='outgoing'&&o.status==='pending'&&available||['accepted','partial'].includes(o.status)&&!o.theirsConfirmed)&&<div className="demo-panel"><div><Sparkles size={16}/><span><strong>{t('原型体验工具')}</strong><small>{t('没有真实联系人，通过模拟继续体验流程。')}</small></span></div><button onClick={()=>transition(o.status==='pending'?'accept':'theirs')}>{t(o.status==='pending'?'模拟对方接受':'模拟对方确认交接')} <ArrowRight size={14}/></button></div>}
 </div>;
}
function ChatInput({onSend,disabled,apiMode=false}){const {t}=useLocale();const [text,setText]=useState(''),[sending,setSending]=useState(false);const ref=useRef();async function submit(event){event.preventDefault();const value=text.trim();if(!value||disabled||sending)return;setSending(true);try{const result=await onSend(value);if(result!==false){setText('');setTimeout(()=>{const el=document.querySelector('.chat-bubbles');if(el)el.scrollTop=el.scrollHeight},20)}}finally{setSending(false)}}return <form className="chat-input" onSubmit={submit}><textarea aria-label={t('聊天消息')} ref={ref} placeholder={t(disabled?'已拉黑，无法发送消息':'聊聊物品状态，约个交换的时间…')} value={text} maxLength={1000} disabled={disabled||sending} rows={2} onChange={e=>setText(e.target.value)}/><div><span>{t(apiMode?'通过后端 API 保存消息':'仅保存本机 · 不发送给真实用户')}</span><button type="submit" className="button primary small" disabled={!text.trim()||disabled||sending}>{t(sending?'发送中…':'发送')} <Send size={14}/></button></div></form>}
function CityForm({city,onApply}){
 const {t}=useLocale();
 const [draft,setDraft]=useState(city==='全部城市'?'':city);
 return <form className="simple-modal city-form" onSubmit={e=>{e.preventDefault();const value=draft.trim();if(value)onApply(value)}}><p className="muted">{t('选择你想浏览的城市，不会获取精确定位。')}<br/>{t('当前演示物品位于成都。')}</p><label className="field">{t('所在城市')}<input maxLength={80} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={t('例如 Los Angeles、Tokyo、上海')}/></label><div className="city-form-actions"><button type="button" className="button secondary" onClick={()=>onApply('全部城市')}>{t('全部城市')}</button><button type="submit" className="button primary" disabled={!draft.trim()}><MapPin size={15}/>{t('查看好物')}</button></div></form>;
}
function FilterForm({condition,radius,onApply,apiMode=false}){
 const {t}=useLocale();
 const [c,setC]=useState(condition),[r,setR]=useState(radius);
 return <form className="simple-modal" onSubmit={e=>{e.preventDefault();onApply(c,apiMode?'不限距离':r)}}><h3>{t('物品成色')}</h3><div className="filter-options">{['全部成色','近新','使用良好','有明显使用痕迹'].map(x=><button type="button" className={c===x?'selected':''} key={x} onClick={()=>setC(x)}>{t(x)}</button>)}</div>{apiMode?<p className="muted">{t('距离筛选暂不可用：后端尚未接入距离服务。')}</p>:<><h3>{t('距离范围')} <small>{t('演示距离')}</small></h3><div className="filter-options">{['不限距离','1 km 内','3 km 内','5 km 内'].map(x=><button type="button" className={r===x?'selected':''} key={x} onClick={()=>setR(x)}>{t(x)}</button>)}</div></>}<div className="filter-footer"><button type="button" className="button secondary" onClick={()=>{setC('全部成色');setR('不限距离')}}>{t('重置')}</button><button type="submit" className="button primary">{t('查看好物')}</button></div></form>;
}
function ReportForm({onReport,onBlock,apiMode=false}){
 const {t}=useLocale();
 return <form className="simple-modal" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);onReport(d.get('reason'),d.get('details'))}}><p className="muted">{t(apiMode?'举报会通过后端提交至运营审核队列；是否有人工处理取决于运营配置。':'原型中的举报仅保存在本机，不会发送给真实客服。')}</p><label className="field">{t('举报原因')}<select name="reason">{['物品描述不实','违禁或危险物品','索要金钱或外部付款','骚扰或不当内容','其他问题'].map(reason=><option key={reason} value={reason}>{t(reason)}</option>)}</select></label><label className="field">{t('补充说明')}<textarea rows={3} name="details" maxLength={500} placeholder={t('说明问题，不要填写敏感个人信息。')}/></label><button className="button primary full" type="submit"><Flag size={16}/>{t('记录举报')}</button><button className="button secondary full" type="button" onClick={()=>{if(window.confirm(t('拉黑后隐藏其物品并停止发消息，已有交换仍保留。确定拉黑？')))onBlock()}}><Ban size={16}/>{t('拉黑这位用户')}</button></form>;
}
function ReviewForm({onSubmit}){
 const {t}=useLocale();
 const [stars,setStars]=useState(5),[text,setText]=useState('');
 return <form className="simple-modal" onSubmit={e=>{e.preventDefault();onSubmit(stars,text.trim())}}><p className="muted">{t('真实的反馈，让下一次交换更安心。')}</p><div className="star-picker">{[1,2,3,4,5].map(n=><button aria-label={`${n} ${t('星')}`} aria-pressed={stars===n} key={n} type="button" onClick={()=>setStars(n)}><Star size={34} fill={n<=stars?'currentColor':'none'}/></button>)}</div><label className="field">{t('说说这次交换')} <small>{t('选填')}</small><textarea rows={4} maxLength={500} value={text} onChange={e=>setText(e.target.value)} placeholder={t('物品状态怎么样？交接顺利吗？')}/></label><button className="button primary full">{t('提交评价')}</button></form>;
}

createRoot(document.getElementById('root')).render(<LocaleProvider><AuthEntry>{(user,accessToken)=><App key={user.id} user={user} accessToken={accessToken}/>}</AuthEntry></LocaleProvider>);
