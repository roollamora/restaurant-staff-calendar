export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || res.statusText);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const auth = {
  me: () => api("/api/me"),
  login: (username, password) =>
    api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => api("/api/logout", { method: "POST" }),
  changePassword: (currentPassword, newPassword) =>
    api("/api/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const calendar = {
  load: () => api("/api/data"),
  save: (data, version) =>
    api("/api/data", {
      method: "PUT",
      body: JSON.stringify({ data, version }),
    }),
};
