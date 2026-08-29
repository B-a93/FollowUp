import pg from 'pg';
const { Pool } = pg;

type Mailer = (to: string, subject: string, text: string) => Promise<void>;

export async function processReminders(db: pg.Pool, sendMail: Mailer) {
  const users = await db.query(`
    select u.id,u.email,u.display_name,u.timezone,
      coalesce(p.email_enabled,true) email_enabled,
      coalesce(p.due_reminders,true) due_reminders,
      coalesce(p.overdue_reminders,true) overdue_reminders,
      coalesce(p.morning_digest,true) morning_digest,
      coalesce(p.morning_hour,8) morning_hour,
      coalesce(p.end_of_day_digest,true) end_of_day_digest,
      coalesce(p.end_of_day_hour,17) end_of_day_hour,
      coalesce(p.due_lead_minutes,30) due_lead_minutes
    from users u left join reminder_preferences p on p.user_id=u.id
  `);

  for (const u of users.rows) {
    if (!u.email_enabled) continue;
    const local = await db.query(
      `select to_char(now() at time zone $1,'YYYY-MM-DD') as local_date,
              extract(hour from now() at time zone $1)::int as local_hour`,
      [u.timezone]
    );
    const dateKey = String(local.rows[0].local_date);
    const hour = Number(local.rows[0].local_hour);

    if (u.morning_digest && hour === Number(u.morning_hour)) {
      const q = await db.query(`select client_label,task,due_at from follow_ups where user_id=$1 and status='upcoming' and (due_at at time zone $2)::date <= (now() at time zone $2)::date order by due_at`,[u.id,u.timezone]);
      if(q.rowCount) await deliver(db,sendMail,u.email,u.id,null,'morning_digest',`morning:${u.id}:${dateKey}`,`FollowUp: ${q.rowCount} item(s) need attention today`,q.rows.map((x:any)=>`• ${x.client_label}: ${x.task}`).join('\n'));
    }

    if (u.end_of_day_digest && hour === Number(u.end_of_day_hour)) {
      const q = await db.query(`select client_label,task from follow_ups where user_id=$1 and status='upcoming' and (due_at at time zone $2)::date <= (now() at time zone $2)::date order by due_at`,[u.id,u.timezone]);
      if(q.rowCount) await deliver(db,sendMail,u.email,u.id,null,'end_of_day_digest',`eod:${u.id}:${dateKey}`,`FollowUp: ${q.rowCount} unfinished follow-up(s)`,q.rows.map((x:any)=>`• ${x.client_label}: ${x.task}`).join('\n'));
    }

    const due = await db.query(`select id,client_label,task,due_at from follow_ups where user_id=$1 and status='upcoming' and due_at between now() and now()+($2||' minutes')::interval`,[u.id,u.due_lead_minutes]);
    if(u.due_reminders) for(const x of due.rows) await deliver(db,sendMail,u.email,u.id,x.id,'due',`due:${x.id}:${new Date(x.due_at).toISOString()}`,`FollowUp due soon: ${x.client_label}`,x.task);

    const overdue = await db.query(`select id,client_label,task,due_at from follow_ups where user_id=$1 and status='upcoming' and due_at < now() and due_at > now()-interval '24 hours'`,[u.id]);
    if(u.overdue_reminders) for(const x of overdue.rows) await deliver(db,sendMail,u.email,u.id,x.id,'overdue',`overdue:${x.id}:${dateKey}`,`FollowUp overdue: ${x.client_label}`,x.task);
  }
}

async function deliver(db:pg.Pool,sendMail:Mailer,to:string,userId:number,followUpId:number|null,type:string,key:string,subject:string,text:string){
  const claimed=await db.query(`insert into reminder_deliveries(user_id,follow_up_id,reminder_type,dedupe_key,scheduled_for) values($1,$2,$3,$4,now()) on conflict(dedupe_key) do nothing returning id`,[userId,followUpId,type,key]);
  if(!claimed.rowCount)return;
  const id=claimed.rows[0].id;
  try{await sendMail(to,subject,text);await db.query(`update reminder_deliveries set status='sent',sent_at=now() where id=$1`,[id])}
  catch(e){await db.query(`update reminder_deliveries set status='failed',error_message=$2 where id=$1`,[id,e instanceof Error?e.message:'Unknown mail error'])}
}
