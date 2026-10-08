export const categories = ['全部好物','数码电子','图书文娱','家居生活','运动户外','服饰配件','其他好物'];
const item = (id,title,image,category,wish,owner,name,condition,distance,extra={}) => ({id,title,image:`/images/${image}.jpg`,category,wish,owner,name,condition,distance,city:'成都',area:'武侯区',description:'买来一直很爱惜，平时放在家里使用。现在想为生活腾一点空间，希望它能遇到下一位喜欢它的人。',flaws:'有正常使用痕迹，具体细节可在交接时检查。',status:'available',created:100-id,...extra});
export function initialState(){return {items:[
item(1,'富士 X100 · 把日常拍成电影','camera','数码电子','拍立得 / 降噪耳机','u1','山间有风','使用良好',1.2,{description:'银黑配色的富士 X100，日常扫街很喜欢的色调。含电池、充电器和肩带，最近拍得少，想换一副耳机。',flaws:'机身底部有轻微划痕；功能说明为演示内容，非真实商品。'}),
item(2,'Marshall Emberton 便携音箱','speaker','数码电子','咖啡器具 / 露营装备','u2','小岛同学','近新',2.4),
item(3,'周末出走计划 · 双人露营帐篷','tent','运动户外','书籍 / 家居好物','u3','野外散步','使用良好',3.6),
item(4,'比乐蒂摩卡壶，三杯份的快乐','coffee','家居生活','手冲器具 / 植物花盆','u4','一杯半咖啡','使用良好',0.8),
item(5,'Sony WH-1000XM4 降噪耳机','headphones','数码电子','相机配件 / 蓝牙音箱','u5','慢慢来','使用良好',4.1),
item(6,'KINFOLK · 慢生活阅读时光','books','图书文娱','摄影集 / 散文书籍','u6','读书的阿雨','近新',1.8),
item(7,'龟背叶手绘陶土花盆','plant','家居生活','马克杯 / 家居小物','u7','植物观察员','近新',2.1,{description:'只有花盆，不包含植物。手绘叶片图案，很适合放在窗台上。'}),
item(8,'Brompton 绿色折叠自行车','bike','运动户外','露营装备 / 摄影器材','u8','骑车去看海','使用良好',5.5),
item(101,'我的摩卡壶 · 闲置咖啡器具','coffee','家居生活','蓝牙音箱 / 书籍','me','你','使用良好',0),
item(102,'我的 KINFOLK 生活方式书籍','books','图书文娱','露营装备 / 图书','me','你','近新',0),
item(103,'我的手绘陶土花盆','plant','家居生活','家居生活 / 数码电子','me','你','近新',0)
],favorites:[],offers:[{id:'demo-incoming',from:2,to:101,direction:'incoming',status:'pending',note:'你好！想用音箱换你的摩卡壶，周末可以当面交换吗？',mineConfirmed:false,theirsConfirmed:false,created:Date.now()}],messages:[{id:'welcome',peer:'u2',name:'小岛同学',itemId:2,mine:false,text:'你好！我想用音箱换你的摩卡壶，已经发送交换申请啦。',time:'10:24'}],blocked:[],reports:[],reviews:[]};}
export function itemStatus(state,id){ const item=state.items.find(x=>x.id===id); if(!item)return 'missing'; if(item.status==='hidden')return 'hidden'; if(state.offers.some(o=>(o.from===id||o.to===id)&&o.status==='completed'))return 'exchanged'; if(state.offers.some(o=>(o.from===id||o.to===id)&&['accepted','partial','disputed'].includes(o.status)))return 'locked'; return 'available'; }
export function updateState(state,a){
 if(a.type==='favorite')return {...state,favorites:state.favorites.includes(a.id)?state.favorites.filter(x=>x!==a.id):[...state.favorites,a.id]};
 if(a.type==='publish')return {...state,items:[a.item,...state.items]};
 if(a.type==='visibility'){
  if(['locked','exchanged'].includes(itemStatus(state,a.id)))return state;
  return {...state,items:state.items.map(i=>i.id===a.id?{...i,status:i.status==='hidden'?'available':'hidden'}:i),offers:state.offers.map(o=>o.status==='pending'&&(o.to===a.id||o.from===a.id)?{...o,status:'cancelled'}:o)};
 }
 if(a.type==='offer'){
  const from=state.items.find(i=>i.id===a.from),to=state.items.find(i=>i.id===a.to);
  if(!from||!to||from.owner!=='me'||to.owner==='me'||state.blocked.includes(to.owner)||itemStatus(state,a.from)!=='available'||itemStatus(state,a.to)!=='available'||state.offers.some(o=>o.from===a.from&&o.to===a.to&&o.status==='pending'))return state;
  return {...state,offers:[{id:a.id,from:a.from,to:a.to,direction:'outgoing',status:'pending',note:a.note,mineConfirmed:false,theirsConfirmed:false,created:Date.now()},...state.offers]};
 }
 if(a.type==='transition'){
  const offer=state.offers.find(o=>o.id===a.id);if(!offer)return state;
  let change={};
  if(a.action==='accept'){
   if(offer.status!=='pending'||itemStatus(state,offer.from)!=='available'||itemStatus(state,offer.to)!=='available')return state;
   const peer=state.items.find(i=>i.id===(offer.direction==='incoming'?offer.from:offer.to));if(peer&&state.blocked.includes(peer.owner))return state;
   change={status:'accepted'};
  }else if(a.action==='reject'){if(offer.status!=='pending')return state;change={status:'rejected'};
  }else if(a.action==='cancel'){if(!['pending','accepted'].includes(offer.status))return state;change={status:'cancelled'};
  }else if(a.action==='mine'||a.action==='theirs'){
   if(!['accepted','partial'].includes(offer.status))return state;
   change={mineConfirmed:offer.mineConfirmed||a.action==='mine',theirsConfirmed:offer.theirsConfirmed||a.action==='theirs'};
   change.status=change.mineConfirmed&&change.theirsConfirmed?'completed':'partial';
  }else if(a.action==='dispute'){if(!['accepted','partial'].includes(offer.status))return state;change={status:'disputed'};}else return state;
  return {...state,offers:state.offers.map(o=>o.id===a.id?{...o,...change}:change.status==='completed'&&o.status==='pending'&&[o.from,o.to].some(id=>id===offer.from||id===offer.to)?{...o,status:'cancelled'}:o)};
 }
 if(a.type==='message')return {...state,messages:[...state.messages,a.message]};
 if(a.type==='block')return {...state,blocked:[...new Set([...state.blocked,a.peer])]};
 if(a.type==='report')return {...state,reports:[a.report,...state.reports]};
 if(a.type==='review'){
  if(!state.offers.some(o=>o.id===a.review.offerId&&o.status==='completed')||state.reviews.some(r=>r.offerId===a.review.offerId))return state;
  return {...state,reviews:[...state.reviews,a.review]};
 }
 return state;
}
