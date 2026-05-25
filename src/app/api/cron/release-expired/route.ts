import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/reservations";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get("authorization");

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const released = await releaseExpiredReservations();

    return NextResponse.json({
      released,
      message: `Released ${released} expired reservation${released === 1 ? "" : "s"}`,
    });
  } catch (error) {
    console.error("GET /api/cron/release-expired error:", error);
    return NextResponse.json(
      { error: "Failed to release expired reservations" },
      { status: 500 }
    );
  }
}
