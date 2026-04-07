// src/app/api/ping/route.ts
export async function GET() {
  return Response.json({ status: "alive 🚀" });
}