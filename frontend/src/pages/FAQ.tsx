import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon as Search, 
  ChevronDownIcon as ChevronDown, 
  ChevronUpIcon as ChevronUp, 
  QuestionMarkCircleIcon as HelpCircle, 
  PhoneIcon as Phone, 
  EnvelopeIcon as Mail, 
  ChatBubbleLeftRightIcon as MessageCircle 
} from '@heroicons/react/24/outline';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
}

const FAQ: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [filteredFAQs, setFilteredFAQs] = useState<FAQItem[]>([]);

  const faqData: FAQItem[] = [
    {
      id: 1,
      question: "How do I apply for a loan?",
      answer: "Fill out the form on the right side of this page or call to speak to one of our Loan Officers at 866-PROP-TAX and they will take your application over the phone. This process only takes about 15 minutes.",
      category: "Application Process",
      keywords: ["apply", "loan", "application", "phone", "form"]
    },
    {
      id: 2,
      question: "How long does it take to get a tax loan?",
      answer: "It can take anywhere between 2-12 days. In most cases we will send you the loan documents within a week after receiving your application.",
      category: "Application Process",
      keywords: ["time", "duration", "documents", "processing"]
    },
    {
      id: 3,
      question: "Do I have to come to your office?",
      answer: "No. At your choice, we will either send a mobile notary to you, or we will overnight the documents to you and you can take them to a notary for the signing.",
      category: "Application Process",
      keywords: ["office", "notary", "mobile", "documents", "signing"]
    },
    {
      id: 4,
      question: "In what counties do you make tax loans?",
      answer: "We make loans to every county in Texas.",
      category: "Loan Coverage",
      keywords: ["counties", "texas", "coverage", "location"]
    },
    {
      id: 5,
      question: "Do you check my credit?",
      answer: "We do not check credit, and we do not report your loan to a credit reporting agency. We only verify that you have the ability to make your loan payments by asking your monthly income and expenses to be sure that you can afford the monthly loan payments.",
      category: "Eligibility",
      keywords: ["credit", "check", "report", "income", "expenses"]
    },
    {
      id: 6,
      question: "Who is not eligible for a tax loan?",
      answer: "If the property is your residence homestead and you are 65 years of age or older or if you have a disability for purposes of payment of disability insurance benefits, you do not need a tax loan. You are eligible to \"defer\" your taxes on your residence homestead with the county. Call us to discuss the possibility of a deferral at 866-PROP-TAX.",
      category: "Eligibility",
      keywords: ["eligible", "homestead", "65", "disability", "defer", "qualify"]
    },
    {
      id: 7,
      question: "May I pay the loan off early?",
      answer: "Yes. There is no prepayment penalty, so you can pay the loan off at any time. For example, if you pay the loan off in 90 days, you would only owe 90 days worth of interest.",
      category: "Payment Terms",
      keywords: ["early", "prepayment", "penalty", "interest"]
    },
    {
      id: 8,
      question: "May I pay more than my normal payment (and pay the loan off early)?",
      answer: "Yes. You are only required to make your minimum monthly payment. You can pay more than your normal monthly payment any time you want to. If you send in more, that additional amount will be applied to your principal loan balance and your loan will be paid off ahead of schedule.",
      category: "Payment Terms",
      keywords: ["extra", "payment", "principal", "early", "schedule"]
    },
    {
      id: 9,
      question: "How long will I have to repay the loan?",
      answer: "That is up to you! We have payment plans where you can take up to 10 years repaying your loan. The longer the payment period, the lower the monthly payment will be. Remember there are no prepayment penalties, so you can pay off any of our loans at any time without penalty.",
      category: "Payment Terms",
      keywords: ["repay", "10 years", "payment plan", "monthly", "penalty"]
    },
    {
      id: 10,
      question: "How do I make my loan payments?",
      answer: "Your payments will be due monthly. You may pay by check, money order, cashier's check, check by phone, or wire transfer. We can also set up automatic monthly payments from your bank account (ACH) or from your debit card that can be done each month on the day you specify.",
      category: "Payment Terms",
      keywords: ["payments", "check", "ach", "automatic", "wire transfer", "debit"]
    },
    {
      id: 11,
      question: "What is the interest rate?",
      answer: "The maximum interest rate allowed by law on a tax loan is 18%. Our average interest rate is lower than that. Please contact one of our Loan Officers for current loan rates.",
      category: "Financial Information",
      keywords: ["interest", "rate", "18%", "maximum", "law"]
    },
    {
      id: 12,
      question: "What are the costs of getting a tax loan?",
      answer: "The closing costs for a loan vary based on the following items: the size of the loan, whether you have a mortgage or not, what type of property you own, the value of your property, etc. The closing costs include all expenses to get the loan such as attorney fees to prepare the loan documents, recording fees, and filing fees with the county. On each loan we verify title and assess the value and the flood plain status of the property. The closing costs are made part of the loan amount so there is no immediate payment required to get the loan.",
      category: "Financial Information",
      keywords: ["costs", "closing", "attorney", "fees", "mortgage", "value"]
    },
    {
      id: 13,
      question: "What will be my 'out of pocket' expenses to get this loan?",
      answer: "There are no out-of-pocket expenses. All closing costs are rolled into the loan. You do not have to pay a penny out of your pocket to get the loan. The only out-of-pocket expense is after you have paid off the loan. There is a charge of $110.00 to prepare and file the release of lien.",
      category: "Financial Information",
      keywords: ["out of pocket", "expenses", "closing costs", "release", "lien", "$110"]
    },
    {
      id: 14,
      question: "Will there be a lien against my property?",
      answer: "Yes. The county already has a tax lien against everyone's property beginning January 1. When we pay your tax bill, the county will transfer that tax lien to our company and that is our security for your payment. When you have paid off your loan, we release the lien by filing a release in the county records.",
      category: "Property & Legal",
      keywords: ["lien", "property", "county", "transfer", "security", "release"]
    },
    {
      id: 15,
      question: "What happens if I default in paying my tax loan?",
      answer: "Under Texas law you will be given notice of the default and the opportunity to cure the default. Foreclosure proceedings could be initiated if the default is not cured. Our policy is to work with you to get caught up on your late or past due payments.",
      category: "Property & Legal",
      keywords: ["default", "foreclosure", "notice", "cure", "late", "past due"]
    },
    {
      id: 16,
      question: "How much will I save by getting a tax loan?",
      answer: "Though every county is different, county charges for delinquent tax penalties, interest, attorney fees and court costs can range up to 47% of your taxes in the 1st year and 1% each month every year after. The sooner you obtain a tax loan, the more money you save by avoiding the penalties and interest that the county is charging you. More importantly, with a tax loan from us, you will avoid the county foreclosing on your property for non-payment of taxes.",
      category: "Benefits & Savings",
      keywords: ["save", "penalties", "47%", "county", "foreclosure", "delinquent"]
    },
    {
      id: 17,
      question: "What are the benefits of a tax loan?",
      answer: "• Saves money by stopping the penalties, interest and legal costs charged by the county.\n• Prevents foreclosure of the property by the county.\n• No credit reporting.\n• Flexible payment plans to fit your budget.\n• Peace of mind.",
      category: "Benefits & Savings",
      keywords: ["benefits", "saves", "prevents", "flexible", "peace", "mind"]
    },
    {
      id: 18,
      question: "What kind of property do you make tax loans on?",
      answer: "We make tax loans on all types of real estate including: residential houses, homesteads, rent houses, raw land, commercial buildings, motels, shopping centers, development tracts, duplexes, apartment buildings, farms, ranches, and any other type of real estate.",
      category: "Property Types",
      keywords: ["property", "residential", "commercial", "land", "farms", "ranches", "apartments"]
    },
    {
      id: 19,
      question: "What if I owe taxes for several years?",
      answer: "That is not a problem. In most cases we can make a loan to cover all of the unpaid taxes, penalties, and interest, even if it is for many years worth of tax debt. We can pay current and past year's taxes in one loan.",
      category: "Special Situations",
      keywords: ["several years", "unpaid", "penalties", "past", "current", "debt"]
    },
    {
      id: 20,
      question: "I have several properties that I owe taxes on. Can I get a loan for all of the taxes that I owe?",
      answer: "Yes. We are usually able to pay off all of the tax debt on all of your properties in one loan.",
      category: "Special Situations",
      keywords: ["several properties", "multiple", "all", "debt", "one loan"]
    },
    {
      id: 21,
      question: "If I have a loan with Panacea Lending, may I get another loan for this year's taxes?",
      answer: "Yes. If you are in good standing, just call one of our Loan Officers to discuss a loan for subsequent year's taxes.",
      category: "Special Situations",
      keywords: ["another loan", "good standing", "subsequent", "year"]
    },
    {
      id: 22,
      question: "What happens if I do not pay my taxes owed to the county?",
      answer: "Your tax bill gets bigger and bigger, and at some point the county will foreclose on your property and have it sold at a public auction on the courthouse steps. The county then applies the money from the foreclosure sale to pay the taxes. You can avoid this situation by obtaining a tax loan and paying off the county now.",
      category: "County Comparison",
      keywords: ["county", "foreclose", "auction", "courthouse", "avoid"]
    },
    {
      id: 23,
      question: "What kind of payment plan could I get with the county?",
      answer: "Under Texas law, the county may not accept a payment plan that is longer than 3 years and a typical loan is 12 months. We offer loans with terms up to 10 years resulting in a lower monthly payment. One of our Loan Officers can discuss the cost savings with one of our loans.",
      category: "County Comparison",
      keywords: ["county payment plan", "3 years", "12 months", "10 years", "savings"]
    },
    {
      id: 24,
      question: "Will this tax loan go on my credit?",
      answer: "We do not report our loans to your credit agencies.",
      category: "Credit Reporting",
      keywords: ["credit", "report", "agencies", "credit report"]
    },
    {
      id: 25,
      question: "How does a tax loan work?",
      answer: "We loan you the money to pay off your tax bill completely (this includes taxes, penalties, interest, attorney fees, etc.). We give you a payment plan to pay us back over a length of time that you choose (from 1-10 years).",
      category: "Application Process",
      keywords: ["how it works", "pay off", "payment plan", "1-10 years"]
    }
  ];

  const categories = ['All', ...Array.from(new Set(faqData.map(faq => faq.category)))];

  useEffect(() => {
    let filtered = faqData;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(faq => faq.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(faq => 
        faq.question.toLowerCase().includes(searchLower) ||
        faq.answer.toLowerCase().includes(searchLower) ||
        faq.keywords.some(keyword => keyword.toLowerCase().includes(searchLower))
      );
    }

    setFilteredFAQs(filtered);
  }, [searchTerm, selectedCategory]);

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const expandAll = () => {
    setExpandedItems(new Set(filteredFAQs.map(faq => faq.id)));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  return (
    <div className="min-h-screen bg-navy-blue text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-blue via-navy-blue-light to-brand-color p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="w-8 h-8 text-brand-color" />
            <h1 className="text-4xl font-bold text-white">Frequently Asked Questions</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl">
            Get answers to the most common questions about our tax loan services, application process, and benefits.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="enhanced-card p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-military pl-10 w-full"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-military min-w-[200px]"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            {/* Expand/Collapse All */}
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Results Count */}
          <div className="text-sm text-gray-400 mb-4">
            {filteredFAQs.length} question{filteredFAQs.length !== 1 ? 's' : ''} found
            {selectedCategory !== 'All' && ` in ${selectedCategory}`}
            {searchTerm && ` matching "${searchTerm}"`}
          </div>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFAQs.map((faq) => (
            <div key={faq.id} className="enhanced-card overflow-hidden">
              <button
                onClick={() => toggleExpanded(faq.id)}
                className="w-full p-6 text-left flex items-start justify-between hover:bg-navy-blue-light transition-all duration-200"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2 pr-4">
                    {faq.question}
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="status-badge bg-brand-color/20 text-brand-color text-xs">
                      {faq.category}
                    </span>
                    {!expandedItems.has(faq.id) && (
                      <p className="text-gray-400 text-sm line-clamp-2">
                        {faq.answer.substring(0, 120)}...
                      </p>
                    )}
                  </div>
                </div>
                <div className="ml-4 mt-1">
                  {expandedItems.has(faq.id) ? (
                    <ChevronUp className="w-5 h-5 text-brand-color" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedItems.has(faq.id) && (
                <div className="px-6 pb-6 border-t border-gray-700">
                  <div className="pt-4">
                    <div className="prose prose-invert max-w-none">
                      <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredFAQs.length === 0 && (
            <div className="enhanced-card p-12 text-center">
              <HelpCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No FAQs Found</h3>
              <p className="text-gray-500">
                Try adjusting your search terms or selecting a different category.
              </p>
            </div>
          )}
        </div>

        {/* Contact Section */}
        <div className="enhanced-card p-8 mt-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Still Have Questions?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-brand-color rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-2">Call Us</h3>
              <p className="text-gray-400 mb-2">Speak to one of our Loan Officers</p>
              <a href="tel:866-776-7829" className="text-brand-color hover:text-brand-color-light transition-colors">
                866-PROP-TAX
              </a>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-brand-color rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-2">Email Us</h3>
              <p className="text-gray-400 mb-2">Get detailed answers via email</p>
              <a href="mailto:info@panacealending.com" className="text-brand-color hover:text-brand-color-light transition-colors">
                info@panacealending.com
              </a>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-brand-color rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-2">Live Chat</h3>
              <p className="text-gray-400 mb-2">Chat with our support team</p>
              <button className="text-brand-color hover:text-brand-color-light transition-colors">
                Start Chat
              </button>
            </div>
          </div>

          <div className="mt-8 p-4 bg-navy-blue-light rounded-lg">
            <p className="text-center text-gray-300">
              <strong>Business Hours:</strong> Monday - Friday, 8:00 AM - 6:00 PM CST
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;