import { createClient } from 'npm:@supabase/supabase-js@2';
const origin='https://murad05353.github.io';
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}})}
const allowed=new Set(['executive_director','principal','academic_vp','student_vp','school_vp','student_counselor','activity_leader','teacher']);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply({});
 if(req.method!=='POST'&&req.method!=='GET')return reply({error:'Method not allowed'},405);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(!token)return reply({error:'غير مصرح'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const caller=createClient(url,anon),admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:{user},error:authError}=await caller.auth.getUser(token);
 if(authError||!user)return reply({error:'جلسة غير صالحة'},401);
 const {data:owner,error:ownerError}=await admin.from('user_roles').select('role').eq('user_id',user.id).eq('role','platform_owner').maybeSingle();
 if(ownerError||!owner)return reply({error:'مالك المنصة فقط'},403);
 if(req.method==='GET'){
  const [pRes,rRes,uRes,oRes,sRes]=await Promise.all([
   admin.from('profiles').select('user_id,full_name,org_id,school_id,active').order('created_at',{ascending:false}).limit(1000),
   admin.from('user_roles').select('user_id,role').limit(1000),
   admin.from('staff_usernames').select('user_id,username').limit(1000),
   admin.from('organizations').select('id,name').limit(1000),
   admin.from('schools').select('id,name').limit(1000)
  ]);
  if([pRes,rRes,uRes,oRes,sRes].some(x=>x.error))return reply({error:'تعذر تحميل حسابات المسؤولين'},500);
  const roles=new Map((rRes.data||[]).filter(x=>x.role!=='platform_owner').map(x=>[x.user_id,x.role]));
  const names=new Map((uRes.data||[]).map(x=>[x.user_id,x.username]));
  const orgs=new Map((oRes.data||[]).map(x=>[x.id,x.name]));
  const schools=new Map((sRes.data||[]).map(x=>[x.id,x.name]));
  const users=(pRes.data||[]).filter(x=>roles.has(x.user_id)).map(x=>({full_name:x.full_name,username:names.get(x.user_id)||null,role:roles.get(x.user_id),org_name:orgs.get(x.org_id)||'',school_name:x.school_id?schools.get(x.school_id)||'':'جميع مدارس الجهة',active:x.active}));
  return reply({ok:true,users});
 }
 let p:any;try{p=await req.json()}catch{return reply({error:'طلب غير صالح'},400)}
 const {username,password,full_name,org_id,school_id,role}=p||{};
 if(typeof username!=='string'||!/^\d{10}$/.test(username)||typeof password!=='string'||password.length<8||typeof full_name!=='string'||full_name.trim().length<3||typeof org_id!=='string'||(role!=='executive_director'&&typeof school_id!=='string')||!allowed.has(role))return reply({error:'تحقق من الحقول'},400);
 if(role!=='executive_director'){
 const {data:school,error:schoolError}=await admin.from('schools').select('id').eq('id',school_id).eq('org_id',org_id).maybeSingle();
 if(schoolError||!school)return reply({error:'المدرسة لا تتبع الجهة'},400);
 }else{const {data:org,error:orgError}=await admin.from('organizations').select('id').eq('id',org_id).maybeSingle();if(orgError||!org)return reply({error:'الجهة التنظيمية غير موجودة'},400)}
 // Internal auth identifier only; never shown to staff or accepted as a user-entered email.
 const internalId='staff-'+username+'@accounts.invalid';
 const {data:created,error:createError}=await admin.auth.admin.createUser({email:internalId,password,email_confirm:true,user_metadata:{must_change_password:true}});
 if(createError||!created?.user)return reply({error:'تعذر إنشاء الحساب أو اسم المستخدم مستخدم'},409);
 const id=created.user.id;
 const rollback=async()=>{
  await admin.from('staff_usernames').delete().eq('user_id',id);
  await admin.from('user_roles').delete().eq('user_id',id);
  await admin.from('profiles').delete().eq('user_id',id);
  await admin.auth.admin.deleteUser(id);
 };
 const {error:profileError}=await admin.from('profiles').insert({user_id:id,org_id,school_id:role==='executive_director'?null:school_id,full_name:full_name.trim(),active:true});
 if(profileError){await rollback();return reply({error:'تعذر إنشاء الملف الشخصي'},500)}
 const {error:roleError}=await admin.from('user_roles').insert({user_id:id,role});
 if(roleError){await rollback();return reply({error:'تعذر إسناد الصلاحية'},500)}
 const {error:unameError}=await admin.from('staff_usernames').insert({username,user_id:id});
 if(unameError){await rollback();return reply({error:'تعذر ربط اسم المستخدم'},500)}
 const {error:auditError}=await admin.from('audit_log').insert({actor_id:user.id,org_id,entity_type:'staff_account',entity_id:id,action:'create_staff_account',details:{role,school_id}});
 if(auditError){await rollback();return reply({error:'تعذر تسجيل العملية'},500)}
 return reply({ok:true,username,user_id:id});
});
