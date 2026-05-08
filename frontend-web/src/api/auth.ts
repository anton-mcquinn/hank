import { apiClient } from "./client";
import type { Token, User } from "./types";

export const authApi = {
  async login(username: string, password: string): Promise<Token> {
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);
    const { data } = await apiClient.post<Token>("/auth/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },
};
