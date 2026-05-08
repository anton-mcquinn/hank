import { apiClient } from "./client";
import type { Customer, CustomerCreate, CustomerUpdate } from "./types";

export const customersApi = {
  async list(): Promise<Customer[]> {
    const { data } = await apiClient.get<Customer[]>("/customers");
    return data;
  },

  async get(id: string): Promise<Customer> {
    const { data } = await apiClient.get<Customer>(`/customers/${id}`);
    return data;
  },

  async create(payload: CustomerCreate): Promise<Customer> {
    const { data } = await apiClient.post<Customer>("/customers", payload);
    return data;
  },

  async update(id: string, payload: CustomerUpdate): Promise<Customer> {
    const { data } = await apiClient.put<Customer>(`/customers/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/customers/${id}`);
  },
};
