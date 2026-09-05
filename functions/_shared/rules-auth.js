const COOKIE='write_rules_admin';
const enc=new TextEncoder();

const b64url=(bytes)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hmac(secret,message){
  const key=await crypto.subtle.importKey('raw',enc.encode(String(secret||'')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(message))));
}
function safeEqual(a,b){
  a=String(a||'');b=String(b||'');
  if(a.length!==b.length)return false;
  let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;
}
function cookieValue(request,name){
  const raw=request.headers.get('cookie')||'';
  for(const part of raw.split(';')){
    const i=part.indexOf('=');if(i<0)continue;
    if(part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim());
  }
  return '';
}
function bearer(request){
  const h=request.headers.get('authorization')||'';
  const m=/^Bearer\s+(.+)$/i.exec(h.trim());return m?m[1].trim():'';
}
function sameOrigin(request){
  const o=request.headers.get('origin');if(!o)return true;
  try{return new URL(o).origin===new URL(request.url).origin}catch{return false}
}
export function json(body,status=200,extra={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
}
export function adminAuthorized(request,env){
  const secret=String(env.WRITE_RULES_ADMIN_TOKEN||'');
  if(secret.length<32)return false;
  if(!sameOrigin(request))return false;
  return safeEqual(bearer(request),secret)||safeEqual(cookieValue(request,COOKIE),secret);
}
export function requireAdmin(request,env){
  if(!String(env.WRITE_RULES_ADMIN_TOKEN||''))return json({ok:false,error:'WRITE_RULES_ADMIN_TOKEN missing'},503);
  return adminAuthorized(request,env)?null:json({ok:false,error:'UNAUTHORIZED'},401);
}
export function validateBodySize(request,max=1024*1024){
  const n=Number(request.headers.get('content-length')||0);
  return !Number.isFinite(n)||n<=0||n<=max;
}
export async function makeTicket(secret,exp,nonce){
  const msg=`${Number(exp)}.${String(nonce)}`;
  return `${msg}.${await hmac(secret,msg)}`;
}
export async function verifyTicket(secret,ticket,nowSec=Math.floor(Date.now()/1000)){
  const m=/^(\d+)\.([A-Za-z0-9_-]{8,128})\.([A-Za-z0-9_-]{20,})$/.exec(String(ticket||''));
  if(!m)return false;
  const exp=Number(m[1]);if(!Number.isFinite(exp)||exp<nowSec||exp>nowSec+600)return false;
  const msg=`${m[1]}.${m[2]}`;return safeEqual(m[3],await hmac(secret,msg));
}
export function adminCookie(secret,maxAge=2592000){
  return `${COOKIE}=${encodeURIComponent(String(secret))}; Path=/api/rules; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
export function clearAdminCookie(){return `${COOKIE}=; Path=/api/rules; HttpOnly; Secure; SameSite=Strict; Max-Age=0`}
