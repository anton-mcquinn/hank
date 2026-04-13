import { api } from './client';

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

const shopApi = {
  getSettings: () => api.get<ShopSettings>('/shop/settings'),
  updateSettings: (data: Partial<ShopSettings>) => api.put<ShopSettings>('/shop/settings', data),
};

export default shopApi;
