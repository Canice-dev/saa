export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "sales-assistant-web",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
