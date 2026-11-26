import { createHash, timingSafeEqual } from "crypto";

/** アクセスコード（環境変数 ACCESS_CODE）の確認。本番で未設定のときは、データを守るためAPIを使えなくする */
export function authorize(req: Request): "ok" | "denied" | "unset" {
  const code = process.env.ACCESS_CODE;
  if (!code) return process.env.NODE_ENV === "production" ? "unset" : "ok";
  const got = req.headers.get("x-access-code") || "";
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(code).digest();
  return timingSafeEqual(a, b) ? "ok" : "denied";
}
