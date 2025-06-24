"""
Management command to set up initial mission data
Creates decline reasons and sample devices from Laravel setup
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import MissionDeclineReason, Device, Lead, Property
from decimal import Decimal
import random


class Command(BaseCommand):
    help = 'Set up initial mission data (decline reasons, sample devices, test leads)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-test-data',
            action='store_true',
            help='Create test leads and properties for missions',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Setting up mission data...'))
        
        # Create decline reasons (from Laravel)
        decline_reasons = [
            ('Property not accessible', False, 1),
            ('No one home', False, 2),
            ('Owner refused to talk', False, 3),
            ('Property appears vacant', False, 4),
            ('Incorrect address', False, 5),
            ('Language barrier', False, 6),
            ('Scheduling conflict', False, 7),
            ('Weather conditions', False, 8),
            ('Vehicle breakdown', False, 9),
            ('Equipment malfunction', False, 10),
            ('Safety concern - aggressive dog', True, 11),
            ('Safety concern - hostile neighborhood', True, 12),
            ('Safety concern - suspicious activity', True, 13),
            ('Safety concern - property condition dangerous', True, 14),
            ('Safety concern - personal threat', True, 15),
            ('Emergency situation', True, 16),
        ]
        
        for reason, is_safety, order in decline_reasons:
            decline_reason, created = MissionDeclineReason.objects.get_or_create(
                reason=reason,
                defaults={
                    'is_safety_related': is_safety,
                    'display_order': order,
                    'is_active': True
                }
            )
            if created:
                self.stdout.write(f'Created decline reason: {reason}')
        
        # Create sample devices for testing
        admin_user = User.objects.filter(is_superuser=True).first()
        if admin_user:
            sample_devices = [
                ('BOTG-iPhone-001', 'iPhone 14 Pro', 'ios'),
                ('BOTG-Android-001', 'Samsung Galaxy S23', 'android'),
                ('BOTG-Web-001', 'Chrome Desktop', 'web'),
            ]
            
            for device_id, device_name, device_type in sample_devices:
                device, created = Device.objects.get_or_create(
                    device_id=device_id,
                    user=admin_user,
                    defaults={
                        'device_name': device_name,
                        'device_type': device_type,
                        'is_active': True
                    }
                )
                if created:
                    self.stdout.write(f'Created device: {device_name}')
        
        # Create test data if requested
        if options['create_test_data']:
            self.create_test_data()
        
        self.stdout.write(self.style.SUCCESS('Mission data setup complete!'))
    
    def create_test_data(self):
        """Create test leads and properties for mission testing"""
        self.stdout.write('Creating test leads and properties...')
        
        # Get or create a test user
        test_user, created = User.objects.get_or_create(
            username='botg_agent',
            defaults={
                'email': 'botg@dronestrike.com',
                'first_name': 'BOTG',
                'last_name': 'Agent',
                'is_active': True
            }
        )
        if created:
            test_user.set_password('botg2025')
            test_user.save()
            self.stdout.write('Created test user: botg_agent')
        
        # Sample Texas cities with coordinates
        test_locations = [
            ('Dallas', 'TX', 32.7767, -96.7970),
            ('Austin', 'TX', 30.2672, -97.7431),
            ('Houston', 'TX', 29.7604, -95.3698),
            ('San Antonio', 'TX', 29.4241, -98.4936),
            ('Fort Worth', 'TX', 32.7555, -97.3308),
        ]
        
        # Sample property types and data
        property_types = ['single_family', 'condo', 'townhouse', 'multi_family']
        first_names = ['John', 'Mary', 'Robert', 'Patricia', 'Michael', 'Jennifer', 'William', 'Linda']
        last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']
        
        # Create 25 test leads with properties
        for i in range(25):
            city, state, base_lat, base_lng = random.choice(test_locations)
            
            # Add some random variation to coordinates (within ~5km)
            lat_offset = random.uniform(-0.05, 0.05)
            lng_offset = random.uniform(-0.05, 0.05)
            lat = base_lat + lat_offset
            lng = base_lng + lng_offset
            
            # Create property first
            property_value = random.randint(100000, 800000)
            tax_due = random.randint(2000, 25000)
            
            # Create lead
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            
            lead = Lead.objects.create(
                owner=test_user,
                first_name=first_name,
                last_name=last_name,
                email=f'{first_name.lower()}.{last_name.lower()}@example.com',
                phone_cell=f'({random.randint(100, 999)}) {random.randint(100, 999)}-{random.randint(1000, 9999)}',
                mailing_address_1=f'{random.randint(100, 9999)} {random.choice(["Main", "Oak", "Pine", "Elm", "Cedar"])} {random.choice(["St", "Ave", "Dr", "Ln"])}',
                mailing_city=city,
                mailing_state=state,
                mailing_zip5=f'{random.randint(10000, 99999)}',
                latitude=Decimal(str(lat)),
                longitude=Decimal(str(lng)),
                lead_status=random.choice(['qualified', 'new', 'contacted']),
                score_value=random.randint(50, 100),
                workflow_stage='lead_identified',
                is_dangerous=random.random() < 0.1,  # 10% chance
                is_business=random.random() < 0.05,  # 5% chance
                do_not_email=random.random() < 0.05,  # 5% chance
                do_not_mail=random.random() < 0.03,   # 3% chance
            )
            
            self.stdout.write(f'Created test lead: {first_name} {last_name} in {city}, {state}')
        
        self.stdout.write(self.style.SUCCESS(f'Created {25} test leads for mission testing'))