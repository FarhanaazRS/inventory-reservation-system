import { prisma } from "@/lib/prisma";

export const RESERVATION_TTL_MS = 10 * 60 * 1000;

export async function releaseExpiredReservations() {
  const now = new Date();
  const expired = await prisma.reservation.findMany({
    where: {
      status: "pending",
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      quantity: true,
    },
  });

  let released = 0;

  for (const reservation of expired) {
    const didRelease = await prisma.$transaction(async (tx) => {
      const updatedReservation = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: "pending",
          expiresAt: { lte: now },
        },
        data: { status: "released" },
      });

      if (updatedReservation.count === 0) {
        return false;
      }

      await tx.stock.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
          reservedUnits: { gte: reservation.quantity },
        },
        data: {
          reservedUnits: { decrement: reservation.quantity },
        },
      });

      return true;
    });

    if (didRelease) {
      released += 1;
    }
  }

  return released;
}
