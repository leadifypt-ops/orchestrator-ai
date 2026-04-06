import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function isAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.DISPATCH_SECRET || ""}`;

  if (process.env.DISPATCH_SECRET && authHeader === expected) {
    return true;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return !!user;
}

export async function POST(req: NextRequest) {
  try {
    const authorized = await isAuthorized(req);

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin ||
      "http://localhost:3000";

    const schedulerHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const runnerHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.SCHEDULER_SECRET) {
      schedulerHeaders.Authorization = `Bearer ${process.env.SCHEDULER_SECRET}`;
    }

    if (process.env.RUNNER_SECRET) {
      runnerHeaders.Authorization = `Bearer ${process.env.RUNNER_SECRET}`;
    } else if (process.env.SCHEDULER_SECRET) {
      runnerHeaders.Authorization = `Bearer ${process.env.SCHEDULER_SECRET}`;
    } else if (process.env.DISPATCH_SECRET) {
      runnerHeaders.Authorization = `Bearer ${process.env.DISPATCH_SECRET}`;
    }

    const schedulerRes = await fetch(`${origin}/api/scheduler`, {
      method: "POST",
      headers: schedulerHeaders,
      cache: "no-store",
    });

    const schedulerData = await schedulerRes.json();

    if (!schedulerRes.ok) {
      return NextResponse.json(
        {
          error: schedulerData?.error || "Erro ao correr scheduler.",
          step: "scheduler",
          details: schedulerData,
        },
        { status: 500 }
      );
    }

    const runnerRes = await fetch(`${origin}/api/runner`, {
      method: "POST",
      headers: runnerHeaders,
      cache: "no-store",
    });

    const runnerData = await runnerRes.json();

    if (!runnerRes.ok) {
      return NextResponse.json(
        {
          error: runnerData?.error || "Erro ao correr runner.",
          step: "runner",
          scheduler: schedulerData,
          details: runnerData,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      scheduler: schedulerData,
      runner: runnerData,
    });
  } catch (error) {
    console.error("DISPATCH_ERROR", error);

    const message =
      error instanceof Error ? error.message : "Erro interno no dispatch.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}