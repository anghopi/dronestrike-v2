export interface Target {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone_cell?: string;
  phone_other?: string;
  mailing_address_1: string;
  mailing_address_2?: string;
  mailing_city: string;
  mailing_state: string;
  mailing_county?: string;
  mailing_zip5: string;
  mailing_zip4?: string;
  latitude?: number;
  longitude?: number;
  lead_status: string;
  is_dangerous: boolean;
  is_business: boolean;
  returned_postcard?: boolean;
  has_mortgage?: boolean;
  score_value: number;
  workflow_stage?: string;
  created_at: string;
  last_contact?: string;
  do_not_mail?: boolean;
  do_not_email?: boolean;
  // Property related (if populated)
  property?: {
    account_number?: string;
    improvement_value?: number;
    land_value?: number;
    market_value?: number;
    address_1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}