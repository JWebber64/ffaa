import { briefResponse } from "./handler";
import { footballBrief } from "./footballProvider";
import { footballBriefStore } from "./footballStore";
interface ApiRequest { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; }
interface ApiResponse { setHeader(name: string, value: string): void; status(code: number): ApiResponse; send(value: string): void; }
export default async function handler(request: ApiRequest, response: ApiResponse) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) if (typeof value === "string") headers.set(name, value);
  const url = new URL(request.url ?? "/api/daily-brief", "https://gamehqhub.com");
  const result = await briefResponse(new Request(url, { method: request.method ?? "GET", headers }), {
    store: () => footballBriefStore(headers.get("x-vercel-oidc-token") ?? undefined), provider: footballBrief,
  });
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.status(result.status).send(await result.text());
}
