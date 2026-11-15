export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
    const requestHost = forwardedHost || request.headers.get("host") || requestUrl.host;
    const requestProtocol = forwardedProtocol || requestUrl.protocol.slice(0, -1);
    const publicRequestOrigin = new URL(`${requestProtocol}://${requestHost}`).origin;
    return (
      originUrl.origin === publicRequestOrigin ||
      request.headers.get("sec-fetch-site") === "same-origin"
    );
  } catch {
    return false;
  }
}
