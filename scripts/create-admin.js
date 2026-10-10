const {Pool}=require('pg');
const bcrypt=require('bcryptjs');
const readline=require('node:readline');
const db=new Pool({host:process.env.DB_HOST||'db',database:process.env.DB_NAME||'christians',user:process.env.DB_USER||'christians',password:process.env.DB_PASSWORD});
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=q=>new Promise(resolve=>rl.question(q,resolve));
(async()=>{try{
 const email=(await ask('Admin email: ')).trim().toLowerCase();
 const password=await ask('Password (visible while typing; use a private terminal): ');
 if(!/^\S+@\S+\.\S+$/.test(email)||password.length<14)throw Error('Use valid email and password at least 14 characters long');
 const hash=await bcrypt.hash(password,12);
 await db.query('INSERT INTO admin_users(email,password_hash) VALUES ($1,$2) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash',[email,hash]);
 await db.query('DELETE FROM admin_sessions WHERE user_id=(SELECT id FROM admin_users WHERE email=$1)',[email]);
 console.log('Admin account configured.');
 }catch(e){console.error(e.message);process.exitCode=1;}finally{rl.close();await db.end();}})();
