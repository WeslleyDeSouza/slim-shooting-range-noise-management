import type { DataSource, EntityManager } from 'typeorm';

/**
 * Runs a raw statement written with `?` placeholders (MySQL/SQLite style)
 * on any driver: PostgreSQL wants `$1 … $n`, so the placeholders are
 * rewritten there. Identifier quoting is left to the caller — every table
 * and column name we use is lower-case/camelCase without keywords, which
 * PostgreSQL folds to lower case consistently in DDL and queries only when
 * unquoted, so raw statements must never quote identifiers.
 */
export function rawQuery<T = unknown>(
  db: DataSource | EntityManager,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const type = ('options' in db ? db.options.type : db.connection.options.type) as string;
  if (type !== 'postgres') return db.query(sql, params) as Promise<T>;
  let i = 0;
  const converted = sql.replace(/\?/g, () => `$${++i}`);
  if (i !== params.length) {
    throw new Error(`rawQuery: ${i} placeholders but ${params.length} params`);
  }
  return db.query(converted, params) as Promise<T>;
}
