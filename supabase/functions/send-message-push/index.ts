// Triggered by a Database Webhook on `messages` INSERT (wired up via SQL,
// not the Dashboard UI -- see the trigger at the bottom of
// supabase/migrations/20261013090000_add_messaging.sql's follow-up, or
// re-run `supabase db query -f supabase/functions/send-message-push/webhook.sql`
// after redeploying this function). Looks up the *other* conversation
// participant's registered devices (`push_tokens`) and delivers a push to
// each: Expo's push API for mobile tokens, Web Push (VAPID) for browser
// subscriptions. Beta scope: plain "<sender> sent a message" notifications,
// no rich content, no delivery-receipt polling.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

// Service-role client -- this function must read `push_tokens` and
// `profiles` for a user other than whoever is logged in (there is no
// logged-in user at all, this runs as a server-side webhook), which RLS
// would otherwise block entirely.
const supabase = createClient(supabaseUrl, serviceRoleKey);

interface PushTokenRow {
  platform: 'expo' | 'web';
  token: string;
}

Deno.serve(async (req: Request) => {
  const payload = await req.json().catch(() => null);
  const message = payload?.record;

  if (
    typeof message?.conversation_id !== 'string' ||
    typeof message?.sender_id !== 'string' ||
    typeof message?.body !== 'string'
  ) {
    return new Response('ignored: malformed payload', { status: 200 });
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('user_a, user_b')
    .eq('id', message.conversation_id)
    .single();
  if (!conversation) return new Response('ignored: conversation not found', { status: 200 });

  const recipientId =
    conversation.user_a === message.sender_id ? conversation.user_b : conversation.user_a;

  const [{ data: sender }, { data: tokens }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', message.sender_id).single(),
    supabase
      .from('push_tokens')
      .select('platform, token')
      .eq('user_id', recipientId)
      .returns<PushTokenRow[]>(),
  ]);

  if (!tokens || tokens.length === 0) {
    return new Response('ok: no devices registered', { status: 200 });
  }

  const title = sender?.username ?? 'CoreFit';
  // Push payloads have real size limits (web push in particular) -- a
  // message this app's own `messages_body_not_blank`/UI already caps at a
  // couple thousand characters still needs trimming for a notification
  // body specifically.
  const body = message.body.length > 200 ? `${message.body.slice(0, 200)}…` : message.body;

  await Promise.allSettled(
    tokens.map((row) => deliverOne(row, title, body, message.conversation_id)),
  );

  return new Response('ok', { status: 200 });
});

async function deliverOne(
  row: PushTokenRow,
  title: string,
  body: string,
  conversationId: string,
): Promise<void> {
  if (row.platform === 'expo') {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: row.token,
        title,
        body,
        data: { conversationId },
        sound: 'default',
      }),
    }).catch(() => {});
    return;
  }

  try {
    const subscription = JSON.parse(row.token);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, conversationId }));
  } catch (error) {
    // A 404/410 means the browser's subscription is gone for good
    // (unsubscribed, site data cleared) -- remove the row so future
    // messages stop paying for a delivery that can never succeed. Any
    // other error (a transient network/server issue) is left alone, the
    // row might still be good next time.
    const statusCode = (error as { statusCode?: number } | null)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from('push_tokens').delete().eq('platform', 'web').eq('token', row.token);
    }
  }
}
