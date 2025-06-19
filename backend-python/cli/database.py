"""
Advanced Database Management CLI Commands
Production-ready database operations with error handling and monitoring
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.table import Table
from sqlalchemy import text, inspect
from sqlalchemy.exc import SQLAlchemyError
import alembic.command
import alembic.config
import psutil

from core.database import get_db_session, engine
from core.config import settings
from utils.logging_config import get_logger
from utils.security_utils import SecurityManager
from utils.monitoring_utils import MetricsCollector

logger = get_logger(__name__)
console = Console()
app = typer.Typer(name="database", help="Advanced database management commands")

class DatabaseManager:    
    def __init__(self):
        self.security = SecurityManager()
        self.metrics = MetricsCollector()
        self.backup_dir = Path(settings.BACKUP_DIR)
        self.backup_dir.mkdir(exist_ok=True)
    
    async def get_db_info(self) -> Dict[str, Any]:
        try:
            async with get_db_session() as session:
                # Connection info
                result = await session.execute(text("SELECT version()"))
                version = result.scalar()
                
                # Database size
                size_result = await session.execute(text("""
                    SELECT pg_size_pretty(pg_database_size(current_database())) as size
                """))
                db_size = size_result.scalar()
                
                # Connection count
                conn_result = await session.execute(text("""
                    SELECT count(*) FROM pg_stat_activity 
                    WHERE datname = current_database()
                """))
                connections = conn_result.scalar()
                
                # Table info
                tables_result = await session.execute(text("""
                    SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
                    FROM pg_stat_user_tables
                    ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
                    LIMIT 10
                """))
                tables = tables_result.fetchall()
                
                return {
                    'version': version,
                    'size': db_size,
                    'connections': connections,
                    'tables': [dict(row._mapping) for row in tables],
                    'timestamp': datetime.utcnow().isoformat()
                }
        except Exception as e:
            logger.error(f"Failed to get database info: {e}")
            raise

@app.command()
def info():
    try:
        db_manager = DatabaseManager()
        info_data = asyncio.run(db_manager.get_db_info())
        
        # Display version and basic info
        console.print(f"[bold green]Database Version:[/bold green] {info_data['version']}")
        console.print(f"[bold blue]Database Size:[/bold blue] {info_data['size']}")
        console.print(f"[bold yellow]Active Connections:[/bold yellow] {info_data['connections']}")
        
        # Display table statistics
        if info_data['tables']:
            table = Table(title="Top Active Tables")
            table.add_column("Schema", style="cyan")
            table.add_column("Table", style="magenta")
            table.add_column("Inserts", style="green")
            table.add_column("Updates", style="yellow")
            table.add_column("Deletes", style="red")
            
            for row in info_data['tables']:
                table.add_row(
                    row['schemaname'],
                    row['tablename'],
                    str(row['n_tup_ins']),
                    str(row['n_tup_upd']),
                    str(row['n_tup_del'])
                )
            console.print(table)
            
    except Exception as e:
        console.print(f"[red]Error getting database info: {e}[/red]")
        sys.exit(1)

@app.command()
def migrate(
    direction: str = typer.Argument(..., help="Migration direction: up/down"),
    revision: Optional[str] = typer.Option(None, help="Specific revision to migrate to"),
    dry_run: bool = typer.Option(False, help="Preview migration without executing"),
    backup: bool = typer.Option(True, help="Create backup before migration")
):
    """Execute database migrations with safety checks."""
    try:
        if backup and direction == "up":
            console.print("[yellow]Creating pre-migration backup...[/yellow]")
            backup_file = asyncio.run(_create_backup())
            console.print(f"[green]Backup created: {backup_file}[/green]")
        
        alembic_cfg = alembic.config.Config("alembic.ini")
        
        if dry_run:
            console.print("[yellow]DRY RUN - No changes will be made[/yellow]")
            if direction == "up":
                alembic.command.upgrade(alembic_cfg, revision or "head", sql=True)
            else:
                alembic.command.downgrade(alembic_cfg, revision or "-1", sql=True)
        else:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TimeElapsedColumn()
            ) as progress:
                task = progress.add_task(f"Running migration {direction}...", total=100)
                
                if direction == "up":
                    alembic.command.upgrade(alembic_cfg, revision or "head")
                elif direction == "down":
                    alembic.command.downgrade(alembic_cfg, revision or "-1")
                else:
                    raise ValueError(f"Invalid direction: {direction}")
                
                progress.update(task, completed=100)
            
            console.print(f"[green]Migration {direction} completed successfully[/green]")
            
    except Exception as e:
        console.print(f"[red]Migration failed: {e}[/red]")
        logger.error(f"Migration failed: {e}")
        sys.exit(1)

@app.command()
def backup(
    output_file: Optional[str] = typer.Option(None, help="Custom backup filename"),
    compress: bool = typer.Option(True, help="Compress backup file"),
    include_data: bool = typer.Option(True, help="Include table data in backup")
):

async def _create_backup(output_file: Optional[str] = None, compress: bool = True) -> str:
    """Internal backup function."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    if not output_file:
        output_file = f"dronestrike_backup_{timestamp}.sql"
    
    backup_path = Path(settings.BACKUP_DIR) / output_file
    
    # Use pg_dump for PostgreSQL backup
    cmd = [
        "pg_dump",
        f"--host={settings.DATABASE_HOST}",
        f"--port={settings.DATABASE_PORT}",
        f"--username={settings.DATABASE_USER}",
        f"--dbname={settings.DATABASE_NAME}",
        "--verbose",
        "--no-password",
        f"--file={backup_path}"
    ]
    
    if compress:
        cmd.append("--compress=9")
    
    process = await asyncio.create_subprocess_exec(
        *cmd,
        env={**os.environ, "PGPASSWORD": settings.DATABASE_PASSWORD},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    stdout, stderr = await process.communicate()
    
    if process.returncode != 0:
        raise RuntimeError(f"Backup failed: {stderr.decode()}")
    
    return str(backup_path)

@app.command()
def restore(
    backup_file: str = typer.Argument(..., help="Backup file to restore from"),
    drop_existing: bool = typer.Option(False, help="Drop existing database first"),
    confirm: bool = typer.Option(False, help="Skip confirmation prompt")
):
    """Restore database from backup file."""
    if not confirm:
        confirmed = typer.confirm(
            f"This will restore database from {backup_file}. Continue?",
            default=False
        )
        if not confirmed:
            console.print("[yellow]Restore cancelled[/yellow]")
            return
    
    try:
        backup_path = Path(backup_file)
        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file not found: {backup_file}")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn()
        ) as progress:
            task = progress.add_task("Restoring database...", total=None)
            
            cmd = [
                "psql",
                f"--host={settings.DATABASE_HOST}",
                f"--port={settings.DATABASE_PORT}",
                f"--username={settings.DATABASE_USER}",
                f"--dbname={settings.DATABASE_NAME}",
                "--file", str(backup_path)
            ]
            
            process = asyncio.run(asyncio.create_subprocess_exec(
                *cmd,
                env={**os.environ, "PGPASSWORD": settings.DATABASE_PASSWORD},
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            ))
            
            stdout, stderr = asyncio.run(process.communicate())
            
            if process.returncode != 0:
                raise RuntimeError(f"Restore failed: {stderr.decode()}")
            
            progress.update(task, completed=100)
        
        console.print("[green]Database restored successfully[/green]")
        
    except Exception as e:
        console.print(f"[red]Restore failed: {e}[/red]")
        logger.error(f"Database restore failed: {e}")
        sys.exit(1)

@app.command()
def optimize():
    """Optimize database performance with VACUUM and ANALYZE."""
    try:
        async def run_optimization():
            async with get_db_session() as session:
                # Get table list
                tables_result = await session.execute(text("""
                    SELECT tablename FROM pg_tables 
                    WHERE schemaname = 'public'
                """))
                tables = [row[0] for row in tables_result.fetchall()]
                
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    BarColumn(),
                    TimeElapsedColumn()
                ) as progress:
                    
                    for i, table in enumerate(tables):
                        task = progress.add_task(f"Optimizing {table}...", total=100)
                        
                        # VACUUM ANALYZE each table
                        await session.execute(text(f"VACUUM ANALYZE {table}"))
                        await session.commit()
                        
                        progress.update(task, completed=100)
                
                # Update statistics
                await session.execute(text("ANALYZE"))
                await session.commit()
        
        asyncio.run(run_optimization())
        console.print("[green]Database optimization completed[/green]")
        
    except Exception as e:
        console.print(f"[red]Optimization failed: {e}[/red]")
        logger.error(f"Database optimization failed: {e}")
        sys.exit(1)

@app.command()
def monitor():
    """Real-time db monitoring dashboard"""
    try:
        async def monitor_loop():
            while True:
                console.clear()
                
                # Get current stats
                async with get_db_session() as session:
                    # Connection stats
                    conn_result = await session.execute(text("""
                        SELECT state, count(*) 
                        FROM pg_stat_activity 
                        WHERE datname = current_database()
                        GROUP BY state
                    """))
                    connections = dict(conn_result.fetchall())
                    
                    # Lock stats
                    lock_result = await session.execute(text("""
                        SELECT mode, count(*) 
                        FROM pg_locks 
                        GROUP BY mode
                        ORDER BY count(*) DESC
                        LIMIT 5
                    """))
                    locks = dict(lock_result.fetchall())
                    
                    # Query stats
                    query_result = await session.execute(text("""
                        SELECT query, calls, total_time, mean_time
                        FROM pg_stat_statements
                        ORDER BY total_time DESC
                        LIMIT 5
                    """))
                    queries = query_result.fetchall()
                
                # Display dashboard
                console.print("[bold green]DroneStrike Database Monitor[/bold green]")
                console.print(f"[yellow]Last Update: {datetime.now().strftime('%H:%M:%S')}[/yellow]\n")
                
                # Connection table
                conn_table = Table(title="Connections by State")
                conn_table.add_column("State", style="cyan")
                conn_table.add_column("Count", style="green")
                
                for state, count in connections.items():
                    conn_table.add_row(state or "unknown", str(count))
                
                console.print(conn_table)
                
                await asyncio.sleep(5)  # Update every 5 seconds
        
        asyncio.run(monitor_loop())
        
    except KeyboardInterrupt:
        console.print("\n[yellow]Monitoring stopped[/yellow]")
    except Exception as e:
        console.print(f"[red]Monitoring failed: {e}[/red]")
        logger.error(f"Database monitoring failed: {e}")

if __name__ == "__main__":
    app()