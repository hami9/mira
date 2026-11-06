// اطلاعات ووکامرس یک مشتری که از REST endpoint سفارشی وردپرس واکشی می‌شه
export interface CustomerOrderSummary {
  id: number;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
}

export interface CustomerContextDto {
  status?: 'connected' | 'not-configured' | 'unverified' | 'unavailable' | 'not-found';
  accountRole?: 'administrator' | 'shop_manager' | 'customer' | 'member';
  found: boolean;
  customerName: string | null;
  totalSpent: number;
  currency: string;
  lastOrderStatus: string | null;
  lastOrderDate: string | null;
  recentOrders: CustomerOrderSummary[];
  currentCart: {
    itemsCount: number;
    total: number;
  } | null;
}
