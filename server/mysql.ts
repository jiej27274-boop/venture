import { createPool, type Pool, type PoolConnection } from "mysql2/promise";

type SqlConnection = Pool | PoolConnection;
type Row = Record<string, unknown>;

export type MySqlError = {
  message: string;
  code?: string;
};

export type MySqlResponse<T> = {
  data: T | null;
  error: MySqlError | null;
  count?: number;
};

type Filter = {
  sql: string;
  values: unknown[];
};

type OrderClause = {
  column: string;
  ascending: boolean;
};

type QueryOperation = "select" | "insert" | "update" | "delete" | "upsert";

const jsonColumns = new Set([
  "roles",
  "focus",
  "industries",
  "detail",
  "payload",
  "metadata",
]);

function assertIdentifier(value: string, label: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid MySQL ${label}: ${value}`);
  }
  return value;
}

function quoteIdentifier(value: string, label = "identifier") {
  return `\`${assertIdentifier(value, label)}\``;
}

function toMysqlDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const iso = date.toISOString();
  return iso.slice(0, 23).replace("T", " ");
}

function toMysqlValue(value: unknown, column?: string) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value) || (typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value))) {
    return JSON.stringify(value);
  }
  if (typeof value === "string" && column && /(?:^|_)at$/.test(column)) {
    return toMysqlDate(value);
  }
  return value;
}

function fromMysqlDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) return value;
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function normalizeRow(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (jsonColumns.has(key) && typeof value === "string") {
      try {
        return [key, JSON.parse(value)];
      } catch {
        return [key, value];
      }
    }
    if (/(?:^|_)at$/.test(key)) return [key, fromMysqlDate(value)];
    return [key, value];
  }));
}

function normalizeRows(rows: Row[]) {
  return rows.map(normalizeRow);
}

function filterClause(filters: Filter[]) {
  if (!filters.length) return { sql: "", values: [] as unknown[] };
  return {
    sql: ` WHERE ${filters.map((filter) => filter.sql).join(" AND ")}`,
    values: filters.flatMap((filter) => filter.values),
  };
}

function parseOrExpression(expression: string): Filter {
  const filters = expression.split(",").map((part) => {
    const [column, operator, ...rawValue] = part.split(".");
    assertIdentifier(column, "filter column");
    const value = rawValue.join(".");
    if (operator === "lte") return { sql: `${quoteIdentifier(column)} <= ?`, values: [toMysqlValue(value, column)] };
    if (operator === "gte") return { sql: `${quoteIdentifier(column)} >= ?`, values: [toMysqlValue(value, column)] };
    if (operator === "eq") return { sql: `${quoteIdentifier(column)} = ?`, values: [toMysqlValue(value, column)] };
    if (operator === "neq") return { sql: `${quoteIdentifier(column)} <> ?`, values: [toMysqlValue(value, column)] };
    if (operator === "not" && value === "is.null") return { sql: `${quoteIdentifier(column)} IS NOT NULL`, values: [] };
    if (operator === "is" && value === "null") return { sql: `${quoteIdentifier(column)} IS NULL`, values: [] };
    throw new Error(`Unsupported MySQL OR filter: ${part}`);
  });
  return {
    sql: `(${filters.map((filter) => filter.sql).join(" OR ")})`,
    values: filters.flatMap((filter) => filter.values),
  };
}

export class MySqlQueryBuilder implements PromiseLike<MySqlResponse<any>> {
  private operation: QueryOperation = "select";
  private payload: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
  private selectedColumns = "*";
  private returnRows = false;
  private countMode = false;
  private headOnly = false;
  private single = false;
  private filters: Filter[] = [];
  private orders: OrderClause[] = [];
  private limitValue: number | null = null;
  private conflictColumns: string[] = [];

  constructor(private readonly connection: SqlConnection, private readonly table: string) {
    assertIdentifier(table, "table");
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.selectedColumns = columns;
    this.returnRows = this.operation !== "select";
    this.countMode = options?.count === "exact";
    this.headOnly = options?.head === true;
    return this;
  }

  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  upsert(payload: Record<string, unknown> | Array<Record<string, unknown>>, options?: { onConflict?: string }) {
    this.operation = "upsert";
    this.payload = payload;
    this.conflictColumns = (options?.onConflict ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ sql: `${quoteIdentifier(column)} ${value === null ? "IS NULL" : "= ?"}`, values: value === null ? [] : [toMysqlValue(value, column)] });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ sql: `${quoteIdentifier(column)} ${value === null ? "IS NOT NULL" : "<> ?"}`, values: value === null ? [] : [toMysqlValue(value, column)] });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ sql: `${quoteIdentifier(column)} > ?`, values: [toMysqlValue(value, column)] });
    return this;
  }

  is(column: string, value: null) {
    if (value !== null) throw new Error("MySQL adapter only supports IS NULL filters");
    this.filters.push({ sql: `${quoteIdentifier(column)} IS NULL`, values: [] });
    return this;
  }

  not(column: string, operator: "is", value: null) {
    if (operator !== "is" || value !== null) throw new Error("MySQL adapter only supports NOT IS NULL filters");
    this.filters.push({ sql: `${quoteIdentifier(column)} IS NOT NULL`, values: [] });
    return this;
  }

  in(column: string, values: unknown[]) {
    assertIdentifier(column, "filter column");
    if (!values.length) {
      this.filters.push({ sql: "1 = 0", values: [] });
      return this;
    }
    this.filters.push({ sql: `${quoteIdentifier(column)} IN (${values.map(() => "?").join(", ")})`, values: values.map((value) => toMysqlValue(value, column)) });
    return this;
  }

  or(expression: string) {
    this.filters.push(parseOrExpression(expression));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.limitValue = Math.max(0, Math.floor(value));
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  private selectSql(columns = this.selectedColumns) {
    const selectList = columns.trim() === "*"
      ? "*"
      : columns.split(",").map((column) => quoteIdentifier(column.trim(), "selected column")).join(", ");
    const where = filterClause(this.filters);
    const order = this.orders.length
      ? ` ORDER BY ${this.orders.map((item) => `${quoteIdentifier(item.column)} ${item.ascending ? "ASC" : "DESC"}`).join(", ")}`
      : "";
    const limit = this.limitValue === null ? "" : ` LIMIT ${this.limitValue}`;
    return { sql: `SELECT ${selectList} FROM ${quoteIdentifier(this.table)}${where.sql}${order}${limit}`, values: where.values };
  }

  private async selectRows(columns = this.selectedColumns) {
    const query = this.selectSql(columns);
    const [rows] = await this.connection.query(query.sql, query.values);
    return normalizeRows(rows as Row[]);
  }

  private payloadRows() {
    const rows = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : [];
    if (!rows.length) throw new Error("MySQL write payload cannot be empty");
    const columns = Object.keys(rows[0]);
    if (!columns.length || rows.some((row) => Object.keys(row).some((column) => !columns.includes(column)))) {
      throw new Error("MySQL write payloads must use the same columns");
    }
    return { rows, columns };
  }

  private async writeSql() {
    const { rows, columns } = this.payloadRows();
    const names = columns.map((column) => quoteIdentifier(column, "write column")).join(", ");
    const values = rows.flatMap((row) => columns.map((column) => toMysqlValue(row[column], column)));
    const placeholders = rows.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    return { names, values, placeholders, columns };
  }

  private async execute(): Promise<MySqlResponse<any>> {
    try {
      if (this.operation === "select") {
        if (this.countMode) {
          const where = filterClause(this.filters);
          const [rows] = await this.connection.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(this.table)}${where.sql}`, where.values);
          const count = Number((rows as Row[])[0]?.count ?? 0);
          if (this.headOnly) return { data: null, error: null, count };
          const data = await this.selectRows();
          return { data, error: null, count };
        }
        const rows = await this.selectRows();
        return { data: this.single ? (rows[0] ?? null) : rows, error: null };
      }

      if (this.operation === "insert" || this.operation === "upsert") {
        const write = await this.writeSql();
        const conflict = this.operation === "upsert" && this.conflictColumns.length
          ? ` ON DUPLICATE KEY UPDATE ${write.columns.filter((column) => !this.conflictColumns.includes(column)).map((column) => `${quoteIdentifier(column)} = VALUES(${quoteIdentifier(column)})`).join(", ") || `${quoteIdentifier(write.columns[0])} = ${quoteIdentifier(write.columns[0])}`}`
          : "";
        await this.connection.query(`INSERT INTO ${quoteIdentifier(this.table)} (${write.names}) VALUES ${write.placeholders}${conflict}`, write.values);
        return { data: null, error: null };
      }

      const where = filterClause(this.filters);
      if (this.operation === "update") {
        const write = await this.writeSql();
        const assignments = write.columns.map((column) => `${quoteIdentifier(column)} = ?`).join(", ");
        const values = write.columns.map((column) => toMysqlValue((this.payload as Record<string, unknown>)[column], column));
        const beforeUpdate = this.returnRows ? await this.selectRows() : null;
        const [result] = await this.connection.query(`UPDATE ${quoteIdentifier(this.table)} SET ${assignments}${where.sql}`, [...values, ...where.values]);
        if (!this.returnRows) return { data: null, error: null };
        const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
        if (!affectedRows || !beforeUpdate?.length) return { data: [], error: null };
        const updatedRows = beforeUpdate.slice(0, affectedRows).map((row) => ({ ...row, ...this.payload }));
        return { data: updatedRows, error: null };
      } else {
        const returning = this.returnRows ? await this.selectRows() : null;
        await this.connection.query(`DELETE FROM ${quoteIdentifier(this.table)}${where.sql}`, where.values);
        return { data: returning, error: null };
      }
    } catch (error) {
      const candidate = error as { message?: string; code?: string };
      return { data: null, error: { message: candidate.message ?? String(error), code: candidate.code } };
    }
  }

  then<TResult1 = MySqlResponse<any>, TResult2 = never>(
    onfulfilled?: ((value: MySqlResponse<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export class MySqlDatabase {
  constructor(readonly connection: SqlConnection) {}

  from(table: string) {
    return new MySqlQueryBuilder(this.connection, table);
  }

  async ping() {
    await this.connection.query("SELECT 1");
  }

  async close() {
    if ("end" in this.connection) await this.connection.end();
  }
}

export type VentureDatabase = MySqlDatabase;

function config() {
  const url = process.env.MYSQL_URL?.trim();
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username || "venture"),
      password: decodeURIComponent(parsed.password || ""),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "venture"),
    };
  }
  return {
    host: process.env.MYSQL_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER?.trim() || "venture",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE?.trim() || "venture",
  };
}

export function mysqlRuntimeStatus() {
  const values = config();
  return {
    configured: Boolean(values.host && values.database && values.user),
    host: values.host,
    port: values.port,
    database: values.database,
    user: values.user,
  };
}

export function createMySqlDatabase() {
  const values = config();
  const connectionLimit = Math.min(Math.max(Number(process.env.MYSQL_CONNECTION_LIMIT ?? 10), 1), 50);
  const pool = createPool({
    host: values.host,
    port: values.port,
    user: values.user,
    password: values.password,
    database: values.database,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    charset: "utf8mb4",
    dateStrings: true,
    timezone: "Z",
  });
  return new MySqlDatabase(pool);
}
