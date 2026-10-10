"use strict";
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const path = require('node:path');
const { rateLimit } = require('express-rate-limit');
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({limit:'32kb'}));
app.use('/assets',express.static(path.join(__dirname,'assets'),{maxAge:'7d'}));
const publicFiles=['index.html','events.html','prayer.html','wall.html','admin.html','styles.css','site.js','events.js','prayer.js','wall.js','admin.js'];
for(const file of publicFiles){
 const route=file==='index.html'?['/',`/${file}`]:`/${file}`;
 const cacheControl=file.endsWith('.html')?'no-store, max-age=0':'no-cache';
 app.get(route,(req,res)=>res.sendFile(path.join(__dirname,file),{headers:{'Cache-Control':cacheControl}}));
}
const db = new Pool({host:process.env.DB_HOST||'db',port:5432,database:process.env.DB_NAME||'christians',user:process.env.DB_USER||'christians',password:process.env.DB_PASSWORD,max:10});
const cats = (process.env.PRAYER_CATEGORIES||'Addiction,Family,Finances,Health,Marriage,Grief,Guidance,Salvation,Community,Other').split(',').map(x=>x.trim()).filter(Boolean);
const err = (res,code,message)=>res.status(code).json({error:message});
const clean = (x,max)=>(typeof x==='string'?x.trim().slice(0,max):'')||null;
const cleanUrl=(x,max=500)=>{const value=clean(x,max);if(!value)return null;try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.toString():null;}catch{return null;}};
const pagination=(q,defaultSize,max)=>({page:Math.min(Math.max(parseInt(q.page,10)||1,1),100000),pageSize:Math.min(Math.max(parseInt(q.pageSize,10)||defaultSize,10),max)});
const isUuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const limiter=(max)=>rateLimit({windowMs:15*60*1000,limit:max,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many requests. Try again later.'}});
const submitLimit=limiter(12), prayLimit=limiter(60), loginLimit=limiter(8);
function filters(q,admin){
 const w=[],values=[]; const add=(sql,value)=>{values.push(value);w.push(sql.replaceAll('?',`$${values.length}`));};
 if(!admin)w.push('public_permission = TRUE',"status <> 'archived'");
 else if(!q.status||q.status==='active')w.push("status <> 'archived'");
 else if(['new','prayed','archived'].includes(q.status))add('status = ?',q.status);
 if(!admin&&q.category&&q.category!=='all')add('category = ?',String(q.category).slice(0,100));
 if(q.priority==='urgent')w.push('urgent = TRUE');
 if(!admin&&q.priority==='not-prayed')w.push('prayed_count = 0');
 if(admin&&q.priority==='contact')w.push('wants_contact = TRUE');
 if(admin&&q.priority==='wall')w.push('public_permission = TRUE');
 if(admin&&q.priority==='private')w.push('public_permission = FALSE');
 const search=clean(q.q,200);
 if(search){values.push('%'+search.replace(/[!%_]/g,'!$&')+'%');const p='$'+values.length;
 w.push(`(${['name',...(admin?['phone']:[]),'category','prayer_request'].map(c=>`${c} ILIKE ${p} ESCAPE '!'`).join(' OR ')})`);}
 return {where:w.length?'WHERE '+w.join(' AND '):'', values};
}
async function list(req,res,admin){
 const {page,pageSize}=pagination(req.query,admin?50:30,admin?100:60);
 const {where,values}=filters(req.query,admin);const sort=req.query.sort;
 const order=sort==='oldest'?'created_at ASC, id ASC':
   sort==='urgent'&&admin?'urgent DESC, created_at DESC, id DESC':
   sort==='not-prayed'&&!admin?'prayed_count ASC, created_at DESC, id DESC':
   sort==='most-prayed'&&!admin?'prayed_count DESC, created_at DESC, id DESC':'created_at DESC, id DESC';
 const columns=admin?'*':'id,created_at,name,category,prayer_request,urgent,prayed_count';
 const count=await db.query(`SELECT count(*)::int AS total FROM prayer_requests ${where}`,values);
 const rows=await db.query(`SELECT ${columns} FROM prayer_requests ${where} ORDER BY ${order} LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,pageSize,(page-1)*pageSize]);
 const total=count.rows[0].total;
 res.json({prayers:rows.rows,page,pageSize,total,totalPages:Math.max(Math.ceil(total/pageSize),1)});
}
function tokenFrom(req){const m=/\bcr_session=([^;]+)/.exec(req.headers.cookie||'');return m?decodeURIComponent(m[1]):'';}
function tokenHash(x){return crypto.createHash('sha256').update(x).digest('hex');}
async function requireAdmin(req,res,next){try{
 const token=tokenFrom(req);
 if(!/^[a-f0-9]{64}$/.test(token))return err(res,401,'Not signed in.');
 const result=await db.query('SELECT u.email FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[tokenHash(token)]);
 if(!result.rowCount)return err(res,401,'Not signed in.'); req.admin=result.rows[0];next();
 }catch(e){next(e);}}
const cookieSecure=(process.env.COOKIE_SECURE||'true')==='true';
const cookieOpts=`Path=/api; HttpOnly; SameSite=Strict; ${cookieSecure?'Secure; ':''}`;
function checkOrigin(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const origin=req.headers.origin;
 const expected=process.env.PUBLIC_SITE_URL;
 if(origin&&expected&&origin!==new URL(expected).origin)return err(res,403,'Invalid request origin.');
 if(req.headers['sec-fetch-site']==='cross-site')return err(res,403,'Cross-site request blocked.');
 next();
}
function eventInput(body,res){
 const b=body||{},title=clean(b.title,140),summary=clean(b.summary,240),description=clean(b.description,5000),location=clean(b.location,240);
 const start=new Date(b.startAt),end=b.endAt?new Date(b.endAt):null,status=['draft','published'].includes(b.status)?b.status:'draft';
 if(!title||!description||Number.isNaN(start.getTime())){err(res,400,'Title, description, and a valid start date are required.');return null;}
 if(end&&Number.isNaN(end.getTime())){err(res,400,'End date is invalid.');return null;}
 if(end&&end<start){err(res,400,'End date must be after the start date.');return null;}
 const requestedUrl=clean(b.registrationUrl,500),registrationUrl=cleanUrl(b.registrationUrl);
 if(requestedUrl&&!registrationUrl){err(res,400,'Registration link must be a valid http or https URL.');return null;}
 return [title,summary,description,location,start.toISOString(),end?.toISOString()||null,registrationUrl,Boolean(b.featured),status];
}
app.use('/api',checkOrigin);
app.get('/api/health',async(req,res,next)=>{try{await db.query('SELECT 1');res.json({ok:true});}catch(e){next(e)}});
app.get('/api/categories',(req,res)=>res.json({categories:cats}));
app.get('/api/prayers',(req,res,next)=>list(req,res,false).catch(next));
app.post('/api/prayers',submitLimit,async(req,res,next)=>{try{
 const b=req.body||{},prayer=clean(b.prayerRequest,4000),name=clean(b.name,120),phone=clean(b.phone,40);
 if(!prayer)return err(res,400,'Prayer request is required.');
 await db.query(`INSERT INTO prayer_requests (name,phone,wants_contact,category,public_permission,prayer_request,urgent) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
 [name,phone,Boolean(b.wantsContact&&name&&phone),cats.includes(b.category)?b.category:'Other',b.publicPermission===true,prayer,b.urgent===true]);
 res.status(201).json({ok:true});
 }catch(e){next(e)}});
app.patch('/api/prayers',prayLimit,async(req,res,next)=>{try{
 const {id,action}=req.body||{};if(!isUuid(id)||action!=='prayed')return err(res,400,'Invalid request.');
 const r=await db.query(`UPDATE prayer_requests SET prayed_count=prayed_count+1 WHERE id=$1 AND public_permission=TRUE AND status<>'archived' RETURNING prayed_count`,[id]);
 if(!r.rowCount)return err(res,404,'Prayer request not found.');res.json({prayedCount:r.rows[0].prayed_count});
 }catch(e){next(e)}});
app.get('/api/events',async(req,res,next)=>{try{
 const result=await db.query(`SELECT id,title,summary,description,location,start_at,end_at,registration_url,featured
   FROM events WHERE status='published' AND COALESCE(end_at,start_at)>=now()
   ORDER BY featured DESC,start_at ASC,id ASC`);
 res.json({events:result.rows});
 }catch(e){next(e)}});
app.post('/api/admin/login',loginLimit,async(req,res,next)=>{try{
 const email=clean(req.body?.email,320)?.toLowerCase(),password=req.body?.password;
 if(!email||typeof password!=='string'||password.length>1024)return err(res,400,'Email and password required.');
 const result=await db.query('SELECT id,password_hash FROM admin_users WHERE email=$1',[email]);
 const dummy='$2a$12$C6UzMDM.H6dfI/f/IKcEeOAEooYPGMkNyU4b5S1Q1GsOT5Kjdswvu';
 const matches=await bcrypt.compare(password,result.rows[0]?.password_hash||dummy);
 if(!matches||!result.rowCount)return err(res,401,'Invalid email or password.');
 const token=crypto.randomBytes(32).toString('hex');
 await db.query('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval \'7 days\')',[tokenHash(token),result.rows[0].id]);
 res.setHeader('Set-Cookie',`cr_session=${token}; ${cookieOpts}Max-Age=604800`);res.json({ok:true});
 }catch(e){next(e)}});
app.get('/api/admin/session',requireAdmin,(req,res)=>res.json({ok:true,email:req.admin.email}));
app.post('/api/admin/logout',requireAdmin,async(req,res,next)=>{try{
 await db.query('DELETE FROM admin_sessions WHERE token_hash=$1',[tokenHash(tokenFrom(req))]);
 res.setHeader('Set-Cookie',`cr_session=; ${cookieOpts}Max-Age=0`);res.json({ok:true});
 }catch(e){next(e)}});
app.get('/api/admin/prayers',requireAdmin,(req,res,next)=>list(req,res,true).catch(next));
app.patch('/api/admin/prayers',requireAdmin,async(req,res,next)=>{try{
 const {id,status}=req.body||{};if(!isUuid(id)||!['new','prayed','archived'].includes(status))return err(res,400,'Invalid request.');
 const r=await db.query('UPDATE prayer_requests SET status=$1 WHERE id=$2',[status,id]);
 if(!r.rowCount)return err(res,404,'Prayer request not found.');res.json({ok:true});
 }catch(e){next(e)}});
app.get('/api/admin/events',requireAdmin,async(req,res,next)=>{try{
 const result=await db.query(`SELECT * FROM events ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,start_at ASC,created_at DESC`);
 res.json({events:result.rows});
 }catch(e){next(e)}});
app.post('/api/admin/events',requireAdmin,async(req,res,next)=>{try{
 const event=eventInput(req.body,res);if(!event)return;
 const r=await db.query(`INSERT INTO events (title,summary,description,location,start_at,end_at,registration_url,featured,status)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,event);
 res.status(201).json({event:r.rows[0]});
 }catch(e){next(e)}});
app.patch('/api/admin/events',requireAdmin,async(req,res,next)=>{try{
 const {id}=req.body||{};if(!isUuid(id))return err(res,400,'Invalid event.');
 const event=eventInput(req.body,res);if(!event)return;
 const r=await db.query(`UPDATE events SET title=$1,summary=$2,description=$3,location=$4,start_at=$5,end_at=$6,
   registration_url=$7,featured=$8,status=$9,updated_at=now() WHERE id=$10 RETURNING *`,[...event,id]);
 if(!r.rowCount)return err(res,404,'Event not found.');res.json({event:r.rows[0]});
 }catch(e){next(e)}});
app.delete('/api/admin/events',requireAdmin,async(req,res,next)=>{try{
 const {id}=req.body||{};if(!isUuid(id))return err(res,400,'Invalid event.');
 const r=await db.query('DELETE FROM events WHERE id=$1',[id]);
 if(!r.rowCount)return err(res,404,'Event not found.');res.json({ok:true});
 }catch(e){next(e)}});
app.use('/api',(req,res)=>err(res,404,'Not found.'));
app.use((req,res)=>res.status(404).sendFile(path.join(__dirname,'index.html')));
app.use((error,req,res,next)=>{console.error(error);err(res,500,'Internal server error.');});
const port=3000;app.listen(port,'0.0.0.0',()=>console.log(`Christians Reunite API listening on ${port}`));
