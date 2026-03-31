import test from "node:test";
import assert from "node:assert/strict";

import { isPrivateIpLiteral } from "@/lib/ssrf";

test("isPrivateIpLiteral identifies blocked private ranges", () => {
  assert.equal(isPrivateIpLiteral("127.0.0.1"), true);
  assert.equal(isPrivateIpLiteral("10.0.0.8"), true);
  assert.equal(isPrivateIpLiteral("192.168.1.1"), true);
  assert.equal(isPrivateIpLiteral("172.20.8.9"), true);
  assert.equal(isPrivateIpLiteral("::1"), true);
  assert.equal(isPrivateIpLiteral("fd00::1"), true);
});

test("isPrivateIpLiteral allows public IPs", () => {
  assert.equal(isPrivateIpLiteral("8.8.8.8"), false);
  assert.equal(isPrivateIpLiteral("1.1.1.1"), false);
  assert.equal(isPrivateIpLiteral("2606:4700:4700::1111"), false);
});
