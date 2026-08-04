import { afterEach, describe, expect, it } from "vitest";
import { MySqlDatabase } from "./mysql.ts";
import { emailDeliveryStatus } from "./email.ts";

type QueryResult = [unknown, unknown];

function fakeConnection(affectedRows: number) {
  const calls: string[] = [];
  return {
    calls,
    async query(sql: string) {
      calls.push(sql);
      if (sql.startsWith("SELECT")) return [[{ legacy_id: "otp-1", consumed_at: null }], []] as QueryResult;
      return [{ affectedRows }, []] as QueryResult;
    },
  };
}

const originalNodeEnv = process.env.NODE_ENV;
const originalEmailProvider = process.env.EMAIL_PROVIDER;

afterEach(() => {
  if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  if (originalEmailProvider === undefined) Reflect.deleteProperty(process.env, "EMAIL_PROVIDER");
  else Object.assign(process.env, { EMAIL_PROVIDER: originalEmailProvider });
});

describe("email OTP delivery and MySQL one-time update behavior", () => {
  it("returns the consumed row when the conditional update changes one row", async () => {
    const connection = fakeConnection(1);
    const result = await new MySqlDatabase(connection as unknown as ConstructorParameters<typeof MySqlDatabase>[0]).from("venture_email_otps")
      .update({ consumed_at: "2026-08-04T00:00:00.000Z" })
      .eq("legacy_id", "otp-1")
      .is("consumed_at", null)
      .select("legacy_id");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ legacy_id: "otp-1", consumed_at: "2026-08-04T00:00:00.000Z" }]);
    expect(connection.calls[0]).toContain("SELECT");
    expect(connection.calls[1]).toContain("UPDATE");
  });

  it("returns no row when the conditional update did not consume the OTP", async () => {
    const connection = fakeConnection(0);
    const result = await new MySqlDatabase(connection as unknown as ConstructorParameters<typeof MySqlDatabase>[0]).from("venture_email_otps")
      .update({ consumed_at: "2026-08-04T00:00:00.000Z" })
      .eq("legacy_id", "otp-1")
      .is("consumed_at", null)
      .select("legacy_id");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("uses preview only outside production and requires a real provider in production", () => {
    Reflect.deleteProperty(process.env, "EMAIL_PROVIDER");
    Object.assign(process.env, { NODE_ENV: "development" });
    expect(emailDeliveryStatus()).toEqual({ provider: "preview", configured: true });

    Object.assign(process.env, { NODE_ENV: "production" });
    expect(emailDeliveryStatus()).toEqual({ provider: "smtp", configured: false });
  });
});
