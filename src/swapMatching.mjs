const categoryTerms=Object.freeze({
 '数码电子':['数码电子','数码','相机','耳机','音箱','蓝牙','拍立得','摄影器材','手机'],
 '图书文娱':['图书文娱','图书','书籍','阅读','散文','小说','漫画','摄影集','杂志'],
 '家居生活':['家居生活','家居','咖啡器具','摩卡壶','花盆','马克杯','家居小物','厨房用品'],
 '运动户外':['运动户外','户外','露营','帐篷','骑行','自行车','徒步','运动装备'],
 '服饰配件':['服饰配件','服饰','衣物','衣服','服装','包包','鞋子','帽子','配饰'],
 '其他好物':['其他好物','其他']
});

function normalize(value){return typeof value==='string'?value.toLocaleLowerCase().replace(/[\s、，,\/|]+/g,''):''}

export function wantsCategory(wish,category){
 const text=normalize(wish);
 if(!text||!category)return false;
 const terms=categoryTerms[category]||[category];
 return terms.some(term=>text.includes(normalize(term)));
}

/** Scores only stated item/category wishes; it does not imply a guaranteed swap. */
export function getSwapMatch(listing,availableOwnListings){
 const canOffer=availableOwnListings.some(own=>wantsCategory(listing.wish,own.category));
 const canReceive=availableOwnListings.some(own=>wantsCategory(own.wish,listing.category));
 return Object.freeze({score:Number(canOffer)+Number(canReceive),canOffer,canReceive,mutual:canOffer&&canReceive});
}
