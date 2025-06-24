export interface Mission {
  id: number;
  target: {
    name: string;
    address: string;
    phone?: string;
    notes?: string;
    is_dangerous: boolean;
  };
  status: 'assigned' | 'en_route' | 'on_site' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_duration: number;
  assigned_at: string;
  deadline: string;
  distance?: number;
}