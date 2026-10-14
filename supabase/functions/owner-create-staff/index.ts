import { createClient } from 'npm:@supabase/supabase-js@2';
const origin='https://murad05353.github.io';
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}})}
const allowed=new Set(['executive_director','principal','academic_vp','student_vp','school_vp','student_counselor','activity_leader','teacher']);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply({});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(!token)return reply({error:'غير مصرح'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const caller=createClient(url,anon),admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:{user},error:authError}=await caller.auth.getUser(token);
 if(authError||!user)return reply({error:'جلسة غير صالحة'},401);
 const {data:owner,error:ownerError}=await admin.from('user_roles').select('role').eq('user_id',user.id).eq('role','platform_owner').maybeSingle();
 if(ownerError||!owner)return reply({error:'مالك المنصة فقط'},403);
 let p:any;try{p=await req.json()}catch{return reply({error:'طلب غير صالح'},400)}
 const {username,password,full_name,org_id,school_id,role}=p||{};
 if(typeof username!=='string'||!/^\d{10}$/.test(username)||typeof password!=='string'||password.length<8||typeof full_name!=='string'||full_name.trim().length<3||typeof org_id!=='string'||typeof school_id!=='string'||!allowed.has(role))return reply({error:'تحقق من الحقول'},400);
 const {data:school,error:schoolError}=await admin.from('schools').select('id').eq('id',school_id).eq('org_id',org_id).maybeSingle();
 if(schoolError||!school)return reply({error:'المدرسة لا تتبع الجهة'},400);
 // Internal auth identifier only; never shown to staff or accepted as a user-entered email.
 const internalId='staff-'+username+'@accounts.invalid';
 const {data:created,error:createError}=await admin.auth.admin.createUser({email:internalId,password,email_confirm:true,user_metadata:{staff_username:username,must_change_password:true}});
 if(createError)return reply({error:'تعذر إنشاء الحساب أو اسم المستخدم مستخدم'},409);
 const id=created.user.id;
 const {error:profileError}=await admin.from('profiles').insert({user_id:id,org_id,school_id,full_name:full_name.trim(),active:true});
 const {error:roleError}=profileError?{error:null}:await admin.from('user_roles').insert({user_id:id,role});
 if(profileError||roleError){await admin.auth.admin.deleteUser(id);return reply({error:'تعذر إسناد الصلاحية'},500)}
 return reply({ok:true,username,user_id:id});
});