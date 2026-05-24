"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StockEntry = {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  total: number;
  reserved: number;
  available: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  stock: StockEntry[];
  totalAvailable: number;
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const headerVariants: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

function StockBar({ available, total }: { available: number; total: number }) {
  const pct = total > 0 ? (available / total) * 100 : 0;
  const color =
    pct === 0
      ? "bg-red-500/60"
      : pct <= 30
      ? "bg-amber-400/80"
      : "bg-emerald-400/80";

  return (
    <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      />
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f10] overflow-hidden">
      <Skeleton className="h-52 w-full rounded-none bg-white/[0.04]" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4 bg-white/[0.04]" />
        <Skeleton className="h-4 w-full bg-white/[0.04]" />
        <Skeleton className="h-4 w-2/3 bg-white/[0.04]" />
        <Skeleton className="h-9 w-full mt-4 bg-white/[0.04]" />
        <Skeleton className="h-10 w-full bg-white/[0.04]" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
      const defaults: Record<string, string> = {};
      data.forEach((p: Product) => {
        const first = p.stock.find((s) => s.available > 0);
        if (first) defaults[p.id] = first.warehouseId;
      });
      setSelectedWarehouse(defaults);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  async function handleReserve(product: Product) {
    const warehouseId = selectedWarehouse[product.id];
    if (!warehouseId) {
      toast.error("Please select a warehouse");
      return;
    }
    setReserving(product.id);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, warehouseId, quantity: 1 }),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast.error("Not enough stock — someone just grabbed the last unit.");
        fetchProducts();
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Reservation failed");
        return;
      }
      toast.success("Reserved! You have 10 minutes to complete checkout.");
      router.push(`/reservation/${data.id}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setReserving(null);
    }
  }

  const totalAvailable = products.reduce((s, p) => s + p.totalAvailable, 0);

  return (
    <main className="min-h-screen bg-[#080809] text-white selection:bg-emerald-500/20">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Top gradient fade */}
      <div className="fixed top-0 inset-x-0 h-40 bg-gradient-to-b from-[#080809] to-transparent pointer-events-none z-10" />

      <div className="relative z-20 max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <motion.div
          className="mb-14"
          variants={headerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center gap-2.5 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-emerald-400/80">
              Live Inventory
            </span>
          </div>

          <h1 className="text-[2.75rem] font-semibold tracking-[-0.03em] text-white leading-[1.1] mb-4">
            Allo Product Catalog
          </h1>
          <p className="text-[15px] text-white/40 max-w-md leading-relaxed">
            Reserve items at checkout — held for 10 minutes while you complete
            payment.
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="grid grid-cols-3 gap-px mb-12 rounded-xl overflow-hidden border border-white/[0.06]"
        >
          {[
            { label: "Products", value: products.length, color: "text-white" },
            { label: "Warehouses", value: 3, color: "text-white" },
            { label: "Units Available", value: totalAvailable, color: "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0d0d0e] px-6 py-5 flex flex-col gap-1">
              <span className={`text-[1.625rem] font-semibold tracking-tight ${color}`}>
                {loading ? (
                  <Skeleton className="h-7 w-10 bg-white/[0.05]" />
                ) : (
                  value
                )}
              </span>
              <span className="text-[12px] text-white/30 font-medium tracking-wide uppercase">
                {label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Product grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {products.map((product) => {
              const selectedWh = selectedWarehouse[product.id];
              const stockForSelected = product.stock.find(
                (s) => s.warehouseId === selectedWh
              );
              const availableCount = stockForSelected?.available ?? 0;
              const isOutOfStock = product.totalAvailable === 0;
              const isLowStock = !isOutOfStock && availableCount > 0 && availableCount <= 3;
              const isReserving = reserving === product.id;

              return (
                <motion.div key={product.id} variants={cardVariants}>
                  <Card className="group relative bg-[#0d0d0e] border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 flex flex-col rounded-2xl overflow-hidden shadow-none">
                    {/* Product image */}
                    <CardHeader className="p-0 relative overflow-hidden">
                      <div className="relative h-52 overflow-hidden bg-[#111113]">
                        <img
                          src={
                            product.imageUrl ||
                            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"
                          }
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0e] via-transparent to-transparent opacity-60" />

                        {/* Status badge */}
                        <div className="absolute top-3 right-3">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-950/80 text-red-400 border border-red-500/20 backdrop-blur-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              Out of stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-950/80 text-amber-400 border border-amber-500/20 backdrop-blur-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Only {availableCount} left
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-500/20 backdrop-blur-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              In stock
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 flex-1 flex flex-col gap-4">
                      {/* Product info */}
                      <div>
                        <h2 className="font-semibold text-[15px] text-white tracking-[-0.01em] mb-1.5 leading-snug">
                          {product.name}
                        </h2>
                        <p className="text-[13px] text-white/40 leading-relaxed line-clamp-2">
                          {product.description}
                        </p>
                      </div>

                      {/* Warehouse selector */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-medium text-white/30 tracking-[0.08em] uppercase">
                          Ship from
                        </label>
                        <Select
                          value={selectedWarehouse[product.id] || ""}
                          onValueChange={(value) =>
                            setSelectedWarehouse((prev) => ({
                              ...prev,
                              [product.id]: value,
                            }))
                          }
                          disabled={isOutOfStock}
                        >
                          <SelectTrigger className="h-9 bg-white/[0.04] border-white/[0.08] hover:border-white/[0.14] text-white text-[13px] rounded-lg transition-colors focus:ring-0 focus:ring-offset-0 focus:border-white/20 data-[disabled]:opacity-40">
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#131315] border-white/[0.08] rounded-xl shadow-2xl">
                            {product.stock.map((s) => (
                              <SelectItem
                                key={s.warehouseId}
                                value={s.warehouseId}
                                disabled={s.available === 0}
                                className="text-[13px] text-white/80 focus:bg-white/[0.06] focus:text-white data-[disabled]:text-white/20 rounded-lg"
                              >
                                <span className="flex items-center justify-between gap-4 w-full">
                                  <span>{s.warehouseName}</span>
                                  <span
                                    className={
                                      s.available === 0
                                        ? "text-red-400/60"
                                        : s.available <= 3
                                        ? "text-amber-400/80"
                                        : "text-emerald-400/80"
                                    }
                                  >
                                    {s.available} avail.
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Stock breakdown */}
                      <div className="space-y-2.5 pt-0.5">
                        {product.stock.map((s) => (
                          <div key={s.warehouseId} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-white/30">
                                {s.warehouseName}
                              </span>
                              <span
                                className={`text-[11px] font-medium tabular-nums ${
                                  s.available === 0
                                    ? "text-red-400/70"
                                    : s.available <= 3
                                    ? "text-amber-400/70"
                                    : "text-white/40"
                                }`}
                              >
                                {s.available}/{s.total}
                              </span>
                            </div>
                            <StockBar available={s.available} total={s.total} />
                          </div>
                        ))}
                      </div>
                    </CardContent>

                    <CardFooter className="p-5 pt-0">
                      <button
                        onClick={() => handleReserve(product)}
                        disabled={
                          isOutOfStock ||
                          !selectedWarehouse[product.id] ||
                          availableCount === 0 ||
                          isReserving
                        }
                        className={`
                          w-full h-10 rounded-xl text-[13px] font-medium
                          flex items-center justify-center gap-2
                          transition-all duration-200
                          disabled:cursor-not-allowed
                          ${
                            isOutOfStock || availableCount === 0
                              ? "bg-white/[0.04] text-white/20 border border-white/[0.05]"
                              : "bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black shadow-[0_0_20px_rgba(52,211,153,0.2)] hover:shadow-[0_0_28px_rgba(52,211,153,0.3)]"
                          }
                        `}
                      >
                        <AnimatePresence mode="wait">
                          {isReserving ? (
                            <motion.span
                              key="loading"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-2"
                            >
                              <svg
                                className="animate-spin w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeDasharray="32"
                                  strokeDashoffset="12"
                                />
                              </svg>
                              Reserving
                            </motion.span>
                          ) : isOutOfStock || availableCount === 0 ? (
                            <motion.span
                              key="oos"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              Out of stock
                            </motion.span>
                          ) : (
                            <motion.span
                              key="reserve"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-1.5"
                            >
                              Reserve now
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                                <path
                                  d="M3 8h10M9 4l4 4-4 4"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-16 pt-8 border-t border-white/[0.04] flex items-center justify-between"
        >
          <p className="text-[12px] text-white/20">
            Reservations expire after 10 minutes
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[12px] text-white/20">System operational</span>
          </div>
        </motion.div>
      </div>
    </main>
  );
}