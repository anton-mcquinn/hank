// API Types based on backend models

// Customer types
export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
}

export interface CustomerUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

// Vehicle types
export interface Vehicle {
  id: string;
  customer_id: string;
  vin?: string;
  plate?: string;
  year?: number;
  make?: string;
  model?: string;
  engine_code?: string;
  engine_size?: string;
  mileage?: number;
  created_at: string;
  updated_at: string;
}

export interface VehicleCreate {
  customer_id: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  mileage?: number;
}

export interface VehicleUpdate {
  customer_id?: string;
  vin?: string;
  plate?: string;
  year?: number;
  make?: string;
  model?: string;
  engine_code?: string;
  engine_size?: string;
  mileage?: number;
}

// Line Item type
export interface LineItem {
  description: string;
  type: 'part' | 'labor';
  quantity: number;
  unit_price: number;
  total: number;
}

// Work Order types
export interface WorkOrder {
  id: string;
  work_order_number?: number;
  customer_id?: string;
  vehicle_id?: string;
  vehicle_info: Record<string, any>;
  work_summary: string;
  line_items: LineItem[];
  total_parts: number;
  total_labor: number;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  vehicle?: Vehicle;
}

export interface WorkOrderUpdate {
  customer_id?: string;
  vehicle_id?: string;
  vehicle_info?: Record<string, any>;
  work_summary?: string;
  line_items?: LineItem[];
  total_parts?: number;
  total_labor?: number;
  total?: number;
  status?: string;
}

// Form data for work order creation with file uploads
export interface WorkOrderCreateFormData {
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  vehicle_id?: string;
  audio_files?: File[];
  vin_image?: File;
  odometer_image?: File;
}

// Invoice Generation types
export interface EmailRequest {
  email?: string;
  generate_pdf: boolean;
  send_email: boolean;
}

export interface InvoiceResponse {
  status: string;
  html_content: string;
  html_path: string;
  pdf_path?: string;
  email_status?: string;
  message?: string;
}
