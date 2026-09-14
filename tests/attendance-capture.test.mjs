import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {readFileSync} from 'node:fs';
import {attendanceAccess,automaticPunch,captureDate,groupPunches,localInstant,nearestEmployeeShift,parseEmployeeQr,parsePunchCsv,punchInstant,qrEmployee,reviewPunches} from '../lib/attendance-capture.ts';
import {mergeAppUpdate,mutationCollections} from '../lib/mutation-updates.ts';
const day={name:'General',startTime:'09:00',endTime:'18:00',breakMinutes:60,requiredWorkMinutes:480,lateGraceMinutes:10,lateDeductionMinutes:15,earlyGraceMinutes:10,earlyDeductionMinutes:15,otMode:'approval',fixedOtHours:0};
const night={...day,name:'Night',startTime:'22:00',endTime:'07:00'};
const stamp=(time)=>localInstant(`2026-09-${time}`);
const punch=(id,time,direction,shift='General')=>({id,employeeId:'EMP-TEST',clientUnitId:'UNIT-TEST',punchedAt:stamp(time),direction,source:'qr',shiftCode:shift,status:'pending'});
test('existing employee card QR decodes through the camera decoder and ignores untrusted printed names',()=>{
  const raw=JSON.stringify({employeeId:'EMP-TEST',employeeCode:'J001',name:'Untrusted label',department:'Fake'});
  const matrix=QRCode.create(raw,{errorCorrectionLevel:'H'}).modules,scale=5,border=4,size=(matrix.size+border*2)*scale,pixels=new Uint8ClampedArray(size*size*4).fill(255);
  for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++)if(matrix.get(y,x))for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const at=(((y+border)*scale+dy)*size+(x+border)*scale+dx)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}
  const decoded=jsQR(pixels,size,size);assert.equal(decoded.data,raw);
  const employee={id:'EMP-TEST',employeeCode:'J001',clientUnitId:'UNIT-TEST',status:'active',name:'Authoritative master'};
  assert.equal(qrEmployee(decoded.data,[employee],'UNIT-TEST').name,'Authoritative master');
  assert.throws(()=>qrEmployee(raw,[employee],'OTHER'));
  assert.throws(()=>qrEmployee(raw,[{...employee,status:'inactive'}],'UNIT-TEST'));
  assert.throws(()=>qrEmployee(raw,[{...employee,employeeCode:'J002'}],'UNIT-TEST'));
  assert.throws(()=>parseEmployeeQr('https://unrelated.example'));
});
test('regular shift stays fixed; rotational shift chooses nearest eligible start, including midnight',()=>{
  const shifts=[day,night,{...day,name:'Evening',startTime:'14:00',endTime:'22:00'}];
  const employee={defaultShift:'General',shiftPattern:'general',applicableShiftsJson:'["Night"]'};
  assert.equal(nearestEmployeeShift(employee,shifts,stamp('12T21:50')).name,'General');
  assert.equal(nearestEmployeeShift({...employee,shiftPattern:'rotational'},shifts,stamp('12T21:50')).name,'Night');
  assert.equal(nearestEmployeeShift({...employee,shiftPattern:'rotational'},shifts,stamp('13T00:10')).name,'Night');
  assert.equal(nearestEmployeeShift({...employee,shiftPattern:'rotational'},shifts,stamp('12T13:50')).name,'General');
  assert.throws(()=>nearestEmployeeShift({...employee,defaultShift:'Missing'},shifts,stamp('12T10:00')));
});
test('10-minute lock ignores repeated scans without advancing punch state; exact boundary becomes OUT',()=>{
  const first={punchedAt:stamp('12T09:00'),direction:'in',shiftCode:'General'};
  assert.equal(automaticPunch(null,first.punchedAt).direction,'in');
  assert.equal(automaticPunch(first,stamp('12T09:09:59')).ignored,true);
  assert.deepEqual(automaticPunch(first,stamp('12T09:10')), {ignored:false,direction:'out',lockedUntil:stamp('12T09:20')});
  assert.equal(automaticPunch({...first,direction:'out'},stamp('12T09:05')).ignored,true);
  assert.equal(automaticPunch({...first,direction:'out'},stamp('12T18:00')).direction,'in');
  assert.equal(automaticPunch(first,stamp('13T10:00')).direction,'in');
  assert.throws(()=>automaticPunch(first,stamp('12T08:59')));
});
test('completed day and overnight work use configured break and OT',()=>{
  let group=groupPunches([punch('1','12T09:00','in'),punch('2','12T20:00','out')],[day])[0];
  assert.equal(reviewPunches(group,day).workedHours,10);assert.equal(reviewPunches(group,day).suggestedOt,2);
  group=groupPunches([punch('1','12T22:00','in','Night'),punch('2','13T07:00','out','Night')],[night])[0];
  assert.equal(group.date,'2026-09-12');assert.equal(reviewPunches(group,night).workedHours,8);assert.equal(reviewPunches(group,night).overnight,true);
});
test('clocked-out break is not deducted a second time, including overnight split pairs',()=>{
  const group=groupPunches([punch('1','12T22:00','in','Night'),punch('2','13T02:00','out','Night'),punch('3','13T03:00','in','Night'),punch('4','13T07:00','out','Night')],[night])[0];
  assert.equal(group.punches.length,4);assert.equal(reviewPunches(group,night).workedHours,8);
});
test('unmatched, repeated and excessive-duration punches require review',()=>{
  for(const punches of [[punch('1','12T09:00','in')],[punch('1','12T09:00','out')],[punch('1','12T09:00','in'),punch('2','12T09:01','in'),punch('3','12T18:00','out')],[punch('1','12T09:00','in'),punch('2','13T18:00','out')]]) {
    const groups=groupPunches(punches,[day]);assert(groups.some(g=>g.issues.length));assert.throws(()=>reviewPunches(groups[0],day));
  }
});
test('late/early deductions and fixed OT respect configured required time',()=>{
  const group=groupPunches([punch('1','12T09:30','in'),punch('2','12T17:30','out')],[day])[0];
  assert.equal(reviewPunches(group,day).deductionHours,1.5);assert.equal(reviewPunches(group,{...day,otMode:'fixed',fixedOtHours:2}).suggestedOt,0);
  const full=groupPunches([punch('1','12T09:00','in'),punch('2','12T18:00','out')],[day])[0];assert.equal(reviewPunches(full,{...day,otMode:'fixed',fixedOtHours:2}).suggestedOt,2);
});
test('imports retain leading-zero terminal IDs, reject malformed values and support explicit time zones',()=>{
  const rows=parsePunchCsv('device_user_id,punched_at,event_id\n0012,2026-09-12 09:00:00,evt1\n0012,2026-09-12T18:00:00+05:30,evt2');
  assert.equal(rows[0].deviceUserId,'0012');assert.equal(rows[0].direction,'auto');assert.equal(rows[0].punchedAt,stamp('12T09:00'));
  assert.equal(parsePunchCsv('device_user_id,punched_at,direction\n0012,2026-09-12 09:00:00,0','zero-one')[0].direction,'in');
  assert.throws(()=>parsePunchCsv('device_user_id,punched_at,direction\n1,2026-09-12 09:00:00,4','zero-one'));
  assert.throws(()=>parsePunchCsv('device_user_id,punched_at\n1,2026-02-30 09:00:00'));
  assert.throws(()=>localInstant('2026-09-12 25:00:00'));
  assert.throws(()=>punchInstant('2026-09-12T09:00:00',Date.parse(stamp('13T12:00'))));
  assert.throws(()=>punchInstant(stamp('14T09:00'),Date.parse(stamp('13T12:00'))));
  assert.equal(captureDate(stamp('13T00:10')),'2026-09-13');
});
test('attendance view/manage and company/unit scope fail closed',()=>{
  const profile={role:'hr_team',status:'active',attendance:'manage',clientScope:['V1'],unitScope:['U1']};
  assert(attendanceAccess(profile,{id:'U1',vendorId:'V1'},true));assert(!attendanceAccess(profile,{id:'U2',vendorId:'V1'},true));
  assert(!attendanceAccess({...profile,attendance:'view'},{id:'U1',vendorId:'V1'},true));assert(!attendanceAccess({...profile,status:'inactive'},{id:'U1',vendorId:'V1'},false));
  assert(!attendanceAccess({...profile,role:'hostel_incharge'},{id:'U1',vendorId:'V1'},true));assert(!attendanceAccess({...profile,role:'invalid'},{id:'U1',vendorId:'V1'},false));
  assert(!attendanceAccess({...profile,role:'payroll_team'},{id:'U1',vendorId:'V2'},false));
});
test('targeted mutation responses preserve unrelated loaded data',()=>{
  const current={employees:[{id:'E1',photo:'large-photo'}],remarks:[{id:'old'}],runs:[{id:'R1'}]};
  const next=mergeAppUpdate(current,{delta:true,remarks:[{id:'new'}]});assert.equal(next.employees,current.employees);assert.equal(next.runs,current.runs);assert.deepEqual(next.remarks,[{id:'new'}]);
  assert(!mutationCollections('save-remark').includes('employees'));assert(mutationCollections('save-attendance').includes('payrollItems'));assert.equal(mutationCollections('unknown'),undefined);
});
test('deployment keeps device hashes private, scopes authenticated handlers and blocks unconfirmed payroll',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20260913230826_attendance_capture.sql',import.meta.url),'utf8');
  assert.match(sql,/interval '10 minutes'/);assert.match(sql,/for update/);assert.match(sql,/revoke all on public.attendance_devices/);
  assert.match(sql,/Approved payroll or downloaded bank payments lock attendance/);assert.match(sql,/Confirm the final system or client attendance source/);
  const service=readFileSync(new URL('../supabase/functions/_shared/capture-service.ts',import.meta.url),'utf8');
  assert.match(service,/requireCaptureAccess/);assert.match(service,/constantEqual\(await hashDeviceKey/);
  const route=readFileSync(new URL('../app/api/app-data/route.ts',import.meta.url),'utf8');
  assert.match(route,/payload.clientAttendance === true/);assert.match(route,/attendanceChoice\?\.source === "client_attendance"/);assert.match(route,/attendanceConfirmation\?\.status !== "confirmed"/);
});
