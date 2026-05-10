import api from './client';

export interface VehicleReminder {
  id: string;
  title: string;
  body?: string | null;
  photo_url?: string | null;
  created_at: string;
}

const remindersApi = {
  list: (vehicleId: string) =>
    api.get<VehicleReminder[]>(`/vehicles/${vehicleId}/reminders`),

  create: (
    vehicleId: string,
    fields: { title: string; body?: string; photo?: { uri: string; name?: string; type?: string } },
  ) => {
    const formData = new FormData();
    formData.append('title', fields.title);
    if (fields.body) formData.append('body', fields.body);
    if (fields.photo) formData.append('photo', fields.photo as any);
    return api.upload<VehicleReminder>(`/vehicles/${vehicleId}/reminders`, formData);
  },

  remove: (vehicleId: string, reminderId: string) =>
    api.delete<{ message: string }>(`/vehicles/${vehicleId}/reminders/${reminderId}`),
};

export default remindersApi;
