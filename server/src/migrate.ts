import 'dotenv/config';import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import pg from'pg';
const{Pool}=pg;if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const db=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
async function run(){const runtimeDir=path.dirname(fileURLToPath(import.meta.url));const dir=path.join(runtimeDir,'sql');const files=(await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort();for(const file of files){const sql=await fs.readFile(path.join(dir,file),'utf8');console.log('Applying',file);await db.query(sql)}await db.end();console.log('Migrations complete')}
run().catch(async e=>{console.error(e);await db.end();process.exit(1)});
