import React,{lazy,Suspense,useEffect,useState} from 'react';
import {Info,LogOut,LoaderCircle,ShieldCheck} from 'lucide-react';
import {authConfigured} from './authConfig.mjs';
import {LanguagePicker,useLocale} from './LocaleContext.jsx';
import './auth.css';

const AuthForm=lazy(()=>import('./AuthForm.jsx'));

export default function AuthGate({children,startInAuth=false}){
 const {t}=useLocale();
 const [authClient,setAuthClient]=useState(null),[session,setSession]=useState(null),[loading,setLoading]=useState(authConfigured),[recovery,setRecovery]=useState(false),[failure,setFailure]=useState(''),[demoMode,setDemoMode]=useState(!authConfigured&&!startInAuth);
 useEffect(()=>{
  if(!authConfigured)return;
  let alive=true,subscription;
  import('./authClient.js').then(({authClient:client})=>{
   if(!alive)return;
   if(!client){setLoading(false);return}
   setAuthClient(client);
   const {data:{subscription:currentSubscription}}=client.auth.onAuthStateChange((event,value)=>{
    if(!alive)return;setSession(value);setLoading(false);
    if(event==='PASSWORD_RECOVERY')setRecovery(true);
    if(event==='SIGNED_OUT')setRecovery(false);
   });
   subscription=currentSubscription;
   client.auth.getSession().then(({data,error})=>{if(!alive)return;if(error)setFailure('无法恢复登录状态，请重新登录。');setSession(data?.session||null);setLoading(false)}).catch(()=>{if(alive){setLoading(false);setFailure('暂时无法连接认证服务。')}});
  }).catch(()=>{if(alive){setLoading(false);setFailure('暂时无法连接认证服务。')}});
  return ()=>{alive=false;subscription?.unsubscribe()};
 },[]);
 async function logout(){setFailure('');try{const {error}=await authClient.auth.signOut();if(error)throw error;setSession(null)}catch{setFailure('退出未成功，请检查网络后重试。')}}
 if(demoMode)return <><div className="account-bar demo-account-bar"><span><Info size={14}/>{t('本机游客体验 · 数据仅保存在当前浏览器，不会发送给其他用户。')}</span><LanguagePicker/><button onClick={()=>setDemoMode(false)}><LogOut size={13}/>{t('账户入口')}</button></div>{children({id:'local-demo'})}</>;
 if(loading)return <div className="auth-loading"><LoaderCircle className="spin"/><p>{t('正在检查登录状态…')}</p></div>;
 if(session&&!recovery)return <><div className="account-bar"><span><ShieldCheck size={14}/>{t('已登录')} · {session.user.email?session.user.email.replace(/^(.{2}).*(@.*)$/,'$1***$2'):session.user.phone?.replace(/\d(?=\d{4})/g,'*')}</span><LanguagePicker/><button onClick={logout}><LogOut size={13}/>{t('退出登录')}</button></div>{failure&&<p className="auth-global-error" role="alert">{t(failure)}</p>}{children(session.user,session.access_token)}</>;
 return <Suspense fallback={<div className="auth-loading"><LoaderCircle className="spin"/><p>{t('正在检查登录状态…')}</p></div>}><AuthForm authClient={authClient} recovery={recovery} onRecovered={()=>setRecovery(false)} onDemo={()=>setDemoMode(true)} externalError={t(failure)}/></Suspense>;
}
