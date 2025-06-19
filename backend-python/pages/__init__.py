"""Pages package for DroneStrike application."""

from .base import BasePage
from .auth import LoginPage, SignupPage, PasswordRecoveryPage
from .missions import SearchMissionsPage, MyMissionsPage, NewMissionPage
from .tasks import TasksKanbanPage, TasksTablePage
from .opportunities import OpportunitiesPage
from .communications import InboxPage, EmailManagementPage
from .marketing import CampaignManagementPage, MailerCreationPage
from .profile import ProfilePage, BillingPage, PaymentHistoryPage
from .info import FAQPage, NewsPage
from .integrations import GmailIntegrationPage

__all__ = [
    'BasePage',
    'LoginPage', 'SignupPage', 'PasswordRecoveryPage',
    'SearchMissionsPage', 'MyMissionsPage', 'NewMissionPage',
    'TasksKanbanPage', 'TasksTablePage',
    'OpportunitiesPage',
    'InboxPage', 'EmailManagementPage',
    'CampaignManagementPage', 'MailerCreationPage',
    'ProfilePage', 'BillingPage', 'PaymentHistoryPage',
    'FAQPage', 'NewsPage',
    'GmailIntegrationPage'
]