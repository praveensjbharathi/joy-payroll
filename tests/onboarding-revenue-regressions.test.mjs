import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applicableFields } from '../lib/employee-application.ts';
import { validatedDocuments, validatedFields } from '../supabase/functions/employee-onboarding/validation.ts';
import { calculateRevenue } from '../lib/revenue-calculator.ts';
import { referenceReport } from '../lib/referral-reports.ts';
import { EmployeeApplicationDocument } from '../app/employee-application.tsx';
import { ApplicationQuestionnaire } from '../app/application-questionnaire.tsx';

test('fresher, unmarried and school-only applications discard hidden answers and print no empty sections', () => {
  const fields = {'Employment status':'Fresher','Marital status':'Unmarried','Highest qualification':'10th / SSLC','Employment 1 - Company Name':'OLD JOB','Spouse - Name':'OLD SPOUSE','Child 1 - Name':'OLD CHILD','Sibling count':'0','Sibling 1 - Name':'OLD SIBLING','Graduation / Diploma Details':'OLD COLLEGE', Religion:'REMOVE', Caste:'REMOVE', Category:'REMOVE','Other Languages Proficiency [Japanese]':'Read, Speak'};
  const cleaned = applicableFields(fields);
  for(const key of ['Employment 1 - Company Name','Spouse - Name','Child 1 - Name','Sibling 1 - Name','Graduation / Diploma Details','Religion','Caste','Category']) assert.ok(!(key in cleaned),key);
  const employee = {name:'Test applicant', employeeCode:'QA-1', dateOfJoining:'2026-09-01', applicationJson:JSON.stringify(fields)};
  const print = renderToStaticMarkup(React.createElement(EmployeeApplicationDocument,{employee}));
  for(const text of ['Previous employment','Family - Spouse','Family - Child','Family - Sibling','Graduation / Diploma','OLD JOB','OLD SPOUSE','OLD CHILD','OLD SIBLING','OLD COLLEGE','REMOVE']) assert.ok(!print.includes(text),text);
  assert.ok(print.includes('Japanese')); assert.ok(print.includes('Read, Speak'));
  const form = renderToStaticMarkup(React.createElement(ApplicationQuestionnaire,{value:cleaned,onChange(){},references:[],required:true}));
  for(const text of ['Religion','Caste','Category','Previous employment','Family - Spouse','Family - Child','Family - Sibling','Graduation / Diploma']) assert.ok(!form.includes(text),text);
  assert.ok(form.includes('Japanese Read'));assert.ok(form.includes('Reference 1 — direct employee'));
});
test('documents reject duplicate categories, wrong signatures, excessive size and executable types', () => {
  const doc = {category:'Bank Proofs',filename:'bank.pdf',dataUrl:'data:application/pdf;base64,'+btoa('%PDF-1.7\n%%EOF')};
  assert.deepEqual(validatedDocuments([doc]),[doc]);
  for (const docs of [[doc,doc],[{...doc,category:'Unknown'}],[{...doc,dataUrl:'data:image/png;base64,YQ=='}],[{...doc,dataUrl:'data:text/html;base64,YQ=='}],[{...doc,dataUrl:'data:application/pdf;base64,'+btoa('%PDF-'+ 'a'.repeat(4*1024*1024))}]]) assert.throws(()=>validatedDocuments(docs));
});
test('required direct reference and canonical language values cannot be bypassed',()=>{
  const fields = {'Full name':'Test','Mobile number':'9999999999','Date of birth':'2000-01-01',Gender:'Male','Highest qualification':'10th / SSLC','Marital status':'Unmarried','Employment status':'Fresher','Reference 1 - Employee ID':'ref',Declaration:'Correct','Digital Signature (Type your full name)':'Test'};
  assert.throws(()=>validatedFields({...fields,'Reference 1 - Employee ID':''}));
  assert.throws(()=>validatedFields({...fields,'Other Languages Proficiency [French]':'anything'}));
  assert.throws(()=>validatedFields({...fields,Religion:'x'}));
  assert.equal(validatedFields({...fields,'Other Languages Proficiency [French]':'Read, Write'})['Other Languages Proficiency [French]'],'Read, Write');
});
test('salary-based revenue computes costs, markup, GST and contribution separately; all other roles fail',()=>{
  const items=[{employeeId:'a',grossEarnings:18000,payableDays:26,overtimeHours:10},{employeeId:'b',grossEarnings:12000,payableDays:20,overtimeHours:0}];
  const assumptions={serviceChargePercent:10,employerCost:3000,otherBilling:500,operatingCost:1000,referralBonus:500,gstPercent:18,feeBasis:'salary'};
  const result=calculateRevenue('super_admin',items,assumptions);
  assert.equal(result.earnedSalary,30000);assert.equal(result.serviceCharge,3000);assert.equal(result.revenueExcludingGst,36500);assert.equal(result.gst,6570);assert.equal(result.invoiceTotal,43070);assert.equal(result.contribution,2000);assert.equal(result.payableDays,46);
  assert.equal(calculateRevenue('super_admin',items,{...assumptions,feeBasis:'salary_plus_employer_cost'}).serviceCharge,3300);
  for(const role of ['field_hr','hr_team','payroll_team','hostel_incharge','unknown','']) assert.throws(()=>calculateRevenue(role,items,assumptions),/Super Admin/);
  for(const change of [{serviceChargePercent:-1},{employerCost:NaN},{gstPercent:101},{feeBasis:'anything'}]) assert.throws(()=>calculateRevenue('super_admin',items,{...assumptions,...change}));
  assert.throws(()=>calculateRevenue('super_admin',[...items,items[0]],assumptions),/Duplicate/);
  assert.equal(calculateRevenue('super_admin',[],{...assumptions,employerCost:0,otherBilling:0,operatingCost:0,referralBonus:0}).marginPercent,0);
});
test('both referral reports keep identities separate and qualify bonuses using worked days',()=>{
  const employees=[{id:'one',employeeCode:'1',name:'Employee',dateOfJoining:'2026-09-01',status:'active',applicationJson:JSON.stringify({'Reference 1 - Employee ID':'ref','Reference 1 - Employee Code':'JOY1','Reference 1 - Name':'Direct Referrer','Reference 2 - Name':'External Referrer','Reference 2 - Phone No':'9999999999'})},{id:'two',employeeCode:'2',name:'No payroll',dateOfJoining:'2026-09-01',status:'active',applicationJson:JSON.stringify({'Reference 1 - Employee ID':'ref','Reference 1 - Name':'Direct Referrer'})}];
  const items=[{employeeId:'one',presentDays:15.5,payableDays:20}];
  const one=referenceReport(employees,items,1,15,500), two=referenceReport(employees,items,2,16,600);
  assert.equal(one.length,2);assert.equal(one[0].referrerCode,'JOY1');assert.equal(one[0].bonusEstimate,500);assert.equal(one[1].bonusEstimate,0);
  assert.equal(two.length,1);assert.equal(two[0].phone,'9999999999');assert.equal(two[0].bonusEstimate,0);
});
