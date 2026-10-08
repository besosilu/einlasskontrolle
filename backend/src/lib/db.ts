import postgres from 'postgres';
import { APP_TIMEZONE } from './timezone.js';

const sql = postgres(process.env.DATABASE_URL!, {
  // Timestamps are cast to dates (entry_date) in the session time zone, so it must match the app's day
  connection: { TimeZone: APP_TIMEZONE },
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
