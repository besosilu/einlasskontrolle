import sql from '../lib/db.js';

export type PriceCategory = 'membership' | 'course';

interface PriceRow {
  id: number;
  category: string;
  name: string;
  description: string | null;
  price: string;
  period: string | null;
  active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

function mapPrice(r: PriceRow) {
  return {
    id: r.id,
    category: r.category,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    period: r.period,
    active: r.active,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listPrices() {
  const rows = await sql<PriceRow[]>`
    SELECT id, category, name, description, price, period, active, sort_order, created_at, updated_at
    FROM price_items
    ORDER BY category ASC, sort_order ASC, created_at ASC
  `;
  return rows.map(mapPrice);
}

export async function createPrice(data: {
  category: PriceCategory;
  name: string;
  description?: string;
  price: number;
  period?: string;
  active?: boolean;
}) {
  const [{ max_order }] = await sql<[{ max_order: number | null }]>`
    SELECT MAX(sort_order) AS max_order FROM price_items WHERE category = ${data.category}
  `;
  const nextOrder = (max_order ?? -1) + 1;

  const [row] = await sql<PriceRow[]>`
    INSERT INTO price_items (category, name, description, price, period, active, sort_order)
    VALUES (
      ${data.category},
      ${data.name.trim()},
      ${data.description?.trim() ?? null},
      ${data.price},
      ${data.period?.trim() ?? null},
      ${data.active ?? true},
      ${nextOrder}
    )
    RETURNING id, category, name, description, price, period, active, sort_order, created_at, updated_at
  `;
  return mapPrice(row);
}

export async function updatePrice(
  id: number,
  data: { name?: string; description?: string | null; price?: number; period?: string | null; active?: boolean }
) {
  const [row] = await sql<PriceRow[]>`
    UPDATE price_items SET
      name        = COALESCE(${data.name?.trim() ?? null}, name),
      description = CASE WHEN ${data.description !== undefined} THEN ${data.description?.trim() ?? null} ELSE description END,
      price       = COALESCE(${data.price ?? null}, price),
      period      = CASE WHEN ${data.period !== undefined} THEN ${data.period?.trim() ?? null} ELSE period END,
      active      = COALESCE(${data.active ?? null}, active),
      updated_at  = now()
    WHERE id = ${id}
    RETURNING id, category, name, description, price, period, active, sort_order, created_at, updated_at
  `;
  return mapPrice(row);
}

export async function deletePrice(id: number) {
  await sql`DELETE FROM price_items WHERE id = ${id}`;
}
