"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

type Reservation = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  quantity: number;
  expiresAt: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
};

function useCountdown(expiresAt: string | null) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      setTimeLeft(Math.max(0, diff));
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const isExpired = timeLeft === 0;
  const isUrgent = timeLeft < 60000; // less than 1 minute

  return { minutes, seconds, isExpired, isUrgent, timeLeft };
}

export default function ReservationPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const { minutes, seconds, isExpired, isUrgent } = useCountdown(
    reservation?.expiresAt ?? null
  );

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${params.id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setReservation(data);
    } catch {
      toast.error("Reservation not found");
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  async function handleConfirm() {
    setActing(true);
    try {
      const res = await fetch(`/api/reservations/${params.id}/confirm`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.status === 410) {
        toast.error("⏰ Your reservation expired! Please reserve again.");
        fetchReservation();
        return;
      }

      if (!res.ok) {
        toast.error(data.error || "Confirmation failed");
        return;
      }

      toast.success("🎉 Order confirmed! Thank you for your purchase.");
      setReservation(data);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActing(false);
    }
  }

  async function handleRelease() {
    setActing(true);
    try {
      const res = await fetch(`/api/reservations/${params.id}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Cancellation failed");
        return;
      }

      toast.success("Reservation cancelled. Stock returned to pool.");
      setReservation(data);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-8 w-48 bg-gray-800" />
          <Skeleton className="h-64 rounded-xl bg-gray-800" />
          <Skeleton className="h-12 rounded-lg bg-gray-800" />
        </div>
      </main>
    );
  }

  if (!reservation) return null;

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors"
        >
          ← Back to products
        </button>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Checkout</CardTitle>
              <Badge
                className={
                  isConfirmed
                    ? "bg-emerald-600"
                    : isReleased
                    ? "bg-gray-600"
                    : isExpired
                    ? "bg-red-600"
                    : "bg-amber-500 text-black"
                }
              >
                {isConfirmed
                  ? "✓ Confirmed"
                  : isReleased
                  ? "Cancelled"
                  : isExpired
                  ? "Expired"
                  : "Pending"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Product info */}
            <div className="flex gap-4">
              <img
                src={
                  reservation.product.imageUrl ||
                  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200"
                }
                alt={reservation.product.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h2 className="text-white font-semibold text-lg">
                  {reservation.product.name}
                </h2>
                <p className="text-gray-400 text-sm">
                  {reservation.product.description}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Qty: {reservation.quantity} × from {reservation.warehouse.name}
                </p>
              </div>
            </div>

            <Separator className="bg-gray-800" />

            {/* Countdown Timer — only show if pending and not expired */}
            {isPending && (
              <div
                className={`rounded-xl p-5 text-center ${
                  isExpired
                    ? "bg-red-950 border border-red-800"
                    : isUrgent
                    ? "bg-amber-950 border border-amber-800"
                    : "bg-gray-800 border border-gray-700"
                }`}
              >
                {isExpired ? (
                  <>
                    <p className="text-red-400 text-sm mb-1">Reservation Expired</p>
                    <p className="text-gray-400 text-xs">
                      This hold has expired and stock was released.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                      Time remaining to complete purchase
                    </p>
                    <div
                      className={`text-5xl font-mono font-bold tracking-tight ${
                        isUrgent ? "text-amber-400" : "text-white"
                      }`}
                    >
                      {String(minutes).padStart(2, "0")}:
                      {String(seconds).padStart(2, "0")}
                    </div>
                    {isUrgent && (
                      <p className="text-amber-400 text-xs mt-1 animate-pulse">
                        ⚡ Hurry! Almost out of time
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Warehouse info */}
            <div className="bg-gray-800 rounded-lg p-4 text-sm">
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Warehouse</span>
                <span className="text-white">{reservation.warehouse.name}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Location</span>
                <span className="text-white">{reservation.warehouse.location}</span>
              </div>
            </div>

            {/* Reservation ID */}
            <div className="text-center">
              <p className="text-gray-500 text-xs">Reservation ID</p>
              <p className="text-gray-400 font-mono text-xs">{reservation.id}</p>
            </div>

            {/* Action Buttons */}
            {isPending && !isExpired && (
              <div className="space-y-3">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-6 text-base"
                  onClick={handleConfirm}
                  disabled={acting}
                >
                  {acting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "✓ Confirm Purchase"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
                  onClick={handleRelease}
                  disabled={acting}
                >
                  Cancel Reservation
                </Button>
              </div>
            )}

            {isPending && isExpired && (
              <div className="space-y-3">
                <div className="text-center p-4 bg-red-950 rounded-lg border border-red-800">
                  <p className="text-red-400 font-medium">
                    This reservation has expired
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    The held stock has been returned to inventory.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => router.push("/")}
                  variant="outline"
                >
                  Browse Products Again
                </Button>
              </div>
            )}

            {isConfirmed && (
              <div className="text-center p-6 bg-emerald-950 rounded-xl border border-emerald-800">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-emerald-400 font-semibold text-lg">
                  Order Confirmed!
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Your purchase was successful.
                </p>
                <Button
                  className="mt-4 bg-emerald-700 hover:bg-emerald-600"
                  onClick={() => router.push("/")}
                >
                  Continue Shopping
                </Button>
              </div>
            )}

            {isReleased && (
              <div className="text-center p-6 bg-gray-800 rounded-xl border border-gray-700">
                <p className="text-gray-300 font-medium">
                  Reservation Cancelled
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Stock has been returned to the warehouse.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => router.push("/")}
                >
                  Back to Products
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}