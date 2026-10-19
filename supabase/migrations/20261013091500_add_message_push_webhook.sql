-- Database Webhook, hand-wired via `pg_net` rather than the Dashboard's
-- "Database Webhooks" UI -- this project's `supabase_functions` schema
-- (what that UI normally relies on, via `supabase_functions.http_request`)
-- isn't present on this project (confirmed: absent from pg_proc), likely a
-- side effect of this being a restored project (see docs/decisions.md).
-- `pg_net` is the same lower-level mechanism that feature is itself built
-- on, so this reproduces the identical effect directly.
--
-- Fires the `send-message-push` Edge Function (deployed separately via
-- `supabase functions deploy send-message-push --no-verify-jwt`) after
-- every new row in `messages`, in the same payload shape
-- (`{type, table, record}`) a real Database Webhook would send, so the
-- function itself doesn't need to know this isn't the Dashboard-managed
-- version. `--no-verify-jwt` means no Authorization header is required
-- here -- deliberately not embedding the service role key in a
-- version-controlled migration file.
create extension if not exists pg_net with schema extensions;

create function public.notify_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://hdofvpebrggjifrmfqbe.supabase.co/functions/v1/send-message-push',
    body := jsonb_build_object('type', 'INSERT', 'table', 'messages', 'record', to_jsonb(new)),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;

create trigger on_message_insert_notify_push
after insert on public.messages
for each row execute function public.notify_message_push();
