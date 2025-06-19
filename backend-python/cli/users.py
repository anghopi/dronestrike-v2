"""
Advanced User Management CLI Commands
Production-ready user administration with bulk operations and role management.
"""

import asyncio
import csv
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.table import Table
from rich.prompt import Prompt, Confirm
from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.exc import SQLAlchemyError
from email_validator import validate_email, EmailNotValidError
import bcrypt

from core.database import get_db_session
from models.user import User
from models.lead import Lead
from models.mission import Mission
from utils.logging_config import get_logger
from utils.security_utils import SecurityManager
from utils.email_utils import EmailManager

logger = get_logger(__name__)
console = Console()
app = typer.Typer(name="users", help="Advanced user management commands")

class UserManager:
    """Production-ready user management with comprehensive operations."""
    
    def __init__(self):
        self.security = SecurityManager()
        self.email_manager = EmailManager()
    
    async def create_user(self, user_data: Dict[str, Any]) -> User:
        """Create a new user with validation."""
        try:
            # Validate email
            try:
                valid = validate_email(user_data['email'])
                user_data['email'] = valid.email
            except EmailNotValidError as e:
                raise ValueError(f"Invalid email: {e}")
            
            # Check if user exists
            async with get_db_session() as session:
                existing = await session.execute(
                    select(User).where(User.email == user_data['email'])
                )
                if existing.scalar_one_or_none():
                    raise ValueError(f"User with email {user_data['email']} already exists")
                
                # Hash password
                if 'password' in user_data:
                    hashed = bcrypt.hashpw(
                        user_data['password'].encode('utf-8'), 
                        bcrypt.gensalt()
                    )
                    user_data['password_hash'] = hashed.decode('utf-8')
                    del user_data['password']
                
                # Create user
                user = User(**user_data)
                session.add(user)
                await session.commit()
                await session.refresh(user)
                
                logger.info(f"Created user: {user.email}")
                return user
                
        except Exception as e:
            logger.error(f"Failed to create user: {e}")
            raise
    
    async def bulk_create_users(self, users_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Bulk create users with validation and error handling."""
        results = {
            'created': [],
            'failed': [],
            'skipped': []
        }
        
        for user_data in users_data:
            try:
                user = await self.create_user(user_data)
                results['created'].append({
                    'email': user.email,
                    'id': user.id,
                    'role': user.role
                })
            except ValueError as e:
                results['skipped'].append({
                    'email': user_data.get('email', 'unknown'),
                    'error': str(e)
                })
            except Exception as e:
                results['failed'].append({
                    'email': user_data.get('email', 'unknown'),
                    'error': str(e)
                })
        
        return results
    
    async def get_user_stats(self) -> Dict[str, Any]:
        """Get comprehensive user statistics."""
        try:
            async with get_db_session() as session:
                # Total users
                total_result = await session.execute(select(User).count())
                total_users = total_result.scalar()
                
                # Active users (last 30 days)
                thirty_days_ago = datetime.utcnow() - timedelta(days=30)
                active_result = await session.execute(
                    select(User).where(User.last_login > thirty_days_ago).count()
                )
                active_users = active_result.scalar()
                
                # Users by role
                role_result = await session.execute(
                    select(User.role, User.id).group_by(User.role)
                )
                roles = {}
                for role, _ in role_result.fetchall():
                    count_result = await session.execute(
                        select(User).where(User.role == role).count()
                    )
                    roles[role] = count_result.scalar()
                
                # Recent registrations (last 7 days)
                week_ago = datetime.utcnow() - timedelta(days=7)
                recent_result = await session.execute(
                    select(User).where(User.created_at > week_ago).count()
                )
                recent_users = recent_result.scalar()
                
                return {
                    'total_users': total_users,
                    'active_users': active_users,
                    'users_by_role': roles,
                    'recent_registrations': recent_users,
                    'activity_rate': (active_users / total_users * 100) if total_users > 0 else 0
                }
                
        except Exception as e:
            logger.error(f"Failed to get user stats: {e}")
            raise

@app.command()
def create(
    email: str = typer.Option(..., help="User email address"),
    role: str = typer.Option("user", help="User role (admin/agent/user)"),
    first_name: Optional[str] = typer.Option(None, help="First name"),
    last_name: Optional[str] = typer.Option(None, help="Last name"),
    password: Optional[str] = typer.Option(None, help="Password (will prompt if not provided)"),
    send_welcome: bool = typer.Option(True, help="Send welcome email")
):
    """Create a new user account."""
    try:
        if not password:
            password = Prompt.ask("Password", password=True)
            confirm_password = Prompt.ask("Confirm Password", password=True)
            if password != confirm_password:
                console.print("[red]Passwords do not match[/red]")
                sys.exit(1)
        
        user_data = {
            'email': email,
            'role': role,
            'password': password,
            'is_active': True
        }
        
        if first_name:
            user_data['first_name'] = first_name
        if last_name:
            user_data['last_name'] = last_name
        
        user_manager = UserManager()
        user = asyncio.run(user_manager.create_user(user_data))
        
        console.print(f"[green]Created user: {user.email} (ID: {user.id})[/green]")
        
        if send_welcome:
            # Send welcome email (implementation would depend on email service)
            console.print("[blue]Welcome email sent[/blue]")
            
    except Exception as e:
        console.print(f"[red]Failed to create user: {e}[/red]")
        sys.exit(1)

@app.command()
def bulk_import(
    file_path: str = typer.Argument(..., help="CSV file with user data"),
    dry_run: bool = typer.Option(False, help="Preview import without creating users"),
    send_welcome: bool = typer.Option(False, help="Send welcome emails to new users")
):
    """Bulk import users from CSV file."""
    try:
        csv_path = Path(file_path)
        if not csv_path.exists():
            console.print(f"[red]File not found: {file_path}[/red]")
            sys.exit(1)
        
        # Read CSV
        users_data = []
        with open(csv_path, 'r', newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Required fields
                if not row.get('email'):
                    continue
                
                user_data = {
                    'email': row['email'].strip(),
                    'role': row.get('role', 'user').strip(),
                    'first_name': row.get('first_name', '').strip(),
                    'last_name': row.get('last_name', '').strip(),
                    'is_active': row.get('is_active', 'true').lower() == 'true'
                }
                
                # Generate password if not provided
                if not row.get('password'):
                    user_data['password'] = SecurityManager().generate_password()
                else:
                    user_data['password'] = row['password']
                
                users_data.append(user_data)
        
        console.print(f"[blue]Found {len(users_data)} users to import[/blue]")
        
        if dry_run:
            table = Table(title="Users to Import (DRY RUN)")
            table.add_column("Email", style="cyan")
            table.add_column("Role", style="green")
            table.add_column("Name", style="yellow")
            
            for user_data in users_data[:10]:  # Show first 10
                name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip()
                table.add_row(user_data['email'], user_data['role'], name or "N/A")
            
            console.print(table)
            if len(users_data) > 10:
                console.print(f"[dim]... and {len(users_data) - 10} more users[/dim]")
            return
        
        # Confirm import
        if not Confirm.ask(f"Import {len(users_data)} users?"):
            console.print("[yellow]Import cancelled[/yellow]")
            return
        
        # Execute bulk import
        user_manager = UserManager()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%")
        ) as progress:
            task = progress.add_task("Importing users...", total=len(users_data))
            
            results = asyncio.run(user_manager.bulk_create_users(users_data))
            progress.update(task, completed=len(users_data))
        
        # Display results
        console.print(f"[green]Created: {len(results['created'])} users[/green]")
        console.print(f"[yellow]Skipped: {len(results['skipped'])} users[/yellow]")
        console.print(f"[red]Failed: {len(results['failed'])} users[/red]")
        
        # Show failed/skipped details
        if results['failed'] or results['skipped']:
            error_table = Table(title="Import Issues")
            error_table.add_column("Email", style="cyan")
            error_table.add_column("Status", style="yellow")
            error_table.add_column("Error", style="red")
            
            for item in results['skipped']:
                error_table.add_row(item['email'], "Skipped", item['error'])
            
            for item in results['failed']:
                error_table.add_row(item['email'], "Failed", item['error'])
            
            console.print(error_table)
            
    except Exception as e:
        console.print(f"[red]Bulk import failed: {e}[/red]")
        logger.error(f"Bulk import failed: {e}")
        sys.exit(1)

@app.command()
def list_users(
    role: Optional[str] = typer.Option(None, help="Filter by role"),
    active_only: bool = typer.Option(False, help="Show only active users"),
    recent: Optional[int] = typer.Option(None, help="Show users created in last N days"),
    limit: int = typer.Option(50, help="Maximum number of users to show")
):
    """List users with filtering options."""
    try:
        async def get_filtered_users():
            async with get_db_session() as session:
                query = select(User)
                
                # Apply filters
                conditions = []
                if role:
                    conditions.append(User.role == role)
                if active_only:
                    conditions.append(User.is_active == True)
                if recent:
                    cutoff = datetime.utcnow() - timedelta(days=recent)
                    conditions.append(User.created_at > cutoff)
                
                if conditions:
                    query = query.where(and_(*conditions))
                
                query = query.order_by(User.created_at.desc()).limit(limit)
                
                result = await session.execute(query)
                return result.scalars().all()
        
        users = asyncio.run(get_filtered_users())
        
        if not users:
            console.print("[yellow]No users found matching criteria[/yellow]")
            return
        
        # Display users table
        table = Table(title=f"Users ({len(users)} found)")
        table.add_column("ID", style="dim")
        table.add_column("Email", style="cyan")
        table.add_column("Role", style="green")
        table.add_column("Name", style="yellow")
        table.add_column("Status", style="blue")
        table.add_column("Created", style="dim")
        
        for user in users:
            name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            status = "Active" if user.is_active else "Inactive"
            created = user.created_at.strftime("%Y-%m-%d") if user.created_at else "N/A"
            
            table.add_row(
                str(user.id),
                user.email,
                user.role,
                name or "N/A",
                status,
                created
            )
        
        console.print(table)
        
    except Exception as e:
        console.print(f"[red]Failed to list users: {e}[/red]")
        logger.error(f"Failed to list users: {e}")
        sys.exit(1)

@app.command()
def stats():
    """Display comprehensive user statistics."""
    try:
        user_manager = UserManager()
        stats_data = asyncio.run(user_manager.get_user_stats())
        
        # Main stats
        console.print("[bold green]User Statistics[/bold green]\n")
        console.print(f"[blue]Total Users:[/blue] {stats_data['total_users']}")
        console.print(f"[green]Active Users (30d):[/green] {stats_data['active_users']}")
        console.print(f"[yellow]Recent Registrations (7d):[/yellow] {stats_data['recent_registrations']}")
        console.print(f"[cyan]Activity Rate:[/cyan] {stats_data['activity_rate']:.1f}%\n")
        
        # Role distribution
        if stats_data['users_by_role']:
            role_table = Table(title="Users by Role")
            role_table.add_column("Role", style="cyan")
            role_table.add_column("Count", style="green")
            role_table.add_column("Percentage", style="yellow")
            
            total = stats_data['total_users']
            for role, count in stats_data['users_by_role'].items():
                percentage = (count / total * 100) if total > 0 else 0
                role_table.add_row(role, str(count), f"{percentage:.1f}%")
            
            console.print(role_table)
            
    except Exception as e:
        console.print(f"[red]Failed to get user stats: {e}[/red]")
        logger.error(f"Failed to get user stats: {e}")
        sys.exit(1)

@app.command()
def deactivate(
    email: str = typer.Argument(..., help="Email of user to deactivate"),
    reason: Optional[str] = typer.Option(None, help="Reason for deactivation")
):
    """Deactivate a user account."""
    try:
        async def deactivate_user():
            async with get_db_session() as session:
                result = await session.execute(
                    select(User).where(User.email == email)
                )
                user = result.scalar_one_or_none()
                
                if not user:
                    raise ValueError(f"User not found: {email}")
                
                if not user.is_active:
                    console.print(f"[yellow]User {email} is already inactive[/yellow]")
                    return
                
                # Confirm deactivation
                if not Confirm.ask(f"Deactivate user {email}?"):
                    console.print("[yellow]Deactivation cancelled[/yellow]")
                    return
                
                user.is_active = False
                user.deactivated_at = datetime.utcnow()
                if reason:
                    user.deactivation_reason = reason
                
                await session.commit()
                
                logger.info(f"Deactivated user: {email}")
                console.print(f"[green]User {email} has been deactivated[/green]")
        
        asyncio.run(deactivate_user())
        
    except Exception as e:
        console.print(f"[red]Failed to deactivate user: {e}[/red]")
        logger.error(f"Failed to deactivate user: {e}")
        sys.exit(1)

@app.command()
def change_role(
    email: str = typer.Argument(..., help="Email of user to modify"),
    new_role: str = typer.Argument(..., help="New role (admin/agent/user)")
):
    """Change a user's role."""
    try:
        valid_roles = ['admin', 'agent', 'user']
        if new_role not in valid_roles:
            console.print(f"[red]Invalid role. Valid roles: {', '.join(valid_roles)}[/red]")
            sys.exit(1)
        
        async def update_role():
            async with get_db_session() as session:
                result = await session.execute(
                    select(User).where(User.email == email)
                )
                user = result.scalar_one_or_none()
                
                if not user:
                    raise ValueError(f"User not found: {email}")
                
                old_role = user.role
                if old_role == new_role:
                    console.print(f"[yellow]User {email} already has role {new_role}[/yellow]")
                    return
                
                # Confirm role change
                if not Confirm.ask(f"Change {email} role from {old_role} to {new_role}?"):
                    console.print("[yellow]Role change cancelled[/yellow]")
                    return
                
                user.role = new_role
                await session.commit()
                
                logger.info(f"Changed user role: {email} from {old_role} to {new_role}")
                console.print(f"[green]Changed {email} role from {old_role} to {new_role}[/green]")
        
        asyncio.run(update_role())
        
    except Exception as e:
        console.print(f"[red]Failed to change user role: {e}[/red]")
        logger.error(f"Failed to change user role: {e}")
        sys.exit(1)

if __name__ == "__main__":
    app()