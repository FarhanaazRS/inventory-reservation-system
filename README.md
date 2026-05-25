# Allo Inventory Reservation System

Next.js App Router take-home project for reserving product inventory by warehouse. The app shows live available stock, creates short-lived reservations, lets a shopper confirm or cancel checkout, and releases expired holds back into inventory.

## Tech Stack

- Next.js 15 App Router
- TypeScript and React 19
- Prisma ORM
- Hosted PostgreSQL
- Zod request validation
- Tailwind CSS and shadcn-style UI components
- Vercel Cron for scheduled expiry cleanup

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Set `DATABASE_URL` to a hosted PostgreSQL connection string.

4. Generate Prisma Client:

   ```bash
   npm run prisma:generate
   ```

5. Push the Prisma schema to the database:

   ```bash
   npm run prisma:push
   ```

6. Seed demo data:

   ```bash
   npm run prisma:seed
   ```

7. Start the app:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`.

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string used by Prisma.
- `DIRECT_URL`: Optional direct database URL for providers such as Supabase. This project does not require it in `schema.prisma`, but it is included as a deployment note if your provider needs direct migration access.
- `CRON_SECRET`: Optional bearer token for `GET /api/cron/release-expired`. If set, cron calls must send `Authorization: Bearer <CRON_SECRET>`.

Do not commit real secrets.

## API Routes

- `GET /api/products`: releases expired reservations, then returns products with stock by warehouse. `availableStock = totalUnits - reservedUnits`.
- `GET /api/warehouses`: returns warehouses.
- `POST /api/reservations`: validates `{ productId, warehouseId, quantity }`, atomically reserves stock, and returns `409` when stock is insufficient.
- `GET /api/reservations/:id`: returns reservation details for checkout.
- `POST /api/reservations/:id/confirm`: confirms pending reservations, returns `410` when expired, and decrements both `totalUnits` and `reservedUnits`.
- `POST /api/reservations/:id/release`: releases pending reservations early and is safe to retry.
- `GET /api/cron/release-expired`: releases expired pending reservations for Vercel Cron.

All Prisma API routes export `runtime = "nodejs"` so they do not run on the Edge runtime.

## Concurrency Correctness

Reservation creation uses a PostgreSQL transaction with an atomic conditional update:

```sql
UPDATE "Stock"
SET "reservedUnits" = "reservedUnits" + quantity
WHERE "productId" = productId
  AND "warehouseId" = warehouseId
  AND ("totalUnits" - "reservedUnits") >= quantity
RETURNING id;
```

If two requests race for the last unit, PostgreSQL serializes the row update. Exactly one update can satisfy the stock predicate; the other receives `409`.

Confirm and release endpoints lock the reservation row with `SELECT ... FOR UPDATE`, then transition state and adjust stock inside the same transaction. Confirm is retry-safe: already confirmed reservations return the confirmed reservation without decrementing stock again. Release is retry-safe: already released reservations return the released reservation without decrementing reserved stock again.

## Reservation Expiry

Reservations expire after 10 minutes. Expired pending reservations are released in two ways:

- Lazy cleanup runs before product reads, reservation reads, and reservation writes.
- Vercel Cron calls `/api/cron/release-expired` every 5 minutes from `vercel.json`.

The cleanup updates only pending expired reservations and decrements `reservedUnits` once, so concurrent cleanup calls are safe.

## Idempotency

`POST /api/reservations` supports `Idempotency-Key`. The key is stored on the reservation row. Retrying the same key and same body returns the original reservation without reserving stock again. Reusing a key with different reservation details returns `409`.

`POST /api/reservations/:id/confirm` also supports `Idempotency-Key` through `confirmIdempotencyKey`. Retrying a confirmation key returns the confirmed reservation without repeating stock decrements. For this take-home, idempotency keys are stored on reservations without a new unique index so `prisma db push` can update an existing demo database without requiring `--accept-data-loss`; a production hardening pass should move them into a dedicated table with a unique key.

## Vercel Deployment

1. Create a PostgreSQL database and copy its connection string.
2. Import the project into Vercel.
3. Set Vercel environment variables:
   - `DATABASE_URL`
   - `CRON_SECRET` if you want the cron route protected
   - `DIRECT_URL` only if your database provider needs it for migrations or direct connections
4. Run the database setup against production:

   ```bash
   npm run prisma:push
   npm run prisma:seed
   ```

5. Deploy. The build script runs `prisma generate && next build`, so Prisma Client is generated during Vercel builds.

## Demo Flow

1. Open the catalog.
2. Choose a warehouse with available stock.
3. Click `Reserve now`.
4. On checkout, watch the live countdown.
5. Click `Confirm purchase` to permanently decrement stock, or `Cancel reservation` to release the hold.
6. To test expiry, wait 10 minutes or call `/api/cron/release-expired` after a reservation expires.

## Trade-offs

- The seed script resets demo tables before recreating demo data, which is convenient for evaluators but should not be used on production data.
- The cron route is optional-secret protected. Vercel Cron can call it without a secret in simple demos, but production deployments should set `CRON_SECRET`.
- Migrations are not committed in this take-home version; `prisma db push` is documented for setup speed. With more time, I would add checked-in migrations and a small integration test suite that exercises concurrent reservation races.
