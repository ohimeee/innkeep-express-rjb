const API_BASE = 'http://localhost:3000/api';

// There is no register here on purpose: staff accounts are made through the
// API, not from the site.
export const login = async (username: string, password: string): Promise<{ token: string }> => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    // The API's own reason when it gives one — Zod's "Username must be at
    // least 3 characters" says more than a generic failure.
    const body = await response.json().catch(() => ({}));
    throw new Error(body.details?.[0]?.message ?? body.error ?? 'Invalid credentials');
  }
  return response.json();
}
