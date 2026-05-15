import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "Admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let url: string;
  let secret: string | undefined;

  try {
    const body = await req.json();
    url = body.url;
    secret = body.secret;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Validate https
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return NextResponse.json(
        { ok: false, message: "URL must use https://" },
        { status: 200 }
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid URL" },
      { status: 200 }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["Authorization"] = `Bearer ${secret}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "ping" }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      message: response.ok
        ? `Verbindung erfolgreich (HTTP ${response.status})`
        : `Webhook nicht erreichbar (HTTP ${response.status})`,
    });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return NextResponse.json({
      ok: false,
      message: isTimeout
        ? "Request timed out after 8 seconds."
        : `Connection failed: ${err?.message ?? "unknown error"}`,
    });
  }
}
