import assert from "node:assert/strict";
import { parsePushSubscription } from "./web-push";

assert.equal(parsePushSubscription(null), null);
assert.equal(parsePushSubscription({}), null);
assert.equal(
  parsePushSubscription({
    endpoint: "https://push.example/abc",
    keys: { p256dh: "p", auth: "a" },
  })?.endpoint,
  "https://push.example/abc"
);
assert.equal(
  parsePushSubscription({
    endpoint: "http://insecure.example/abc",
    keys: { p256dh: "p", auth: "a" },
  }),
  null
);

console.log("web-push tests passed");
