"use server";

import { z } from "zod";
import { applyInternalHeaders, backendUrl } from "@/lib/backend/core";
import type { User } from "@/lib/db/schema";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [user] = await backendJson<User[]>(
      `/internal/users/by-email?email=${encodeURIComponent(validatedData.email)}`
    );

    if (user) {
      return { status: "user_exists" } as RegisterActionState;
    }
    await backendJson("/internal/users", {
      method: "POST",
      body: JSON.stringify({
        email: validatedData.email,
        password: validatedData.password,
      }),
      headers: { "Content-Type": "application/json" },
    });
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

async function backendJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = applyInternalHeaders(new Headers(init?.headers));
  const response = await fetch(backendUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}
