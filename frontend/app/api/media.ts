import api from './client';

export interface MediaAsset {
  id: string;
  kind: string;
  content_type?: string | null;
  caption?: string | null;
  url: string;
  created_at: string;
}

const buildPhotoForm = (asset: { uri: string; name?: string; type?: string }, caption?: string, kind?: string) => {
  const formData = new FormData();
  formData.append('photo', asset as any);
  if (caption) formData.append('caption', caption);
  if (kind) formData.append('kind', kind);
  return formData;
};

const mediaApi = {
  // Work order photos
  listWorkOrderPhotos: (orderId: string) =>
    api.get<MediaAsset[]>(`/work-orders/${orderId}/photos`),

  uploadWorkOrderPhoto: (
    orderId: string,
    asset: { uri: string; name?: string; type?: string },
    caption?: string,
    kind: string = 'general',
  ) => api.upload<MediaAsset>(`/work-orders/${orderId}/photos`, buildPhotoForm(asset, caption, kind)),

  // Shared delete (work-order photos use this; vehicle reminders have their own delete route)
  remove: (assetId: string) => api.delete<{ message: string }>(`/media-assets/${assetId}`),
};

export default mediaApi;
