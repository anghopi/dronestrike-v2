from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import TLCClient, TLCClientAddress, TLCTaxInfo, TLCPropertyValuation
import random
from datetime import datetime, timedelta
import json

class Command(BaseCommand):
    help = 'Populate TLC Client sample data for reporting and analytics'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=50, help='Number of clients to create')

    def handle(self, *args, **options):
        count = options['count']
        self.stdout.write(f'Creating {count} TLC clients with sample data...')

        # Import all 254 Texas counties
        from all_texas_counties import ALL_TEXAS_COUNTIES
        texas_counties = list(ALL_TEXAS_COUNTIES.keys())

        # Sample names
        first_names = [
            'James', 'John', 'Robert', 'Michael', 'David', 'William', 'Richard', 'Joseph',
            'Thomas', 'Christopher', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth',
            'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Helen'
        ]
        
        last_names = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
            'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
            'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White'
        ]

        # Use the comprehensive county-city mapping
        county_cities = ALL_TEXAS_COUNTIES

        # Default cities for any edge cases
        default_cities = ['Spring', 'Katy', 'Cypress', 'Tomball', 'Humble', 'Conroe', 'Magnolia']

        lead_sources = ['Website', 'Referral', 'Cold Call', 'Email Campaign', 'Social Media', 'Direct Mail']
        agents = ['Sarah Johnson', 'Mike Rodriguez', 'Lisa Chen', 'David Williams', 'Maria Garcia']

        for i in range(count):
            # Basic client info
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            county = random.choice(texas_counties)
            city = random.choice(county_cities.get(county, default_cities))
            
            # Generate unique client number
            while True:
                client_number = f"TLC{random.randint(10000, 99999)}"
                if not TLCClient.objects.filter(client_number=client_number).exists():
                    break
            
            # Create client
            client = TLCClient.objects.create(
                client_number=client_number,
                first_name=first_name,
                last_name=last_name,
                email=f"{first_name.lower()}.{last_name.lower()}@email.com",
                phone_primary=f"({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}",
                status=random.choice(['prospect', 'lead', 'applicant', 'client', 'inactive']),
                workflow_stage=random.choice(['initial_contact', 'qualification', 'application_review', 'underwriting', 'loan_approval', 'funding', 'servicing']),
                lead_source=random.choice(lead_sources),
                assigned_agent=random.choice(agents),
                last_contact=timezone.now() - timedelta(days=random.randint(1, 30)),
                last_activity=timezone.now() - timedelta(days=random.randint(1, 15))
            )

            # Create property address
            TLCClientAddress.objects.create(
                client=client,
                address_type='property',
                street_1=f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm', 'Park', 'First', 'Second', 'Third'])} {random.choice(['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Rd'])}",
                city=city,
                state='TX',
                zip_code=f"{random.randint(70000, 79999)}",
                county=county
            )

            # Create mailing address (sometimes same, sometimes different)
            if random.choice([True, False]):
                # Same as property
                TLCClientAddress.objects.create(
                    client=client,
                    address_type='mailing',
                    street_1=f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm', 'Park', 'First', 'Second', 'Third'])} {random.choice(['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Rd'])}",
                    city=city,
                    state='TX',
                    zip_code=f"{random.randint(70000, 79999)}",
                    county=county
                )

            # Create tax info
            original_amount = random.randint(500, 50000)
            penalties = original_amount * random.uniform(0.1, 0.5)
            total_due = original_amount + penalties
            
            TLCTaxInfo.objects.create(
                client=client,
                account_number=f"TX{random.randint(100000, 999999)}",
                tax_year=random.randint(2019, 2024),
                original_tax_amount=original_amount,
                penalties_interest=penalties,
                total_amount_due=total_due,
                tax_sale_date=timezone.now() + timedelta(days=random.randint(30, 365)) if random.choice([True, False]) else None,
                lawsuit_status=random.choice(['None', 'Filed', 'Pending', 'Settled']) if random.choice([True, False]) else None,
                attorney_fees=random.randint(500, 5000) if random.choice([True, False]) else 0
            )

            # Create property valuation
            market_total = random.randint(50000, 500000)
            assessed_total = market_total * random.uniform(0.7, 0.9)
            
            TLCPropertyValuation.objects.create(
                client=client,
                assessed_land_value=assessed_total * random.uniform(0.2, 0.4),
                assessed_improvement_value=assessed_total * random.uniform(0.6, 0.8),
                assessed_total_value=assessed_total,
                market_land_value=market_total * random.uniform(0.2, 0.4),
                market_improvement_value=market_total * random.uniform(0.6, 0.8),
                market_total_value=market_total,
                estimated_purchase_price=market_total * random.uniform(0.8, 1.2) if random.choice([True, False]) else None
            )

            if (i + 1) % 10 == 0:
                self.stdout.write(f'Created {i + 1} clients...')

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {count} TLC clients with sample data!')
        )