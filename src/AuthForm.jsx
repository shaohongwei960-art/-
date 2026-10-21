import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeftRight,ArrowRight,Mail,Smartphone,LockKeyhole,ShieldCheck,Eye,EyeOff,LoaderCircle,Info} from 'lucide-react';
import {authConfigured,authRedirect} from './authConfig.mjs';
import {normalizePhone,normalizeEmail,validatePassword,authError,countryOptions,preferredCountry,normalizeDigits} from './auth.mjs';
import {LanguagePicker,useLocale} from './LocaleContext.jsx';
import {deployment} from './deployment.mjs';
import {assetUrl} from './assets.mjs';
export default function AuthForm({authClient,recovery, onRecovered, onDemo, externalError}){
 const {locale,t}=useLocale();
 const countryList=useMemo(()=>countryOptions(locale),[locale]);
 const [mode,setMode]=useState('register'),[method,setMethod]=useState('phone'),[country,setCountry]=useState(()=>deployment.defaultPhoneCountry||preferredCountry()),[identity,setIdentity]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[code,setCode]=useState(''),[sentTo,setSentTo]=useState(''),[agreed,setAgreed]=useState(false),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[cooldown,setCooldown]=useState(0),[policy,setPolicy]=useState('');
 useEffect(()=>{if(cooldown<=0)return;const t=setTimeout(()=>setCooldown(n=>n-1),1000);return ()=>clearTimeout(t)},[cooldown]);
 function reset(nextMethod=method,nextMode=mode){setMethod(nextMethod);setMode(nextMode);setIdentity('');setPassword('');setConfirm('');setCode('');setSentTo('');setError('');setNotice('');setAgreed(false)}
 const needsConsent=mode==='register'&&!recovery;
 function ready(){setError('');setNotice('');if(!authClient)throw new Error('认证服务尚未配置，暂时不能注册、发送验证码或登录。');if(needsConsent&&!agreed)throw new Error('请先阅读并同意账户说明与隐私说明。')}
 async function run(work){if(busy)return;setBusy(true);setError('');setNotice('');try{await work()}catch(e){setError(t(e.local?e.message:authError(e)))}finally{setBusy(false)}}
 function local(fn){try{return fn()}catch(e){e.local=true;throw e}}
 async function sendPhone(){await run(async()=>{local(ready);const phone=local(()=>normalizePhone(country,identity));const {error}=await authClient.auth.signInWithOtp({phone,options:{shouldCreateUser:mode==='register'}});if(error)throw error;setSentTo(phone);setCode('');setCooldown(60);setNotice('如该号码符合条件，你将收到短信验证码。请勿向任何人透露验证码。')})}
 async function submit(e){e.preventDefault();await run(async()=>{
  local(ready);
  if(recovery){local(()=>validatePassword(password));if(password!==confirm)throw {local:true,message:'两次输入的密码不一致。'};const {error}=await authClient.auth.updateUser({password});if(error)throw error;setPassword('');setConfirm('');onRecovered();return}
  if(method==='phone'){
   if(!sentTo)throw {local:true,message:'请先获取短信验证码。'};
   if(!/^\d{6}$/.test(code))throw {local:true,message:'请输入 6 位短信验证码。'};
   const {error}=await authClient.auth.verifyOtp({phone:sentTo,token:code,type:'sms'});if(error)throw error;
  }else{
   const email=local(()=>normalizeEmail(identity));
   if(mode==='forgot'){const {error}=await authClient.auth.resetPasswordForEmail(email,{redirectTo:authRedirect()});if(error)throw error;setCooldown(60);setNotice('如果该邮箱已注册，你将收到重置密码邮件。请在当前浏览器打开链接。');return}
   if(mode==='register'){
    local(()=>validatePassword(password));if(password!==confirm)throw {local:true,message:'两次输入的密码不一致。'};
    const {error}=await authClient.auth.signUp({email,password,options:{emailRedirectTo:authRedirect()}});if(error)throw error;
    setPassword('');setConfirm('');setCooldown(60);setNotice('如果该邮箱可以注册，你将收到验证邮件。请在当前浏览器打开验证链接；已注册用户可直接登录。');
   }else{const {error}=await authClient.auth.signInWithPassword({email,password});if(error)throw error;}
  }
 })}
 return <main className="auth-page"><section className="auth-story"><a className="auth-brand" href={assetUrl('')}><span><ArrowLeftRight size={27}/></span>换换<small>HUANHUAN</small></a><div className="auth-story-text"><span className="section-kicker">SOMETHING OLD. SOMEONE NEW.</span><h1>{t('每一件闲置，')}<br/>{t('都值得一次')}<br/><em>{t('新的相遇。')}</em></h1><p>{t('从一个账号开始，')}<br/>{t('让你的喜欢与另一个人相遇。')}</p></div><img src={assetUrl('images/hero.jpg')} alt={t('相机、书籍与陶杯，一起等待新的主人')}/><div className="auth-story-foot"><LeafMark/>{t('以物换物 · 双方自愿 · 让好物循环')}</div></section><section className="auth-panel"><div className="auth-card"><div className="auth-topline"><span>{t('欢迎来到换换')}</span><LanguagePicker/></div><h2>{t(recovery?'设置新密码':mode==='register'?'注册，遇见新的喜欢。':mode==='forgot'?'找回你的账号。':'好久不见，欢迎回来。')}</h2><p className="auth-subtitle">{t(recovery?'验证通过后，请为账号设置新的安全密码。':mode==='register'?'选择手机号或邮箱注册，无需同时提供。':mode==='forgot'?'输入注册邮箱，我们会发送重置链接。':'登录后继续探索属于你的交换故事。')}</p>
 {!authConfigured&&<div className="auth-setup"><Info size={17}/><span><strong>{t('注册服务待开通')}</strong>{t('界面已就绪。管理员配置认证服务及短信／邮件发送后，才能真实注册。不会使用模拟验证码。')}</span></div>}
 {!recovery&&mode!=='forgot'&&<div className="auth-methods"><button type="button" disabled={busy} className={method==='phone'?'active':''} onClick={()=>reset('phone')}><Smartphone size={17}/>{t(mode==='register'?'手机号注册':'手机号登录')}</button><button type="button" disabled={busy} className={method==='email'?'active':''} onClick={()=>reset('email')}><Mail size={17}/>{t(mode==='register'?'邮箱注册':'邮箱登录')}</button></div>}
 <form onSubmit={submit}>
 {!recovery&&<label className="auth-field">{t(method==='phone'?'手机号码':'电子邮箱')}<div className="auth-input">{method==='phone'?<select aria-label={t('国家/地区区号')} value={country} disabled={busy||!!sentTo} onChange={e=>setCountry(e.target.value)}><option value="" disabled>{t('请选择国家或地区')}</option>{countryList.map(item=><option key={item.code} value={item.code}>{item.name} (+{item.callingCode})</option>)}</select>:<Mail size={17}/>}<input aria-label={t(method==='phone'?'手机号码':'电子邮箱')} type={method==='phone'?'tel':'text'} inputMode={method==='phone'?'tel':'email'} autoComplete={method==='phone'?'tel':'email'} placeholder={method==='phone'?t('输入电话号码'):'name@example.com'} value={identity} disabled={busy||!!sentTo} onChange={e=>setIdentity(e.target.value)} required maxLength={254}/></div></label>}
 {!recovery&&method==='phone'&&<><label className="auth-field">{t('短信验证码')}<div className="auth-input"><ShieldCheck size={17}/><input aria-label={t('短信验证码')} inputMode="numeric" autoComplete="one-time-code" placeholder={t('6 位验证码')} maxLength={6} value={code} onChange={e=>setCode(normalizeDigits(e.target.value).replace(/\D/g,''))}/><button type="button" disabled={!authConfigured||busy||cooldown>0||!identity.trim()||needsConsent&&!agreed} onClick={sendPhone}>{cooldown>0?`${cooldown}s`:sentTo?t('重新发送'):t('获取验证码')}</button></div></label>{sentTo&&<button className="auth-change" disabled={busy} type="button" onClick={()=>{setSentTo('');setCode('');setNotice('')}}>{t('修改手机号')}</button>}</>}
 {(recovery||method==='email'&&mode!=='forgot')&&<><label className="auth-field">{t(recovery?'新密码':'密码')}<div className="auth-input"><LockKeyhole size={17}/><input aria-label={t(recovery?'新密码':'密码')} type={visible?'text':'password'} required autoComplete={mode==='login'&&!recovery?'current-password':'new-password'} placeholder={t(mode==='login'&&!recovery?'请输入密码':'12–128 位，建议使用长密码')} value={password} onChange={e=>setPassword(e.target.value)} maxLength={128}/><button type="button" aria-label={t(visible?'隐藏密码':'显示密码')} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{(recovery||mode==='register')&&<label className="auth-field">{t('确认密码')}<div className="auth-input"><LockKeyhole size={17}/><input aria-label={t('确认密码')} type={visible?'text':'password'} autoComplete="new-password" required placeholder={t('再次输入密码')} value={confirm} onChange={e=>setConfirm(e.target.value)} maxLength={128}/></div></label>}</>}
 {needsConsent&&<div className="auth-consent"><input id="auth-consent" type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><div><label htmlFor="auth-consent">{t('我已阅读并同意')}</label><button type="button" onClick={()=>setPolicy(policy==='terms'?'':'terms')}>{t('账户说明')}</button>{t('和')}<button type="button" onClick={()=>setPolicy(policy==='privacy'?'':'privacy')}>{t('隐私说明')}</button></div></div>}
 {policy&&<aside className="auth-policy"><strong>{t(policy==='terms'?'账户说明 · 开发测试版':'隐私说明 · 开发测试版')}</strong><p>{t(policy==='terms'?'仅面向成年人进行开发测试。请使用你有权使用的手机号或邮箱，不冒用他人身份。注册不等于平台保证履约。当前交换、聊天与举报仍为本机体验，没有真实交易或人工客服。正式运营协议将在上线前另行公布。':'注册资料会发送至配置的 Supabase 认证服务，用于验证码、身份验证和账号管理。应用不自行存储密码、短信验证码；登录会话由认证 SDK 保存在当前浏览器。交换记录仍保存在本机，不是云同步。当前不提供自助删除账户，测试账户删除需由项目管理员在认证后台处理。正式上线前需公布运营主体、联系方法、保存期限与适用隐私政策。')}</p><button type="button" onClick={()=>setPolicy('')}>{t('收起说明')}</button></aside>}
 {(error||externalError)&&<p className="auth-error" role="alert">{error||externalError}</p>}{notice&&<p className="auth-success" role="status">{t(notice)}</p>}
 <button className="button primary auth-submit" disabled={!authConfigured||busy||needsConsent&&!agreed||method==='phone'&&!sentTo&&!recovery||cooldown>0&&(mode==='forgot'||method==='email'&&mode==='register')} type="submit">{busy?<LoaderCircle className="spin" size={18}/>:null}{t(recovery?'保存新密码':mode==='forgot'?'发送重置邮件':mode==='register'?'创建账号':'登录换换')}{!busy&&<ArrowRight size={17}/>}</button>
 {!recovery&&mode==='login'&&method==='email'&&<button className="auth-forgot" type="button" onClick={()=>reset('email','forgot')}>{t('忘记密码？')}</button>}
 </form>
 {!recovery&&<div className="auth-switch">{t(mode==='register'?'已经有账号了？':mode==='login'?'还没有账号？':'想起密码了？')}<button disabled={busy} onClick={()=>reset(method,mode==='register'||mode==='forgot'?'login':'register')}>{t(mode==='register'||mode==='forgot'?'去登录':'免费注册')}<ArrowRight size={13}/></button></div>}
 {!recovery&&<button className="auth-demo-link" type="button" onClick={onDemo}>{t('暂不注册，先体验本机演示版')}<ArrowRight size={14}/></button>}
 <div className="auth-safe"><ShieldCheck size={16}/><span>{t('不公开联系方式，不索要付款验证码。')}</span></div><p className="auth-limit">{t('账户认证与交换服务分开建设。当前物品、消息和交换记录仍仅保存在本机，不会发送给其他用户。')}</p></div><span className="auth-bottom">{t('少一点闲置，多一点可能。')}</span></section></main>
}
function LeafMark(){return <ShieldCheck size={14}/>}
