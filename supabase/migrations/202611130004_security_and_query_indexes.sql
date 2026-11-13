-- Keep trigger-only security-definer functions out of the exposed RPC surface.
-- PostgreSQL triggers can invoke their trigger function without granting callers EXECUTE.
revoke execute on function public.guard_supplier_shipping_option_approval()
  from public, anon, authenticated;

-- Cover foreign keys used for joins and cascading operations.
create index if not exists order_items_order_id_idx
  on public.order_items(order_id);
create index if not exists order_items_product_id_idx
  on public.order_items(product_id);
create index if not exists order_supplier_fulfilments_shipping_option_id_idx
  on public.order_supplier_fulfilments(shipping_option_id);
create index if not exists profit_ledger_supplier_id_idx
  on public.profit_ledger(supplier_id);
