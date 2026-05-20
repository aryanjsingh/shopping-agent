import { auth } from "@/app/(auth)/auth";
import { applyInternalHeaders, backendUrl } from "./core";

type BackendUser = {
  id: string;
  email?: string | null;
};

async function getSharedGuestUser() {
  const headers = applyInternalHeaders(new Headers());
  const response = await fetch(backendUrl("/internal/users/guest"), {
    method: "POST",
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const [guest] = (await response.json()) as BackendUser[];
  return guest;
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true }
) {
  const headers = new Headers(init.headers);

  applyInternalHeaders(headers);

  if (options.auth !== false) {
    const session = await auth();
    if (session?.user?.id) {
      const sharedGuest =
        session.user.type === "guest" ? await getSharedGuestUser() : null;
      headers.set("x-user-id", sharedGuest?.id ?? session.user.id);
      headers.set("x-user-type", session.user.type);
      const email = sharedGuest?.email ?? session.user.email;
      if (email) {
        headers.set("x-user-email", email);
      }
    }
  }

  return fetch(backendUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function proxyToBackend(request: Request, path: string) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const response = await backendFetch(path, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    duplex: "half",
  } as RequestInit);

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-length");
  responseHeaders.delete("content-encoding");
  responseHeaders.set("cache-control", "no-cache, no-transform");

  if (responseHeaders.get("content-type")?.includes("text/event-stream")) {
    responseHeaders.set("x-accel-buffering", "no");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function backendJson<T>(
  path: string,
  init: RequestInit = {},
  options?: { auth?: boolean }
): Promise<T> {
  const response = await backendFetch(path, init, options);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}
