import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { safeFetch, BlockedUrlError } from "./safe-fetch";

// Run: npm test
//
// Public IP literals are used throughout so assertPublicUrl short-circuits before
// any DNS lookup — these tests never touch the network. globalThis.fetch is
// stubbed so the redirect loop and the body cap can be driven directly.
const PUBLIC = "https://93.184.216.34";
const PUBLIC_ALT = "https://198.51.100.7";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Serves canned responses keyed by URL; records the order hops were requested. */
function stubFetch(routes: Record<string, () => Response>) {
  const seen: string[] = [];
  globalThis.fetch = (async (input: URL | RequestInfo) => {
    const url = String(input);
    seen.push(url);
    const route = routes[url] ?? routes["*"];
    if (!route) throw new Error(`unstubbed fetch: ${url}`);
    return route();
  }) as typeof fetch;
  return seen;
}

const redirectTo = (location: string, status = 302) =>
  new Response(null, { status, headers: { location } });

test("returns body, status and content-type on a plain 200", async () => {
  stubFetch({
    "*": () => new Response("hello docs", { status: 200, headers: { "content-type": "text/html" } }),
  });
  const res = await safeFetch(`${PUBLIC}/docs`);
  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.equal(res.contentType, "text/html");
  assert.equal(res.text, "hello docs");
  assert.equal(res.url, `${PUBLIC}/docs`);
});

test("follows a public redirect and reports the final URL", async () => {
  const seen = stubFetch({
    [`${PUBLIC}/a`]: () => redirectTo(`${PUBLIC_ALT}/b`),
    [`${PUBLIC_ALT}/b`]: () => new Response("landed", { status: 200 }),
  });
  const res = await safeFetch(`${PUBLIC}/a`);
  assert.equal(res.text, "landed");
  assert.equal(res.url, `${PUBLIC_ALT}/b`);
  assert.deepEqual(seen, [`${PUBLIC}/a`, `${PUBLIC_ALT}/b`]);
});

// The SSRF bypass this guard exists to stop: a public URL that redirects inward.
for (const [name, target] of [
  ["loopback", "http://127.0.0.1:6379/"],
  ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
  ["private range", "http://10.0.0.5/admin"],
  ["link-local IPv6", "http://[::1]:8080/"],
] as const) {
  test(`blocks a redirect into ${name}`, async () => {
    const seen = stubFetch({
      [`${PUBLIC}/a`]: () => redirectTo(target),
      "*": () => new Response("SHOULD NOT BE REACHED", { status: 200 }),
    });
    await assert.rejects(() => safeFetch(`${PUBLIC}/a`), BlockedUrlError);
    assert.deepEqual(seen, [`${PUBLIC}/a`], "must not issue the inward request");
  });
}

test("blocks a redirect that laundered through a relative Location header", async () => {
  stubFetch({ [`${PUBLIC}/a`]: () => redirectTo("//127.0.0.1/") });
  await assert.rejects(() => safeFetch(`${PUBLIC}/a`), BlockedUrlError);
});

test("rejects a redirect with no Location header", async () => {
  stubFetch({ "*": () => new Response(null, { status: 302 }) });
  await assert.rejects(
    () => safeFetch(`${PUBLIC}/a`),
    (e: Error) => e instanceof BlockedUrlError && /location/i.test(e.message),
  );
});

test("gives up after MAX_REDIRECTS hops instead of looping forever", async () => {
  const seen = stubFetch({ "*": () => redirectTo(`${PUBLIC}/next?n=${Math.random()}`) });
  await assert.rejects(
    () => safeFetch(`${PUBLIC}/a`),
    (e: Error) => e instanceof BlockedUrlError && /too many redirects/i.test(e.message),
  );
  assert.equal(seen.length, 4, "1 initial request + MAX_REDIRECTS (3) hops");
});

test("caps the body at ~512KB instead of buffering the whole response", async () => {
  const chunk = "x".repeat(64 * 1024);
  stubFetch({
    "*": () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            for (let i = 0; i < 64; i++) controller.enqueue(encoder.encode(chunk)); // 4MB
            controller.close();
          },
        }),
        { status: 200 },
      ),
  });
  const res = await safeFetch(`${PUBLIC}/big`);
  assert.ok(res.text.length >= 512_000, `got ${res.text.length}, want >= 512000`);
  assert.ok(res.text.length < 700_000, `got ${res.text.length}, want the cap to stop it well under 4MB`);
});

test("a body under the cap is returned whole", async () => {
  stubFetch({ "*": () => new Response("small", { status: 200 }) });
  assert.equal((await safeFetch(`${PUBLIC}/small`)).text, "small");
});

test("a non-2xx response is returned rather than thrown", async () => {
  stubFetch({ "*": () => new Response("nope", { status: 404 }) });
  const res = await safeFetch(`${PUBLIC}/missing`);
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
});
