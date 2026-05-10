import api from './client';
import { EmailRequest, InvoiceResponse } from './types';

const invoicesApi = {
  /**
   * Generate an invoice for a work order
   */
  generateInvoice: (orderId: string, options: EmailRequest) => {
    return api.post<InvoiceResponse>(`/work-orders/${orderId}/generate-invoice`, options);
  },

  /**
   * Generate an estimate for a work order
   */
  generateEstimate: (orderId: string, options: EmailRequest) => {
    return api.post<InvoiceResponse>(`/work-orders/${orderId}/generate-estimate`, options);
  },

  /**
   * Get a fresh presigned URL for an already-generated invoice (no re-render).
   */
  getInvoiceUrl: (orderId: string) => {
    return api.get<{ url: string }>(`/work-orders/${orderId}/invoice-url`);
  },

  /**
   * Get a fresh presigned URL for an already-generated estimate (no re-render).
   */
  getEstimateUrl: (orderId: string) => {
    return api.get<{ url: string }>(`/work-orders/${orderId}/estimate-url`);
  },
};

export default invoicesApi;
