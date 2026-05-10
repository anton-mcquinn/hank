// Export all API modules from a single entry point
import customersApi from './customers';
import vehiclesApi from './vehicles';
import workordersApi from './workorders';
import invoicesApi from './invoices';
import shopApi from './shop';
import mediaApi from './media';
import remindersApi from './reminders';
import { api, ApiError } from './client';

// Re-export type definitions
export * from './types';

// Export the API client and error handler
export { ApiError };

// Bundle all APIs into a single object
const apiClient = {
  customers: customersApi,
  vehicles: vehiclesApi,
  workorders: workordersApi,
  invoices: invoicesApi,
  shop: shopApi,
  media: mediaApi,
  reminders: remindersApi,

  // Include the raw api methods for custom requests
  raw: api
};

export default apiClient;
