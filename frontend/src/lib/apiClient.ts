const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  let body = options.body;

  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
      body,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? `Nao foi possivel conectar ao backend: ${error.message}`
        : "Nao foi possivel conectar ao backend.";
    throw new ApiError(message, 0);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? "Nao foi possivel concluir a requisicao.";
  } catch {
    return "Nao foi possivel concluir a requisicao.";
  }
}
