import {json,verifyTicket,adminCookie,clearAdminCookie} from '../../_shared/rules-auth.js';

export async function onRequestGet({request,env}){
  const u=new URL(request.url);
  if(u.searchParams.get('logout')==='1'){
    return new Response(null,{status:302,headers:{location:'/', 'set-cookie':clearAdminCookie(),'cache-control':'no-store'}});
  }
  const secret=String(env.WRITE_RULES_ADMIN_TOKEN||'');
  if(secret.length<32)return json({ok:false,error:'WRITE_RULES_ADMIN_TOKEN missing'},503);
  const ticket=u.searchParams.get('ticket')||'';
  if(!await verifyTicket(secret,ticket))return json({ok:false,error:'INVALID_OR_EXPIRED_TICKET'},401);
  return new Response(null,{status:302,headers:{location:'/', 'set-cookie':adminCookie(secret),'cache-control':'no-store','referrer-policy':'no-referrer'}});
}
