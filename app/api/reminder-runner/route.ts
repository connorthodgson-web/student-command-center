import { NextResponse } from "next/server";
import { listReminderDeliveryRuns, runReminderRunner } from "../../../lib/reminder-runner";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getAuthedSupabase } from "../../../lib/supabase/route-auth";

type ReminderRunnerRequest = {
  at?: string;
  timezone?: string;
  force?: boolean;
  kinds?: Array<"daily_summary" | "tonight_summary" | "due_soon">;
  userId?: string;
};

type RequestScope =
  | {
      admin: NonNullable<ReturnType<typeof createAdminClient>>;
      scope: "global";
      userId: null;
    }
  | {
      admin: NonNullable<ReturnType<typeof createAdminClient>>;
      scope: "self";
      userId: string;
    }
  | {
      response: NextResponse;
    };

function hasRunnerSecret(request: Request) {
  const expected = process.env.REMINDER_RUNNER_KEY?.trim();
  const provided = request.headers.get("x-reminder-runner-key")?.trim();
  return Boolean(expected && provided && expected === provided);
}

async function requireScopedUser(request: Request): Promise<RequestScope> {
  const secretAuthorized = hasRunnerSecret(request);
  const admin = createAdminClient();

  if (secretAuthorized) {
    if (!admin) {
      return {
        response: NextResponse.json(
          { error: "Supabase admin access is not configured." },
          { status: 503 },
        ),
      };
    }

    return {
      admin,
      scope: "global" as const,
      userId: null,
    };
  }

  const auth = await getAuthedSupabase();
  if ("response" in auth) {
    return { response: auth.response! };
  }

  if (!admin) {
    return {
      response: NextResponse.json(
        { error: "Supabase admin access is not configured." },
        { status: 503 },
      ),
    };
  }

  return {
    admin,
    scope: "self" as const,
    userId: auth.userId,
  };
}

export async function GET(request: Request) {
  const scope = await requireScopedUser(request);
  if ("response" in scope) return scope.response;

  const url = new URL(request.url);
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const requestedUserId = url.searchParams.get("userId") ?? undefined;
  const userId = scope.scope === "global" ? requestedUserId : scope.userId;

  try {
    const data = await listReminderDeliveryRuns({
      userId: userId ?? undefined,
      limit: Number.isFinite(limitParam) ? limitParam : 50,
    });

    return NextResponse.json({
      data,
      scope: scope.scope,
      userId: userId ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load reminder runner history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const scope = await requireScopedUser(request);
  if ("response" in scope) return scope.response;

  const body = (await request.json().catch(() => ({}))) as ReminderRunnerRequest;
  const userId = scope.scope === "global" ? body.userId : scope.userId;

  try {
    const data = await runReminderRunner({
      at: body.at,
      timezone: body.timezone,
      force: body.force,
      kinds: body.kinds,
      userId: userId ?? undefined,
    });

    return NextResponse.json({
      data,
      scope: scope.scope,
      userId: userId ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run the reminder runner.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
