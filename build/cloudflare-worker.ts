import handler from "vinext/server/fetch-handler";
import { retryOrderNotifications } from "../lib/order-notifications";
import { queueEventReminders } from "../lib/event-reminders";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  scheduled(_controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await queueEventReminders();
      await retryOrderNotifications();
    })());
  },
};

export default worker;
