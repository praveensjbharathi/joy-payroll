begin;
alter table public.hostels add column if not exists accommodation_type_id text references public.accommodation_types(id);
update public.hostels h
set accommodation_type_id = t.id
from public.accommodation_types t
where h.accommodation_type_id is null
  and t.vendor_id = h.vendor_id
  and lower(t.name) in ('joy hostel', 'joy room');
create index if not exists hostels_accommodation_type_idx on public.hostels(accommodation_type_id);
commit;
