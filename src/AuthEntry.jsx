import React,{lazy,Suspense,useState} from 'react';
import {Info,LogOut} from 'lucide-react';
import {authConfigured} from './authConfig.mjs';
import {LanguagePicker,useLocale} from './LocaleContext.jsx';
import './auth-entry.css';

const AuthGate=lazy(()=>import('./AuthGate.jsx'));

export default function AuthEntry({children}){
 const [opened,setOpened]=useState(authConfigured);
 const {t}=useLocale();

 if(opened)return <Suspense fallback={<div className="entry-loading" role="status"><span className="entry-spinner"/><p>{t('正在检查登录状态…')}</p></div>}><AuthGate startInAuth={!authConfigured}>{children}</AuthGate></Suspense>;

 return <>
  <div className="account-bar demo-account-bar">
   <span><Info size={14}/>{t('本机游客体验 · 数据仅保存在当前浏览器，不会发送给其他用户。')}</span>
   <LanguagePicker/>
   <button onClick={()=>setOpened(true)}><LogOut size={13}/>{t('账户入口')}</button>
  </div>
  {children({id:'local-demo'})}
 </>;
}
