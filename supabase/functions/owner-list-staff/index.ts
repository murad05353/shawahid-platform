import { createClient } from 'npm:@supabase/supabase-js@2';
const origin='https://murad05353.github.io';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply({});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!token)return reply({error:'غير مصرح'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 if(!url||!anon||!secret)return reply({error:'إعدادات الخدمة غير مكتملة'},503);
 const caller=createClient(url,anon),admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:{user},error:authError}=await caller.auth.getUser(token);
 if(authError||!user)return reply({error:'جلسة غير صالحة'},401);
 const {data:owner,error:ownerError}=await admin.from('user_roles').select('role').eq('user_id',user.id).eq('role','platform_owner').maybeSingle();
 if(ownerError||!owner)return reply({error:'هذه العملية متاحة لمالك المنصة فقط'},403);
 const [profiles,roles,usernames,orgs,schools]=await Promise.all([
  admin.from('profiles').select('user_id,org_id,school_id,full_name,active').order('created_at',{ascending:false}).limit(1000),
  admin.from('user_roles').select('user_id,role').limit(1000),
  admin.from('staff_usernames').select('user_id,username').limit(1000),
  admin.from('organizations').select('id,name').limit(1000),
  admin.from('schools').select('id,name').limit(1000)
 ]);
 const err=[profiles,roles,usernames,orgs,schools].find(x=>x.error)?.error;
 if(err)return reply({error:'تعذر قراءة بيانات الحسابات'},500);
 const roleMap=new Map((roles.data||[]).map(x=>[x.user_id,x.role]));
 const usernameMap=new Map((usernames.data||[]).map(x=>[x.user_id,x.username]));
 const orgMap=new Map((orgs.data||[]).map(x=>[x.id,x.name]));
 const schoolMap=new Map((schools.data||[]).map(x=>[x.id,x.name]));
 const accounts=(profiles.data||[]).filter(x=>roleMap.has(x.user_id)&&roleMap.get(x.user_id)!=='platform_owner').map(x=>({full_name:x.full_name,role:roleMap.get(x.user_id),username:usernameMap.get(x.user_id)||null,organization:orgMap.get(x.org_id)||null,school:x.school_id?schoolMap.get(x.school_id)||null:null,active:x.active}));
 return reply({accounts});
});