const TOKEN_KEY = "rsc_token";

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
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
  login: async (username, password) => {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(result.token);
    return result;
  },
  logout: async () => {
    try {
      await api("/api/logout", { method: "POST" });
    } finally {
      setToken(null);
    }
  },
  changePassword: (currentPassword, newPassword) =>
    api("/api/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  listUsers: () => api("/api/users"),
  addUser: (username, displayName, password) =>
    api("/api/users", {
      method: "POST",
      body: JSON.stringify({ username, displayName, password }),
    }),
  removeUser: (id) => api(`/api/users/${id}`, { method: "DELETE" }),
};

export const calendar = {
  load: () => api("/api/data"),
  save: (data, version) =>
    api("/api/data", {
      method: "PUT",
      body: JSON.stringify({ data, version }),
    }),
};
