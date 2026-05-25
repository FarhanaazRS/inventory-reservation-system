"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type Reservation = {
  id: string;
  status: "pending" | "confirmed" | "released";
  quantity: number;
  expiresAt: string;
  product: {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
};

function useCountdown(expiresAt: string | null, active: boolean) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt || !active) {
      return;
    }

    const update = () => {
      setTimeLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [active, expiresAt]);

  return {
    minutes: Math.floor(timeLeft / 60000),
    seconds: Math.floor((timeLeft % 60000) / 1000),
    isExpired: active && timeLeft === 0,
    isUrgent: active && timeLeft > 0 && timeLeft < 60000,
  };
}

async function readJsonError(res: Response) {
  const data = await res.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function ReservationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const reservationId = params.id;
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<"confirm" | "release" | null>(null);

  const isPending = reservation?.status === "pending";
  const { minutes, seconds, isExpired, isUrgent } = useCountdown(
    reservation?.expiresAt ?? null,
    Boolean(isPending)
  );

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${reservationId}`);

      if (!res.ok) {
        throw new Error(await readJsonError(res));
      }

      setReservation(await res.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reservation not found");
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [reservationId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReservation();
  }, [fetchReservation]);

  async function handleConfirm() {
    setActing("confirm");

    try {
      const res = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });

      if (res.status === 410) {
        toast.error("This reservation expired. Please reserve again.");
        await fetchReservation();
        return;
      }

      if (!res.ok) {
        throw new Error(await readJsonError(res));
      }

      setReservation(await res.json());
      toast.success("Purchase confirmed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Confirmation failed");
    } finally {
      setActing(null);
    }
  }

  async function handleRelease() {
    setActing("release");

    try {
      const res = await fetch(`/api/reservations/${reservationId}/release`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(await readJsonError(res));
      }

      setReservation(await res.json());
      toast.success("Reservation cancelled. Stock is available again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancellation failed");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080809] p-6">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-8 w-44 bg-white/[0.05]" />
          <Skeleton className="h-80 rounded-xl bg-white/[0.05]" />
        </div>
      </main>
    );
  }

  if (!reservation) {
    return null;
  }

  const isConfirmed = reservation.status === "confirmed";
  const isReleased = reservation.status === "released";
  const imageUrl =
    reservation.product.imageUrl ||
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080809] p-6 text-white">
      <div className="w-full max-w-lg">
        <button
          onClick={() => router.push("/")}
          className="mb-6 text-sm text-white/50 transition-colors hover:text-white"
        >
          Back to products
        </button>

        <Card className="border-white/[0.06] bg-[#0d0d0e] text-white">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Checkout</CardTitle>
              <Badge
                className={
                  isConfirmed
                    ? "bg-emerald-600"
                    : isReleased || isExpired
                      ? "bg-red-600"
                      : "bg-amber-500 text-black"
                }
              >
                {isConfirmed
                  ? "Confirmed"
                  : isReleased
                    ? "Released"
                    : isExpired
                      ? "Expired"
                      : "Pending"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
                <Image
                  src={imageUrl}
                  alt={reservation.product.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold leading-snug">
                  {reservation.product.name}
                </h1>
                <p className="mt-1 text-sm text-white/45">
                  {reservation.product.description}
                </p>
                <p className="mt-2 text-xs text-white/35">
                  Quantity {reservation.quantity} from {reservation.warehouse.name}
                </p>
              </div>
            </div>

            <Separator className="bg-white/[0.06]" />

            {isPending && (
              <div
                className={`rounded-lg border p-5 text-center ${
                  isExpired
                    ? "border-red-500/30 bg-red-500/10"
                    : isUrgent
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-white/[0.06] bg-white/[0.03]"
                }`}
              >
                {isExpired ? (
                  <>
                    <p className="font-medium text-red-300">Reservation expired</p>
                    <p className="mt-1 text-sm text-white/45">
                      The held stock has been released.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mb-2 text-xs uppercase tracking-wide text-white/35">
                      Time remaining
                    </p>
                    <p className={isUrgent ? "font-mono text-5xl text-amber-300" : "font-mono text-5xl"}>
                      {String(minutes).padStart(2, "0")}:
                      {String(seconds).padStart(2, "0")}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="rounded-lg bg-white/[0.03] p-4 text-sm">
              <div className="flex justify-between gap-4 text-white/45">
                <span>Warehouse</span>
                <span className="text-right text-white">{reservation.warehouse.name}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4 text-white/45">
                <span>Location</span>
                <span className="text-right text-white">{reservation.warehouse.location}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4 text-white/45">
                <span>Reservation ID</span>
                <span className="max-w-[14rem] truncate font-mono text-xs text-white/60">
                  {reservation.id}
                </span>
              </div>
            </div>

            {isPending && !isExpired && (
              <div className="space-y-3">
                <Button
                  className="h-12 w-full bg-emerald-500 font-semibold text-black hover:bg-emerald-400"
                  disabled={acting !== null}
                  onClick={handleConfirm}
                >
                  {acting === "confirm" ? "Confirming..." : "Confirm purchase"}
                </Button>
                <Button
                  className="h-11 w-full border-white/[0.08] text-white/70 hover:bg-white/[0.06] hover:text-white"
                  disabled={acting !== null}
                  onClick={handleRelease}
                  variant="outline"
                >
                  {acting === "release" ? "Cancelling..." : "Cancel reservation"}
                </Button>
              </div>
            )}

            {(isConfirmed || isReleased || isExpired) && (
              <Button className="w-full" onClick={() => router.push("/")} variant="outline">
                Back to products
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
