import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This runs on a schedule to clean up expired reservations
// It's called by Vercel Cron (see vercel.json)
// It's also safe to call manually — idempotent

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron (not a random visitor)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all expired PENDING reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() }, // expired = expiresAt is in the past
      },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({ released: 0, message: "Nothing to expire" });
    }

    // Release each one in a transaction
    let released = 0;
    for (const reservation of expiredReservations) {
      await prisma.$transaction(async (tx:any
        
      ) => {
        // Return stock to available pool
        await tx.stock.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
          data: { reserved: { decrement: reservation.quantity } },
        });

        // Mark as released
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "RELEASED" },
        });
      });
      released++;
    }

    console.log(`Cron: Released ${released} expired reservations`);
    return NextResponse.json({ released, message: `Released ${released} reservations` });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}