alter table employees add column pf_applicable integer not null default 1;
alter table employees add column pf_wage_amount real not null default 0;
alter table employees add column esi_applicable integer not null default 1;
alter table employees add column esi_wage_amount real not null default 0;
alter table employees add column pt_applicable integer not null default 1;
alter table employees add column lwf_applicable integer not null default 1;
