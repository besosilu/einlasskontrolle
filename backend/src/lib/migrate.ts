import sql from './db.js';

export async function runMigrations() {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const migrations: { name: string; sql: string }[] = [
    {
      name: '001_init',
      sql: `
        CREATE TABLE IF NOT EXISTS members (
          id SERIAL PRIMARY KEY,
          member_number VARCHAR(50) UNIQUE,
          last_name VARCHAR(100) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          source VARCHAR(20) NOT NULL DEFAULT 'manual',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS entries (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id),
          entry_time TIMESTAMPTZ NOT NULL DEFAULT now(),
          entry_date DATE NOT NULL,
          method VARCHAR(10) NOT NULL,
          notes TEXT,
          created_by VARCHAR(100)
        );
        CREATE TABLE IF NOT EXISTS import_logs (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          records_total INTEGER NOT NULL,
          records_created INTEGER NOT NULL,
          records_updated INTEGER NOT NULL,
          records_skipped INTEGER NOT NULL,
          errors JSONB NOT NULL DEFAULT '[]'
        );
        CREATE TABLE IF NOT EXISTS import_member_links (
          import_id INTEGER NOT NULL REFERENCES import_logs(id) ON DELETE CASCADE,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          action VARCHAR(10) NOT NULL,
          PRIMARY KEY (import_id, member_id)
        );
        CREATE INDEX IF NOT EXISTS members_last_first_idx ON members(last_name, first_name);
        CREATE INDEX IF NOT EXISTS entries_member_id_idx ON entries(member_id);
        CREATE INDEX IF NOT EXISTS entries_entry_date_idx ON entries(entry_date);
      `,
    },
    {
      name: '002_price_items',
      sql: `
        CREATE TABLE IF NOT EXISTS price_items (
          id SERIAL PRIMARY KEY,
          category VARCHAR(20) NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          period VARCHAR(50),
          active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS price_items_cat_order_idx ON price_items(category, sort_order);
      `,
    },
    {
      name: '003_member_flags',
      sql: `
        ALTER TABLE members ADD COLUMN IF NOT EXISTS needs_new_card BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE members ADD COLUMN IF NOT EXISTS is_trainer BOOLEAN NOT NULL DEFAULT false;
      `,
    },
    {
      name: '004_users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `,
    },
    {
      name: '005_users_v2',
      sql: `
        DROP TABLE IF EXISTS users;
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          password_hash VARCHAR(255),
          role VARCHAR(20) NOT NULL DEFAULT 'user',
          is_active BOOLEAN NOT NULL DEFAULT false,
          must_change_password BOOLEAN NOT NULL DEFAULT false,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          locked_until TIMESTAMPTZ,
          activation_token VARCHAR(255),
          activation_token_expires TIMESTAMPTZ,
          reset_token VARCHAR(255),
          reset_token_expires TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS registration_requests (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          reviewed_at TIMESTAMPTZ,
          reviewed_by INTEGER REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
        CREATE INDEX IF NOT EXISTS reg_requests_status_idx ON registration_requests(status);
      `,
    },
    {
      name: '006_needs_new_card_since',
      sql: `
        ALTER TABLE members ADD COLUMN IF NOT EXISTS needs_new_card_since TIMESTAMPTZ;
      `,
    },
    {
      name: '007_trial_training',
      sql: `
        ALTER TABLE members ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE members ADD COLUMN IF NOT EXISTS trial_registration_date DATE;
      `,
    },
    {
      // Pre-swim candidates are not members yet; they are tracked by name only
      name: '009_preswim_flag',
      sql: `
        ALTER TABLE members ADD COLUMN IF NOT EXISTS is_preswim BOOLEAN NOT NULL DEFAULT false;
      `,
    },
    {
      // NULL for imports made before this counter existed
      name: '008_import_entries_created',
      sql: `
        ALTER TABLE import_logs ADD COLUMN IF NOT EXISTS entries_created INTEGER;
      `,
    },
  ];

  for (const migration of migrations) {
    const [applied] = await sql`SELECT name FROM _migrations WHERE name = ${migration.name}`;
    if (applied) continue;

    console.log(`Applying migration: ${migration.name}`);
    await sql.unsafe(migration.sql);
    await sql`INSERT INTO _migrations (name) VALUES (${migration.name})`;
    console.log(`Migration applied: ${migration.name}`);
  }

  console.log('All migrations up to date.');
}
