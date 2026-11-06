import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL_MIGRATION||process.env.DATABASE_URL,ssl:process.env.PG_SSL==='true'?{rejectUnauthorized:true}:undefined});
try{
  const appUser=String(process.env.POSTGRES_APP_USER||'').trim();
  const appPassword=String(process.env.POSTGRES_APP_PASSWORD||'');
  if(appUser||appPassword){
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(appUser)||appPassword.length<24)throw new Error('Set POSTGRES_APP_USER to a simple SQL role name and POSTGRES_APP_PASSWORD to at least 24 characters.');
    const role=`"${appUser}"`;const password=appPassword.replaceAll("'","''");
    const existing=await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[appUser]);
    if(existing.rowCount)await pool.query(`ALTER ROLE ${role} WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
    else await pool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
  }
  const schema=await readFile(new URL('./schema.sql',import.meta.url),'utf8');
  await pool.query(schema);
  const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  const password=String(process.env.ADMIN_PASSWORD||'');
  if(!email||password.length<14)throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 14 characters before migrating.');
  const hash=await bcrypt.hash(password,12);
  await pool.query(`INSERT INTO users(id,name,email,role,businesses,status,password_hash) VALUES('admin',$1,$2,'Super Administrator',ARRAY[]::text[],'Active',$3) ON CONFLICT(email) DO NOTHING`,[process.env.ADMIN_NAME||'Workspace Administrator',email,hash]);
  if(appUser){const role=`"${appUser}"`;const db=await pool.query('SELECT current_database() AS name');const dbName=`"${String(db.rows[0].name).replaceAll('"','""')}"`;const owner=await pool.query('SELECT current_user AS name');const ownerName=`"${String(owner.rows[0].name).replaceAll('"','""')}"`;await pool.query(`GRANT CONNECT ON DATABASE ${dbName} TO ${role}`);await pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`);await pool.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);await pool.query(`GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${role}`);await pool.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerName} IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${role}`);await pool.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerName} IN SCHEMA public GRANT USAGE,SELECT,UPDATE ON SEQUENCES TO ${role}`)}
  console.log('Database schema is current and the administrator account is provisioned.');
}catch(error){console.error(error);process.exitCode=1}finally{await pool.end()}
