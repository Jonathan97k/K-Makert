-- PayChangu payment records, verified state transitions and JARVIS fulfilment outbox.
-- No provider credentials are stored in SQL; set them as Supabase Edge Function secrets.

begin;

alter table public.payments
  add column if not exists checkout_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists provider_transaction_id text,
  add column if not exists failure_reason text;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('initiated','pending','succeeded','failed','refunded','review_required'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid','pending','paid','failed','refunded','review_required'));

create index if not exists payments_pending_reconciliation_idx
  on public.payments(status, updated_at)
  where status in ('initiated','pending','review_required');

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null,
  tx_ref text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_result text,
  unique(provider, event_key)
);
alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon, authenticated;

-- Outbox lets JARVIS consume payment-confirmed orders without coupling checkout
-- availability to the AI system. Supplier purchasing remains approval-controlled.
create table if not exists public.jarvis_event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed','held_for_review')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique(event_type, aggregate_type, aggregate_id)
);
create index if not exists jarvis_event_outbox_pending_idx
  on public.jarvis_event_outbox(status, next_attempt_at)
  where status in ('pending','failed');

alter table public.jarvis_event_outbox enable row level security;
revoke all on public.jarvis_event_outbox from anon, authenticated;

alter table public.order_supplier_fulfilments
  add column if not exists fulfilment_status text not null default 'awaiting_payment',
  add column if not exists supplier_order_reference text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists dispatched_at timestamptz,
  add column if not exists delivered_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_supplier_fulfilments_status_check') then
    alter table public.order_supplier_fulfilments add constraint order_supplier_fulfilments_status_check
      check (fulfilment_status in ('awaiting_payment','queued_for_review','approved_to_order','ordered_from_supplier','processing','dispatched','delivered','cancelled','exception'));
  end if;
end $$;

-- Only service-role Edge Functions can call this function after verifying PayChangu
-- directly. A webhook payload alone can never mark an order paid.
create or replace function public.finalize_paychangu_payment(
  p_tx_ref text,
  p_verified_status text,
  p_verified_amount numeric,
  p_verified_currency text,
  p_provider_transaction_id text default null,
  p_verified_payload jsonb default '{}'::jsonb,
  p_event_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_tx_ref is null or length(p_tx_ref) > 160 then
    raise exception 'Invalid payment reference';
  end if;

  select * into v_payment from public.payments
  where provider = 'paychangu' and provider_reference = p_tx_ref
  for update;
  if not found then
    raise exception 'Payment reference not found';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if p_event_key is not null then
    insert into public.payment_webhook_events(provider,event_key,tx_ref,payload,processed_at,processing_result)
    values ('paychangu',p_event_key,p_tx_ref,coalesce(p_verified_payload,'{}'::jsonb),now(),'verification_received')
    on conflict (provider,event_key) do nothing;
  end if;

  if v_payment.status = 'succeeded' then
    return jsonb_build_object('ok',true,'already_paid',true,'order_id',v_order.id);
  end if;

  if lower(coalesce(p_verified_status,'')) in ('failed','cancelled','canceled') then
    update public.payments set status = 'failed',
      failure_reason = 'PayChangu verified that the payment did not complete',
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('last_verification',coalesce(p_verified_payload,'{}'::jsonb)),
      updated_at = now()
    where id = v_payment.id;
    update public.orders set payment_status = 'failed', updated_at = now()
    where id = v_order.id and payment_status <> 'paid';
    return jsonb_build_object('ok',true,'payment_status','failed','order_id',v_order.id);
  end if;

  if lower(coalesce(p_verified_status,'')) in ('pending','processing','initiated') then
    update public.payments set status = 'pending',
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('last_verification',coalesce(p_verified_payload,'{}'::jsonb)),
      updated_at = now()
    where id = v_payment.id and status <> 'succeeded';
    update public.orders set payment_status = 'pending', updated_at = now()
    where id = v_order.id and payment_status not in ('paid','review_required');
    return jsonb_build_object('ok',true,'payment_status','pending','order_id',v_order.id);
  end if;

  if lower(coalesce(p_verified_status,'')) <> 'success'
    or p_verified_amount is null
    or p_verified_currency is null
    or upper(p_verified_currency) <> upper(v_payment.currency)
    or p_verified_amount <> v_payment.amount then
    update public.payments set status = 'review_required',
      failure_reason = 'Provider verification did not exactly match expected status, amount or currency',
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('last_verification',coalesce(p_verified_payload,'{}'::jsonb)),
      updated_at = now()
    where id = v_payment.id;
    update public.orders set payment_status = 'review_required', updated_at = now()
    where id = v_order.id and payment_status <> 'paid';
    return jsonb_build_object('ok',false,'review_required',true,'order_id',v_order.id);
  end if;

  update public.payments set status = 'succeeded',
    verified_at = now(),
    provider_transaction_id = p_provider_transaction_id,
    failure_reason = null,
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('verified_payment',coalesce(p_verified_payload,'{}'::jsonb)),
    updated_at = now()
  where id = v_payment.id;

  update public.orders set payment_status = 'paid',
    status = case when status = 'pending' then 'confirmed' else status end,
    updated_at = now()
  where id = v_order.id;

  update public.order_supplier_fulfilments
  set fulfilment_status = 'queued_for_review'
  where order_id = v_order.id and fulfilment_status = 'awaiting_payment';

  insert into public.jarvis_event_outbox(
    event_type,aggregate_type,aggregate_id,payload,status
  ) values (
    'order.payment_confirmed','order',v_order.id,
    jsonb_build_object(
      'order_id',v_order.id,
      'order_number',v_order.order_number,
      'customer_id',v_order.customer_id,
      'currency',v_order.currency_code,
      'total',v_order.total,
      'supplier_fulfilment_count',(select count(*) from public.order_supplier_fulfilments f where f.order_id=v_order.id),
      'requires_human_supplier_purchase_approval',true
    ),
    'pending'
  )
  on conflict (event_type,aggregate_type,aggregate_id) do nothing;

  return jsonb_build_object('ok',true,'order_id',v_order.id,'payment_status','paid','fulfilment_queued',true);
end;
$$;

revoke all on function public.finalize_paychangu_payment(text,text,numeric,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.finalize_paychangu_payment(text,text,numeric,text,text,jsonb,text) to service_role;

commit;
