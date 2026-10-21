import {getCountries,getCountryCallingCode,parsePhoneNumberFromString} from 'libphonenumber-js/min';

const digitZeroes=[0x0660,0x06f0,0x0966,0x09e6,0x0a66,0x0ae6,0x0b66,0x0be6,0x0c66,0x0ce6,0x0d66,0x0de6,0x0e50,0x0ed0,0x0f20,0x1040,0x17e0,0x1810,0xff10];
export function normalizeDigits(value){return [...String(value)].map(char=>{const point=char.codePointAt(0);const zero=digitZeroes.find(start=>point>=start&&point<start+10);return zero?String(point-zero):char}).join('')}
export function countryOptions(locale='en'){
 const names=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames([locale],{type:'region'}):null;
 return getCountries().map(code=>({code,name:names?.of(code)||code,callingCode:getCountryCallingCode(code)})).sort((a,b)=>a.name.localeCompare(b.name,locale));
}
export function preferredCountry(language=globalThis.navigator?.language||'en-US'){
 try{const region=new Intl.Locale(language).maximize().region;return region&&getCountries().includes(region)?region:'US'}catch{return 'US'}
}
export function normalizePhone(country,value){
 const normalized=normalizeDigits(String(value||'').normalize('NFKC')).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim();
 if(!normalized||!/^\+?[0-9\s().\/-]+$/.test(normalized)||normalized.indexOf('+')>0||normalized.split('+').length>2)throw new Error('请输入有效的国际电话号码。');
 let phone;
 try{phone=parsePhoneNumberFromString(normalized,country||undefined)}catch{}
 if(!phone||!phone.isValid())throw new Error('号码无效，请检查国家／地区和电话号码。');
 return phone.number;
}
export function normalizeEmail(value){
 const email=String(value||'').trim();
 if(email.length>254)throw new Error('请输入有效的电子邮箱地址。');
 const [local,rawDomain,...extra]=email.split('@');
 const domain=rawDomain?.replace(/[\u3002\uff0e\uff61]/g,'.');
 if(extra.length||!local||local.length>64||!/^[\p{L}\p{N}!#$%&'*+\-/=?^_`{|}~.]+$/u.test(local)||local.startsWith('.')||local.endsWith('.')||local.includes('..')||!domain||!domain.includes('.')||!/^[\p{L}\p{N}.-]+$/u.test(domain)||domain.startsWith('.')||domain.endsWith('.')||domain.includes('..'))throw new Error('请输入有效的电子邮箱地址。');
 let asciiDomain;
 try{asciiDomain=new URL(`https://${domain}`).hostname.toLowerCase()}catch{throw new Error('请输入有效的电子邮箱地址。')}
 const labels=asciiDomain.split('.');
 if(!asciiDomain.includes('.')||asciiDomain.length>253||labels.some(label=>!label||label.length>63||! /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))throw new Error('请输入有效的电子邮箱地址。');
 const normalized=`${local.toLowerCase()}@${asciiDomain}`;
 if(normalized.length>254)throw new Error('请输入有效的电子邮箱地址。');
 return normalized;
}
export function validatePassword(password){
 if(password.length<12||password.length>128)throw new Error('密码需要 12–128 位，建议使用不重复的长密码。');
 return password;
}
export function authError(error){
 const code=error?.code;
 const messages={invalid_credentials:'邮箱或密码不正确。',email_not_confirmed:'请先点击邮箱中的验证链接，再登录。',otp_expired:'验证码无效或已过期，请重新获取。',over_email_send_rate_limit:'邮件发送过于频繁，请稍后重试。',over_sms_send_rate_limit:'短信发送过于频繁，请稍后重试。',over_request_rate_limit:'操作过于频繁，请稍后再试。',user_already_exists:'该账户可能已注册，请尝试登录或找回密码。',weak_password:'密码强度不足，请使用更长且不重复的密码。',signup_disabled:'当前暂未开放注册。',sms_send_failed:'短信未能发送，请稍后重试。',email_provider_disabled:'邮箱注册尚未启用，请联系管理员。',phone_provider_disabled:'短信注册尚未启用，请联系管理员。'};
 return messages[code]||'暂时无法完成操作，请检查网络或稍后重试。';
}
