import { api } from './client';

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url?: string | null;
}

const shopApi = {
  getSettings: () => api.get<ShopSettings>('/shop/settings'),
  updateSettings: (data: Partial<ShopSettings>) => api.put<ShopSettings>('/shop/settings', data),
  uploadLogo: (file: any) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.upload<ShopSettings>('/shop/logo', formData);
  },
  deleteLogo: () => api.delete<ShopSettings>('/shop/logo'),
};

export default shopApi;
