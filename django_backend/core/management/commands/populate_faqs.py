"""
Management command to populate FAQ database with initial data
Based on the original TLC BOTG Dronestrike system
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models_faq import FAQ, FAQCategory


class Command(BaseCommand):
    help = 'Populate FAQ database with initial data from the original system'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Populating FAQ database...'))

        # Create categories
        categories_data = [
            {'name': 'Application Process', 'description': 'Questions about applying for tax loans', 'sort_order': 1},
            {'name': 'Loan Coverage', 'description': 'Coverage areas and eligibility', 'sort_order': 2},
            {'name': 'Eligibility', 'description': 'Who qualifies for tax loans', 'sort_order': 3},
            {'name': 'Payment Terms', 'description': 'Payment options and schedules', 'sort_order': 4},
            {'name': 'Financial Information', 'description': 'Interest rates, costs, and fees', 'sort_order': 5},
            {'name': 'Property & Legal', 'description': 'Legal aspects and property liens', 'sort_order': 6},
            {'name': 'Benefits & Savings', 'description': 'Advantages of tax loans', 'sort_order': 7},
            {'name': 'Property Types', 'description': 'Types of properties we finance', 'sort_order': 8},
            {'name': 'Special Situations', 'description': 'Multiple properties and existing loans', 'sort_order': 9},
            {'name': 'County Comparison', 'description': 'How we compare to county payment plans', 'sort_order': 10},
            {'name': 'Credit Reporting', 'description': 'Credit checks and reporting policies', 'sort_order': 11},
        ]

        categories = {}
        for cat_data in categories_data:
            category, created = FAQCategory.objects.get_or_create(
                name=cat_data['name'],
                defaults=cat_data
            )
            categories[cat_data['name']] = category
            if created:
                self.stdout.write(f"Created category: {cat_data['name']}")

        # Create FAQs
        faqs_data = [
            {
                'question': 'How do I apply for a loan?',
                'answer': 'Fill out the form on the right side of this page or call to speak to one of our Loan Officers at 866-PROP-TAX and they will take your application over the phone. This process only takes about 15 minutes.',
                'category': 'Application Process',
                'keywords': 'apply, loan, application, phone, form, 866-PROP-TAX',
                'is_featured': True,
                'sort_order': 1
            },
            {
                'question': 'How long does it take to get a tax loan?',
                'answer': 'It can take anywhere between 2-12 days. In most cases we will send you the loan documents within a week after receiving your application.',
                'category': 'Application Process',
                'keywords': 'time, duration, documents, processing, week',
                'is_featured': True,
                'sort_order': 2
            },
            {
                'question': 'Do I have to come to your office?',
                'answer': 'No. At your choice, we will either send a mobile notary to you, or we will overnight the documents to you and you can take them to a notary for the signing.',
                'category': 'Application Process',
                'keywords': 'office, notary, mobile, documents, signing',
                'sort_order': 3
            },
            {
                'question': 'In what counties do you make tax loans?',
                'answer': 'We make loans to every county in Texas.',
                'category': 'Loan Coverage',
                'keywords': 'counties, texas, coverage, location',
                'is_featured': True,
                'sort_order': 1
            },
            {
                'question': 'Do you check my credit?',
                'answer': 'We do not check credit, and we do not report your loan to a credit reporting agency. We only verify that you have the ability to make your loan payments by asking your monthly income and expenses to be sure that you can afford the monthly loan payments.',
                'category': 'Eligibility',
                'keywords': 'credit, check, report, income, expenses, no credit check',
                'is_featured': True,
                'sort_order': 1
            },
            {
                'question': 'Who is not eligible for a tax loan?',
                'answer': 'If the property is your residence homestead and you are 65 years of age or older or if you have a disability for purposes of payment of disability insurance benefits, you do not need a tax loan. You are eligible to "defer" your taxes on your residence homestead with the county. Call us to discuss the possibility of a deferral at 866-PROP-TAX.',
                'category': 'Eligibility',
                'keywords': 'eligible, homestead, 65, disability, defer, qualify',
                'sort_order': 2
            },
            {
                'question': 'May I pay the loan off early?',
                'answer': 'Yes. There is no prepayment penalty, so you can pay the loan off at any time. For example, if you pay the loan off in 90 days, you would only owe 90 days worth of interest.',
                'category': 'Payment Terms',
                'keywords': 'early, prepayment, penalty, interest, 90 days',
                'is_featured': True,
                'sort_order': 1
            },
            {
                'question': 'May I pay more than my normal payment (and pay the loan off early)?',
                'answer': 'Yes. You are only required to make your minimum monthly payment. You can pay more than your normal monthly payment any time you want to. If you send in more, that additional amount will be applied to your principal loan balance and your loan will be paid off ahead of schedule.',
                'category': 'Payment Terms',
                'keywords': 'extra, payment, principal, early, schedule',
                'sort_order': 2
            },
            {
                'question': 'How long will I have to repay the loan?',
                'answer': 'That is up to you! We have payment plans where you can take up to 10 years repaying your loan. The longer the payment period, the lower the monthly payment will be. Remember there are no prepayment penalties, so you can pay off any of our loans at any time without penalty.',
                'category': 'Payment Terms',
                'keywords': 'repay, 10 years, payment plan, monthly, penalty',
                'sort_order': 3
            },
            {
                'question': 'How do I make my loan payments?',
                'answer': 'Your payments will be due monthly. You may pay by check, money order, cashier\'s check, check by phone, or wire transfer. We can also set up automatic monthly payments from your bank account (ACH) or from your debit card that can be done each month on the day you specify.',
                'category': 'Payment Terms',
                'keywords': 'payments, check, ach, automatic, wire transfer, debit',
                'sort_order': 4
            },
            {
                'question': 'What is the interest rate?',
                'answer': 'The maximum interest rate allowed by law on a tax loan is 18%. Our average interest rate is lower than that. Please contact one of our Loan Officers for current loan rates.',
                'category': 'Financial Information',
                'keywords': 'interest, rate, 18%, maximum, law',
                'is_featured': True,
                'sort_order': 1
            },
            {
                'question': 'What are the costs of getting a tax loan?',
                'answer': 'The closing costs for a loan vary based on the following items: the size of the loan, whether you have a mortgage or not, what type of property you own, the value of your property, etc. The closing costs include all expenses to get the loan such as attorney fees to prepare the loan documents, recording fees, and filing fees with the county. On each loan we verify title and assess the value and the flood plain status of the property. The closing costs are made part of the loan amount so there is no immediate payment required to get the loan.',
                'category': 'Financial Information',
                'keywords': 'costs, closing, attorney, fees, mortgage, value',
                'sort_order': 2
            },
            {
                'question': 'What will be my \'out of pocket\' expenses to get this loan?',
                'answer': 'There are no out-of-pocket expenses. All closing costs are rolled into the loan. You do not have to pay a penny out of your pocket to get the loan. The only out-of-pocket expense is after you have paid off the loan. There is a charge of $110.00 to prepare and file the release of lien.',
                'category': 'Financial Information',
                'keywords': 'out of pocket, expenses, closing costs, release, lien, $110',
                'sort_order': 3
            },
            {
                'question': 'Will there be a lien against my property?',
                'answer': 'Yes. The county already has a tax lien against everyone\'s property beginning January 1. When we pay your tax bill, the county will transfer that tax lien to our company and that is our security for your payment. When you have paid off your loan, we release the lien by filing a release in the county records.',
                'category': 'Property & Legal',
                'keywords': 'lien, property, county, transfer, security, release',
                'sort_order': 1
            },
            {
                'question': 'What happens if I default in paying my tax loan?',
                'answer': 'Under Texas law you will be given notice of the default and the opportunity to cure the default. Foreclosure proceedings could be initiated if the default is not cured. Our policy is to work with you to get caught up on your late or past due payments.',
                'category': 'Property & Legal',
                'keywords': 'default, foreclosure, notice, cure, late, past due',
                'sort_order': 2
            },
            {
                'question': 'How much will I save by getting a tax loan?',
                'answer': 'Though every county is different, county charges for delinquent tax penalties, interest, attorney fees and court costs can range up to 47% of your taxes in the 1st year and 1% each month every year after. The sooner you obtain a tax loan, the more money you save by avoiding the penalties and interest that the county is charging you. More importantly, with a tax loan from us, you will avoid the county foreclosing on your property for non-payment of taxes.',
                'category': 'Benefits & Savings',
                'keywords': 'save, penalties, 47%, county, foreclosure, delinquent',
                'is_featured': True,
                'sort_order': 1
            },
            {
                'question': 'What are the benefits of a tax loan?',
                'answer': '• Saves money by stopping the penalties, interest and legal costs charged by the county.\n• Prevents foreclosure of the property by the county.\n• No credit reporting.\n• Flexible payment plans to fit your budget.\n• Peace of mind.',
                'category': 'Benefits & Savings',
                'keywords': 'benefits, saves, prevents, flexible, peace, mind',
                'is_featured': True,
                'sort_order': 2
            },
            {
                'question': 'What kind of property do you make tax loans on?',
                'answer': 'We make tax loans on all types of real estate including: residential houses, homesteads, rent houses, raw land, commercial buildings, motels, shopping centers, development tracts, duplexes, apartment buildings, farms, ranches, and any other type of real estate.',
                'category': 'Property Types',
                'keywords': 'property, residential, commercial, land, farms, ranches, apartments',
                'sort_order': 1
            },
            {
                'question': 'What if I owe taxes for several years?',
                'answer': 'That is not a problem. In most cases we can make a loan to cover all of the unpaid taxes, penalties, and interest, even if it is for many years worth of tax debt. We can pay current and past year\'s taxes in one loan.',
                'category': 'Special Situations',
                'keywords': 'several years, unpaid, penalties, past, current, debt',
                'sort_order': 1
            },
            {
                'question': 'I have several properties that I owe taxes on. Can I get a loan for all of the taxes that I owe?',
                'answer': 'Yes. We are usually able to pay off all of the tax debt on all of your properties in one loan.',
                'category': 'Special Situations',
                'keywords': 'several properties, multiple, all, debt, one loan',
                'sort_order': 2
            },
            {
                'question': 'If I have a loan with Panacea Lending, may I get another loan for this year\'s taxes?',
                'answer': 'Yes. If you are in good standing, just call one of our Loan Officers to discuss a loan for subsequent year\'s taxes.',
                'category': 'Special Situations',
                'keywords': 'another loan, good standing, subsequent, year',
                'sort_order': 3
            },
            {
                'question': 'What happens if I do not pay my taxes owed to the county?',
                'answer': 'Your tax bill gets bigger and bigger, and at some point the county will foreclose on your property and have it sold at a public auction on the courthouse steps. The county then applies the money from the foreclosure sale to pay the taxes. You can avoid this situation by obtaining a tax loan and paying off the county now.',
                'category': 'County Comparison',
                'keywords': 'county, foreclose, auction, courthouse, avoid',
                'sort_order': 1
            },
            {
                'question': 'What kind of payment plan could I get with the county?',
                'answer': 'Under Texas law, the county may not accept a payment plan that is longer than 3 years and a typical loan is 12 months. We offer loans with terms up to 10 years resulting in a lower monthly payment. One of our Loan Officers can discuss the cost savings with one of our loans.',
                'category': 'County Comparison',
                'keywords': 'county payment plan, 3 years, 12 months, 10 years, savings',
                'sort_order': 2
            },
            {
                'question': 'Will this tax loan go on my credit?',
                'answer': 'We do not report our loans to your credit agencies.',
                'category': 'Credit Reporting',
                'keywords': 'credit, report, agencies, credit report',
                'sort_order': 1
            },
            {
                'question': 'How does a tax loan work?',
                'answer': 'We loan you the money to pay off your tax bill completely (this includes taxes, penalties, interest, attorney fees, etc.). We give you a payment plan to pay us back over a length of time that you choose (from 1-10 years).',
                'category': 'Application Process',
                'keywords': 'how it works, pay off, payment plan, 1-10 years',
                'sort_order': 4
            }
        ]

        # Get admin user for created_by field
        admin_user = User.objects.filter(is_staff=True).first()

        created_count = 0
        for faq_data in faqs_data:
            category = categories[faq_data['category']]
            faq_data['category'] = category
            if admin_user:
                faq_data['created_by'] = admin_user

            faq, created = FAQ.objects.get_or_create(
                question=faq_data['question'],
                defaults=faq_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(f"Created FAQ: {faq_data['question'][:50]}...")

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully populated FAQ database with {created_count} new FAQs across {len(categories)} categories'
            )
        )