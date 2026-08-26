alter table client_units add column overtime_multiplier real not null default 1;
alter table client_units add column voucher_header text;
alter table hostels add column client_scope_json text not null default '[]';
