#!/usr/bin/env python3
"""
DroneStrike v2 CLI Command Center
Production-ready command-line interface for comprehensive system management.
"""

import sys
import asyncio
from pathlib import Path
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.columns import Columns
from rich import box

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from cli.database import app as database_app
from cli.users import app as users_app
from cli.backup import app as backup_app
from cli.maintenance import app as maintenance_app
from cli.development import app as development_app
from cli.testing import app as testing_app
from cli.monitoring import app as monitoring_app
from utils.logging_config import get_logger

logger = get_logger(__name__)
console = Console()

# Main CLI application
app = typer.Typer(
    name="dronestrike",
    help="DroneStrike v2 CLI",
    add_completion=False,
    rich_markup_mode="rich"
)

# Add sub-commands
app.add_typer(database_app, name="db", help=" Database management commands")
app.add_typer(users_app, name="users", help=" User management commands")
app.add_typer(backup_app, name="backup", help=" Backup and restore commands")
app.add_typer(maintenance_app, name="maintenance", help=" System maintenance commands")
app.add_typer(development_app, name="dev", help=" Development tools and utilities")
app.add_typer(testing_app, name="test", help=" Testing and validation commands")
app.add_typer(monitoring_app, name="monitor", help=" Monitoring and metrics commands")

@app.command()
def version():
    """Display version information."""
    try:
        version_file = Path(__file__).parent.parent / "VERSION"
        if version_file.exists():
            version = version_file.read_text().strip()
        else:
            version = "2.0.0"
        
        build_time_file = Path(__file__).parent.parent / "BUILD_TIME"
        if build_time_file.exists():
            build_time = build_time_file.read_text().strip()
        else:
            build_time = "Unknown"
        
        console.print(Panel.fit(
            f"[bold green]DroneStrike v2 CLI[/bold green]\n"
            f"[blue]Version:[/blue] {version}\n"
            f"[blue]Build Time:[/blue] {build_time}\n"
            f"[blue]Python:[/blue] {sys.version.split()[0]}\n"
            f"[blue]Platform:[/blue] {sys.platform}",
            title="Version Info",
            border_style="green"
        ))
        
    except Exception as e:
        console.print(f"[red]Error getting version info: {e}[/red]")

@app.command()
def status():
    """Display system status"""
    console.print("[bold green]DroneStrike v2 System Status[/bold green]\n")
    
    try:
        from utils.monitoring_utils import MetricsCollector
        from core.database import engine
        import redis
        import os
        
        metrics = MetricsCollector()
        health_data = metrics.health_check()
        
        # System Health Panel
        status_color = "green" if health_data['status'] == 'healthy' else "red"
        system_panel = Panel(
            f"[{status_color}]Status:[/{status_color}] {health_data['status'].upper()}\n"
            f"[blue]CPU:[/blue] {health_data['system']['cpu_percent']:.1f}%\n"
            f"[blue]Memory:[/blue] {health_data['system']['memory_percent']:.1f}%\n"
            f"[blue]Disk:[/blue] {health_data['system']['disk_percent']:.1f}%",
            title="System Health",
            border_style=status_color
        )
        
        # Application Stats Panel
        app_panel = Panel(
            f"[blue]Requests:[/blue] {health_data['application']['request_count']}\n"
            f"[blue]Errors:[/blue] {health_data['application']['error_count']}\n"
            f"[blue]Avg Response:[/blue] {health_data['application']['avg_response_time']:.2f}s",
            title="Application Stats",
            border_style="blue"
        )
        
        # Services Status
        services = []
        
        # Check database
        try:
            async def check_db():
                async with engine.begin() as conn:
                    await conn.execute("SELECT 1")
                return True
            
            db_status = "Connected" if asyncio.run(check_db()) else "Failed"
        except:
            db_status = " Failed"
        
        # Check Redis
        try:
            r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
            r.ping()
            redis_status = "Connected"
        except:
            redis_status = "Failed"
        
        services_panel = Panel(
            f"[blue]Database:[/blue] {db_status}\n"
            f"[blue]Redis:[/blue] {redis_status}\n"
            f"[blue]Celery:[/blue] ⏳ Checking...",
            title="Services",
            border_style="cyan"
        )
        
        # Display panels
        console.print(Columns([system_panel, app_panel, services_panel]))
        
        # Issues
        if health_data.get('issues'):
            issues_table = Table(title="Issues", border_style="red")
            issues_table.add_column("Issue", style="red")
            
            for issue in health_data['issues']:
                issues_table.add_row(issue)
            
            console.print("\n")
            console.print(issues_table)
        
    except Exception as e:
        console.print(f"[red]Error getting system status: {e}[/red]")
        logger.error(f"Status command failed: {e}")

@app.command()
def help_commands():
    """Display help for all available commands"""
    console.print(Panel.fit(
        "[bold green]DroneStrike v2 CLI Commands[/bold green]\n\n"
        "[bold blue]Database Management:[/bold blue]\n"
        "  • [cyan]db info[/cyan] - Display database information\n"
        "  • [cyan]db migrate up/down[/cyan] - Run database migrations\n"
        "  • [cyan]db backup[/cyan] - Create database backup\n"
        "  • [cyan]db restore[/cyan] - Restore from backup\n"
        "  • [cyan]db optimize[/cyan] - Optimize database performance\n"
        "  • [cyan]db monitor[/cyan] - Real-time database monitoring\n\n"
        
        "[bold blue]User Management:[/bold blue]\n"
        "  • [cyan]users create[/cyan] - Create new user account\n"
        "  • [cyan]users list[/cyan] - List users with filters\n"
        "  • [cyan]users bulk-import[/cyan] - Import users from CSV\n"
        "  • [cyan]users stats[/cyan] - Display user statistics\n"
        "  • [cyan]users deactivate[/cyan] - Deactivate user account\n"
        "  • [cyan]users change-role[/cyan] - Change user role\n\n"
        
        "[bold blue]System Maintenance:[/bold blue]\n"
        "  • [cyan]maintenance cleanup[/cyan] - Clean up old data\n"
        "  • [cyan]maintenance health[/cyan] - System health check\n"
        "  • [cyan]maintenance logs[/cyan] - Manage log files\n"
        "  • [cyan]maintenance cache[/cyan] - Cache management\n\n"
        
        "[bold blue]Monitoring:[/bold blue]\n"
        "  • [cyan]monitor dashboard[/cyan] - Real-time dashboard\n"
        "  • [cyan]monitor metrics[/cyan] - Export metrics\n"
        "  • [cyan]monitor alerts[/cyan] - Alert management\n\n"
        
        "[bold blue]Development:[/bold blue]\n"
        "  • [cyan]dev seed[/cyan] - Seed development data\n"
        "  • [cyan]dev shell[/cyan] - Interactive development shell\n"
        "  • [cyan]dev mock[/cyan] - Generate mock data\n\n"
        
        "[bold blue]Testing:[/bold blue]\n"
        "  • [cyan]test run[/cyan] - Run test suites\n"
        "  • [cyan]test integration[/cyan] - Integration tests\n"
        "  • [cyan]test performance[/cyan] - Performance tests\n\n"
        
        "[bold blue]Backup & Restore:[/bold blue]\n"
        "  • [cyan]backup create[/cyan] - Create system backup\n"
        "  • [cyan]backup restore[/cyan] - Restore from backup\n"
        "  • [cyan]backup list[/cyan] - List available backups\n"
        "  • [cyan]backup schedule[/cyan] - Manage backup schedules",
        title="Available Commands",
        border_style="green"
    ))

@app.command()
def quick_start():
    """Quick start guide for new installations"""
    console.print(Panel.fit(
        "[bold green]DroneStrike v2 Quick Start Guide[/bold green]\n\n"
        "[bold blue]1. Initial Setup:[/bold blue]\n"
        "   [cyan]./cli.py db migrate up[/cyan] - Run database migrations\n"
        "   [cyan]./cli.py users create --email admin@example.com --role admin[/cyan] - Create admin user\n\n"
        
        "[bold blue]2. Development Setup:[/bold blue]\n"
        "   [cyan]./cli.py dev seed[/cyan] - Create sample data\n"
        "   [cyan]./cli.py test run[/cyan] - Verify installation\n\n"
        
        "[bold blue]3. Production Setup:[/bold blue]\n"
        "   [cyan]./cli.py backup create[/cyan] - Create initial backup\n"
        "   [cyan]./cli.py maintenance health[/cyan] - System health check\n"
        "   [cyan]./cli.py monitor dashboard[/cyan] - Start monitoring\n\n"
        
        "[bold blue]4. Regular Maintenance:[/bold blue]\n"
        "   [cyan]./cli.py maintenance cleanup[/cyan] - Clean old data\n"
        "   [cyan]./cli.py db optimize[/cyan] - Optimize database\n"
        "   [cyan]./cli.py backup create[/cyan] - Regular backups\n\n"
        
        "[yellow]💡 Tip: Use --help with any command for detailed options[/yellow]",
        title="Quick Start",
        border_style="blue"
    ))

@app.callback()
def main(
    ctx: typer.Context,
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose output"),
    quiet: bool = typer.Option(False, "--quiet", "-q", help="Suppress non-error output"),
    config: str = typer.Option("production", "--config", "-c", help="Configuration environment")
):
    """
    DroneStrike v2 CLI
    
    Comprehensive command-line interface for managing all aspects of the DroneStrike v2 system. Built for production environments with advanced features and robust error handling.
    """
    
    # Configure logging based on verbosity
    if verbose:
        import logging
        logging.getLogger().setLevel(logging.DEBUG)
    elif quiet:
        import logging
        logging.getLogger().setLevel(logging.ERROR)
    
    # Set configuration context
    ctx.ensure_object(dict)
    ctx.obj['config'] = config
    ctx.obj['verbose'] = verbose
    ctx.obj['quiet'] = quiet
    
    if not quiet:
        console.print(f"[dim]Using configuration: {config}[/dim]")

if __name__ == "__main__":
    try:
        app()
    except KeyboardInterrupt:
        console.print("\n[yellow]Operation cancelled by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]Unexpected error: {e}[/red]")
        logger.error(f"CLI error: {e}")
        sys.exit(1)