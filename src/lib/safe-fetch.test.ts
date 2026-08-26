import assert from "node:assert/strict";
import { assertPublicUrl, BlockedUrlError } from "./safe-fetch";

// Run: npm test
const blocked = [
  "http://169.254.169.254/latest/meta-data/", // cloud metadata
  "http://127.0.0.1:6379",
  "http://localhost:3000",
  "http://10.0.0.5/admin",
  "http://192.168.1.1",
  "http://172.16.0.1",
  "http://[::1]:8080",
  "file:///etc/passwd",
  "not a url",
];

const allowed = ["https://example.com", "https://stripe.com/docs"];

async function main() {
  for (const url of blocked) {
    await assert.rejects(() => assertPublicUrl(url), BlockedUrlError, `should block ${url}`);
  }
  for (const url of allowed) {
    await assertPublicUrl(url);
  }
  console.log(`ok — ${blocked.length} blocked, ${allowed.length} allowed`);
}

main();
