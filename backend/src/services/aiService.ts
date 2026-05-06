type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type JsonSchemaFormat = {
  type: "json_schema";
  name: string;
  strict: true;
  schema: Record<string, unknown>;
};

const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export function isAiEnabled() {
  return Boolean(openAiApiKey);
}

export function getAiModel() {
  return openAiModel;
}

export async function createStructuredAiResponse<T>({
  system,
  user,
  format,
}: {
  system: string;
  user: string;
  format: JsonSchemaFormat;
}) {
  if (!openAiApiKey) {
    throw new AiDisabledError();
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: user,
        },
      ],
      text: {
        format,
      },
    }),
  });

  if (!response.ok) {
    const message = await readOpenAiError(response);
    throw new Error(message);
  }

  const data = (await response.json()) as OpenAiResponse;
  const outputText = extractOutputText(data);

  if (!outputText) {
    throw new Error("A IA nao retornou uma resposta valida.");
  }

  return JSON.parse(outputText) as T;
}

export class AiDisabledError extends Error {
  constructor() {
    super("IA assistiva desativada. Configure OPENAI_API_KEY no backend para usar este recurso.");
    this.name = "AiDisabledError";
  }
}

async function readOpenAiError(response: Response) {
  try {
    const data = (await response.json()) as {
      error?: {
        message?: string;
      };
    };
    return data.error?.message ?? "Nao foi possivel chamar a OpenAI API.";
  } catch {
    return "Nao foi possivel chamar a OpenAI API.";
  }
}

function extractOutputText(response: OpenAiResponse) {
  if (response.output_text) {
    return response.output_text;
  }

  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return null;
}
