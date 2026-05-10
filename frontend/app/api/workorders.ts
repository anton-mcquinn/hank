import api from './client';
import { WorkOrder, WorkOrderUpdate, WorkOrderCreateFormData } from './types';

const workordersApi = {
  /**
   * Get all work orders
   */
  getAll: () => {
    return api.get<WorkOrder[]>('/work-orders');
  },

  /**
   * Get a work order by ID
   */
  getById: (id: string) => {
    return api.get<WorkOrder>(`/work-orders/${id}`);
  },

  /**
   * Get all work orders for a customer
   */
  getByCustomer: (customerId: string) => {
    return api.get<WorkOrder[]>(`/customers/${customerId}/work-orders`);
  },

  /**
   * Create a new work order with file uploads
   */
  create: (data: WorkOrderCreateFormData) => {
    // Create a FormData instance for multipart/form-data uploads
    const formData = new FormData();
    
    // Add text fields
    if (data.customer_id) formData.append('customer_id', data.customer_id);
    if (data.customer_name) formData.append('customer_name', data.customer_name);
    if (data.customer_phone) formData.append('customer_phone', data.customer_phone);
    if (data.customer_email) formData.append('customer_email', data.customer_email);
    if (data.vehicle_id) formData.append('vehicle_id', data.vehicle_id);
    if (data.transcript && data.transcript.trim()) formData.append('transcript', data.transcript.trim());
    
    // Add audio files
    if (data.audio_files) {
      data.audio_files.forEach(file => {
        formData.append('audio_files', file);
      });
    }
    
    // Add images
    if (data.vin_image) formData.append('vin_image', data.vin_image);
    if (data.odometer_image) formData.append('odometer_image', data.odometer_image);
    if (data.plate_image) formData.append('plate_image', data.plate_image);
    
    // Use the upload method which is designed for FormData
    return api.upload<{ order_id: string; message: string }>('/work-orders/create', formData);
  },

  /**
   * Update a work order
   */
  update: (id: string, workOrder: WorkOrderUpdate) => {
    return api.put<WorkOrder>(`/work-orders/${id}`, workOrder);
  },

  /**
   * Delete a work order
   */
  delete: (id: string) => {
    return api.delete<{ message: string }>(`/work-orders/${id}`);
  },
};

export default workordersApi;
