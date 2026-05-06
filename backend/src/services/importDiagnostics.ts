export function logImportStep(
  step: string,
  details: Record<string, unknown> = {},
) {
  if (process.env.IMPORT_DEBUG !== "true") {
    return;
  }

  console.info(`[import] ${step}`, details);
}

