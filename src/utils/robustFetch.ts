/**
 * Robust fetch utility with timeout and standard header defaults
 */
export async function robustFetch(url: string, options: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function safeJsonParse(response: Response, fallbackErrorMessage = 'Failed to parse JSON response'): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${fallbackErrorMessage}: ${text.slice(0, 100)}`);
  }
}
