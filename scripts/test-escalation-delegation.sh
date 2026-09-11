#!/bin/bash
# End-to-end test for SLA escalation and delegation.
# Users (from seed): 1 Priya (HR_ADMIN, top), 2 Arjun (MANAGER, ->1), 3 Sara (EMP ->2), 4 Dev (EMP ->2)
set -e
B=http://localhost:3000/api
P=/tmp/lms_test; rm -rf $P; mkdir -p $P
say() { echo; echo "=== $* ==="; }
login() { curl -s -c $P/$1.jar -b $P/$1.jar -X POST $B/auth/dev-login -H 'Content-Type: application/json' -d "{\"user_id\":$2}" >/dev/null; }
jq_get() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log(eval('o'+process.argv[1]))})" "$1"; }

# ---------- reset test data ----------
say "Reset: remove prior test delegations + requests"
node -e "
const db=require('./backend/database/db');
const ids=db.prepare(\"SELECT leave_request_id FROM leave_requests WHERE reason LIKE 'E2E %'\").all().map(r=>r.leave_request_id);
if(ids.length){
  const ph=ids.map(()=>'?').join(',');
  db.prepare('UPDATE leave_approvals SET escalated_from_approval_id=NULL WHERE leave_request_id IN ('+ph+')').run(...ids);
  db.prepare('DELETE FROM leave_approvals WHERE leave_request_id IN ('+ph+')').run(...ids);
  db.prepare('DELETE FROM leave_request_dates WHERE leave_request_id IN ('+ph+')').run(...ids);
  db.prepare('DELETE FROM notifications WHERE leave_request_id IN ('+ph+')').run(...ids);
  db.prepare('DELETE FROM leave_requests WHERE leave_request_id IN ('+ph+')').run(...ids);
}
db.prepare('DELETE FROM delegations').run();
db.prepare(\"DELETE FROM scheduler_executions WHERE job_name='SLA_ESCALATION'\").run();
console.log('  cleaned', ids.length, 'test requests');
"

##############################################################################
say "PART A — SLA ESCALATION"
##############################################################################
login hr 1
login arjun 2
login sara 3

say "A1: Sara submits a 2-day leave (routes to manager Arjun)"
TOMORROW=$(node -e "console.log(new Date(Date.now()+864e5).toISOString().slice(0,10))")
DAYAFTER=$(node -e "console.log(new Date(Date.now()+1728e5).toISOString().slice(0,10))")
RESP=$(curl -s -c $P/sara.jar -b $P/sara.jar -X POST $B/leave/requests -H 'Content-Type: application/json' \
  -d "{\"leave_type_id\":1,\"start_date\":\"$TOMORROW\",\"end_date\":\"$DAYAFTER\",\"reason\":\"E2E escalation\",\"action\":\"submit\"}")
echo "  $RESP"
LRID=$(echo "$RESP" | jq_get ".id")
echo "  leave_request_id=$LRID"

say "A2: Approval row BEFORE escalation"
node -e "
const db=require('./backend/database/db');
const rows=db.prepare('SELECT approval_id,approval_level,approver_id,is_current,status,reassignment_seq,escalated_from_approval_id,created_at FROM leave_approvals WHERE leave_request_id=? ORDER BY approval_id').all($LRID);
rows.forEach(r=>console.log('  ',JSON.stringify(r)));
"

say "A3: Backdate the approval + request 5 minutes so it breaches the 2-min SLA"
node -e "
const db=require('./backend/database/db');
db.prepare(\"UPDATE leave_approvals SET created_at = DATE_SUB(NOW(), INTERVAL 5 MINUTE) WHERE leave_request_id=?\").run($LRID);
console.log('  backdated');
"

say "A4: HR triggers the scheduler (Run now)"
curl -s -c $P/hr.jar -b $P/hr.jar -X POST $B/admin/configuration/run-scheduler | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('  '+d))"

say "A5: Approval rows AFTER escalation"
node -e "
const db=require('./backend/database/db');
const rows=db.prepare('SELECT approval_id,approval_level,approver_id,is_current,status,reassignment_seq,escalated_from_approval_id FROM leave_approvals WHERE leave_request_id=? ORDER BY approval_id').all($LRID);
rows.forEach(r=>console.log('  ',JSON.stringify(r)));
const orig=rows.find(r=>r.reassignment_seq===0);
const esc=rows.find(r=>r.reassignment_seq>0);
console.log();
console.log('  CHECK original approval is_current=0 :', orig && orig.is_current===0 ? 'PASS' : 'FAIL');
console.log('  CHECK new escalated approval exists  :', esc ? 'PASS ('+JSON.stringify({level:esc.approval_level,approver:esc.approver_id})+')' : 'FAIL');
console.log('  CHECK exactly one current approval   :', rows.filter(r=>r.is_current===1).length===1 ? 'PASS' : 'FAIL');
const req=db.prepare('SELECT status FROM leave_requests WHERE leave_request_id=?').get($LRID);
console.log('  CHECK request still PENDING_MANAGER  :', req.status==='PENDING_MANAGER' ? 'PASS' : 'FAIL ('+req.status+')');
"

say "A6: Who sees it in their approvals queue now?"
echo -n "  Arjun (original approver): "; curl -s -c $P/arjun.jar -b $P/arjun.jar $B/manager/approvals | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log((o.pending||[]).filter(p=>p.leave_request_id==$LRID).length,'items')})"
echo -n "  Priya (escalation target): "; curl -s -c $P/hr.jar -b $P/hr.jar $B/manager/approvals | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log((o.pending||[]).filter(p=>p.leave_request_id==$LRID).length,'items')})"

say "A7: Re-run scheduler immediately — must be idempotent (no double escalation)"
curl -s -c $P/hr.jar -b $P/hr.jar -X POST $B/admin/configuration/run-scheduler | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('  '+d))"
node -e "
const db=require('./backend/database/db');
const n=db.prepare('SELECT COUNT(*) c FROM leave_approvals WHERE leave_request_id=?').get($LRID).c;
console.log('  approval rows total:',n,'(expect 2 — original + one escalation)');
"

##############################################################################
say "PART B — DELEGATION"
##############################################################################
login hr 1
login arjun 2
login dev 4

say "B1: Arjun delegates his approval queue to Priya (peer/supervisor), effective today"
TODAY=$(node -e "console.log(new Date().toISOString().slice(0,10))")
curl -s -c $P/arjun.jar -b $P/arjun.jar -X POST $B/manager/delegations -H 'Content-Type: application/json' \
  -d "{\"delegate_id\":1,\"effective_from\":\"$TODAY\",\"effective_to\":null}" | node -e "let d='';process.stdin.on('data',c=>c&&(d+=c)).on('end',()=>console.log('  '+d))"

say "B2: Confirm delegation is stored + active"
node -e "
const db=require('./backend/database/db');
const rows=db.prepare('SELECT * FROM delegations').all();
rows.forEach(r=>console.log('  ',JSON.stringify(r)));
"

say "B3: Dev submits a leave — should route to DELEGATE (Priya=1), not Arjun=2"
D1=$(node -e "console.log(new Date(Date.now()+3*864e5).toISOString().slice(0,10))")
D2=$(node -e "console.log(new Date(Date.now()+4*864e5).toISOString().slice(0,10))")
RESP=$(curl -s -c $P/dev.jar -b $P/dev.jar -X POST $B/leave/requests -H 'Content-Type: application/json' \
  -d "{\"leave_type_id\":1,\"start_date\":\"$D1\",\"end_date\":\"$D2\",\"reason\":\"E2E delegation\",\"action\":\"submit\"}")
echo "  $RESP"
LRID2=$(echo "$RESP" | jq_get ".id")

say "B4: Check the approval row's approver_id"
node -e "
const db=require('./backend/database/db');
const r=db.prepare('SELECT approval_id,approval_level,approver_id,is_current,status FROM leave_approvals WHERE leave_request_id=? ORDER BY approval_id').get($LRID2);
console.log('  ',JSON.stringify(r));
console.log('  CHECK routed to delegate (approver_id=1):', r.approver_id===1 ? 'PASS' : 'FAIL (got '+r.approver_id+')');
"

say "B5: Priya (delegate) sees it in her approvals queue"
curl -s -c $P/hr.jar -b $P/hr.jar $B/manager/approvals | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);const hit=(o.pending||[]).filter(p=>p.leave_request_id==$LRID2);console.log('  Priya queue has request:',hit.length?'PASS':'FAIL')})"

say "B6: Priya approves as delegate"
APPID=$(node -e "const db=require('./backend/database/db');console.log(db.prepare('SELECT approval_id FROM leave_approvals WHERE leave_request_id=? AND is_current=1').get($LRID2).approval_id)")
curl -s -c $P/hr.jar -b $P/hr.jar -X POST $B/manager/approvals/$LRID2/decide -H 'Content-Type: application/json' \
  -d "{\"approvalId\":$APPID,\"decision\":\"approve\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('  '+d))"
node -e "
const db=require('./backend/database/db');
const r=db.prepare('SELECT status FROM leave_requests WHERE leave_request_id=?').get($LRID2);
console.log('  CHECK request APPROVED by delegate:', r.status==='APPROVED' ? 'PASS' : 'FAIL ('+r.status+')');
"

say "B7: Revoke delegation — new request must route back to Arjun=2"
DELID=$(node -e "const db=require('./backend/database/db');console.log(db.prepare('SELECT delegation_id FROM delegations LIMIT 1').get().delegation_id)")
curl -s -c $P/arjun.jar -b $P/arjun.jar -X DELETE $B/manager/delegations/$DELID >/dev/null
D3=$(node -e "console.log(new Date(Date.now()+6*864e5).toISOString().slice(0,10))")
D4=$(node -e "console.log(new Date(Date.now()+7*864e5).toISOString().slice(0,10))")
RESP=$(curl -s -c $P/dev.jar -b $P/dev.jar -X POST $B/leave/requests -H 'Content-Type: application/json' \
  -d "{\"leave_type_id\":1,\"start_date\":\"$D3\",\"end_date\":\"$D4\",\"reason\":\"E2E delegation revoked\",\"action\":\"submit\"}")
LRID3=$(echo "$RESP" | jq_get ".id")
node -e "
const db=require('./backend/database/db');
const r=db.prepare('SELECT approver_id FROM leave_approvals WHERE leave_request_id=? AND is_current=1').get($LRID3);
console.log('  CHECK routed back to manager (approver_id=2):', r.approver_id===2 ? 'PASS' : 'FAIL (got '+r.approver_id+')');
"

echo; echo "=== DONE ==="
