from django.core.management.base import BaseCommand
from core.models import County
from texas_counties import TEXAS_COUNTIES

class Command(BaseCommand):
    help = 'Populate database with Texas counties'

    def handle(self, *args, **options):
        self.stdout.write('Populating Texas counties...')
        
        created_count = 0
        for i, county_data in enumerate(TEXAS_COUNTIES):
            county, created = County.objects.get_or_create(
                name=county_data['name'],
                state=county_data['state'],
                defaults={'fips_code': f'48{i+1:03d}'}  # TX is state code 48
            )
            if created:
                created_count += 1
                self.stdout.write(f'Created: {county.name}, {county.state}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully populated {created_count} new counties. Total: {County.objects.count()}'
            )
        )