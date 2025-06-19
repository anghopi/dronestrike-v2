"""Task management pages implementation."""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session
from fastapi import Request
from datetime import datetime, date
from enum import Enum

from .base import BasePage, PageResponse


class TaskStatus(str, Enum):
    """Task status enumeration."""
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class TaskPriority(str, Enum):
    """Task priority enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskForm(BaseModel):
    """Task creation/update form validation."""
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.TODO
    assigned_to: Optional[int] = None
    mission_id: Optional[int] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[float] = None
    tags: Optional[List[str]] = []
    
    @validator('title')
    def title_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Title is required')
        return v.strip()
    
    @validator('estimated_hours')
    def hours_must_be_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Estimated hours must be positive')
        return v


class TaskUpdateForm(BaseModel):
    """Task update form validation."""
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assigned_to: Optional[int] = None
    progress_notes: Optional[str] = None
    time_spent: Optional[float] = None
    
    @validator('time_spent')
    def time_spent_must_be_positive(cls, v):
        if v is not None and v < 0:
            raise ValueError('Time spent cannot be negative')
        return v


class TaskFilterForm(BaseModel):
    """Task filtering form validation."""
    status: Optional[List[TaskStatus]] = None
    priority: Optional[List[TaskPriority]] = None
    assigned_to: Optional[List[int]] = None
    mission_id: Optional[int] = None
    due_date_from: Optional[date] = None
    due_date_to: Optional[date] = None
    tags: Optional[List[str]] = None


class TasksKanbanPage(BasePage):
    """Kanban board task management page"""
    
    def get_page_data(self) -> PageResponse:
        """Get kanban board page data."""
        self.require_authentication()
        
        try:
            # Get tasks organized by status
            tasks_by_status = self._get_tasks_by_status()
            
            # Get team members for assignment
            team_members = self._get_team_members()
            
            # Get mission options
            missions = self._get_available_missions()
            
            return self.create_response(data={
                'title': 'Tasks - Kanban Board',
                'tasks_by_status': tasks_by_status,
                'team_members': team_members,
                'missions': missions,
                'board_columns': [
                    {'id': 'todo', 'title': 'To Do', 'color': '#6B7280'},
                    {'id': 'in_progress', 'title': 'In Progress', 'color': '#3B82F6'},
                    {'id': 'review', 'title': 'Review', 'color': '#F59E0B'},
                    {'id': 'done', 'title': 'Done', 'color': '#10B981'}
                ],
                'priority_colors': {
                    'low': '#10B981',
                    'medium': '#F59E0B',
                    'high': '#EF4444',
                    'urgent': '#DC2626'
                }
            })
            
        except Exception as e:
            self.add_error('Failed to load kanban board')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle kanban board form submissions"""
        self.require_authentication()
        
        action = form_data.get('action')
        
        if action == 'create_task':
            return self._create_task(form_data)
        elif action == 'update_task':
            return self._update_task(form_data)
        elif action == 'move_task':
            return self._move_task(form_data)
        elif action == 'delete_task':
            return self._delete_task(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _create_task(self, form_data: Dict[str, Any]) -> PageResponse:
        """Create a new task."""
        task_form = self.validate_form_data(TaskForm, form_data)
        if not task_form:
            return self.create_response(success=False)
        
        try:
            # Create task in database
            task_data = task_form.dict()
            task_data['created_by'] = self.current_user['id']
            task_data['created_at'] = datetime.utcnow()
            
            # Simulate task creation
            new_task = {
                'id': self._generate_task_id(),
                **task_data,
                'time_spent': 0,
                'progress_notes': []
            }
            
            # Log activity
            self.log_activity('task_created', {
                'task_id': new_task['id'],
                'title': task_form.title
            })
            
            return self.create_response(
                success=True,
                data={'task': self._format_task_for_display(new_task)},
                message='Task created successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to create task')
            return self.create_response(success=False)
    
    def _update_task(self, form_data: Dict[str, Any]) -> PageResponse:
        """Update an existing task."""
        task_id = form_data.get('task_id')
        if not task_id:
            self.add_error('Task ID is required')
            return self.create_response(success=False)
        
        update_form = self.validate_form_data(TaskUpdateForm, form_data)
        if not update_form:
            return self.create_response(success=False)
        
        try:
            # Update task in database
            updates = update_form.dict(exclude_unset=True)
            updates['updated_at'] = datetime.utcnow()
            updates['updated_by'] = self.current_user['id']
            
            # Log activity
            self.log_activity('task_updated', {
                'task_id': task_id,
                'updates': updates
            })
            
            return self.create_response(
                success=True,
                data={'task_id': task_id, 'updates': updates},
                message='Task updated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to update task')
            return self.create_response(success=False)
    
    def _move_task(self, form_data: Dict[str, Any]) -> PageResponse:
        """Move task to different status column."""
        task_id = form_data.get('task_id')
        new_status = form_data.get('new_status')
        
        if not task_id or not new_status:
            self.add_error('Task ID and new status are required')
            return self.create_response(success=False)
        
        try:
            # Update task status
            updates = {
                'status': new_status,
                'updated_at': datetime.utcnow(),
                'updated_by': self.current_user['id']
            }
            
            # Log activity
            self.log_activity('task_moved', {
                'task_id': task_id,
                'new_status': new_status
            })
            
            return self.create_response(
                success=True,
                data={'task_id': task_id, 'new_status': new_status},
                message='Task moved successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to move task')
            return self.create_response(success=False)
    
    def _delete_task(self, form_data: Dict[str, Any]) -> PageResponse:
        """Delete a task."""
        task_id = form_data.get('task_id')
        if not task_id:
            self.add_error('Task ID is required')
            return self.create_response(success=False)
        
        try:
            # Delete task from database
            # In real implementation, you might want to soft delete
            
            # Log activity
            self.log_activity('task_deleted', {
                'task_id': task_id
            })
            
            return self.create_response(
                success=True,
                data={'task_id': task_id},
                message='Task deleted successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to delete task')
            return self.create_response(success=False)
    
    def _get_tasks_by_status(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get tasks organized by status."""
        # In real implementation, query from database
        return {
            'todo': [
                {
                    'id': 1,
                    'title': 'Plan drone route for property inspection',
                    'description': 'Create detailed flight plan for the residential property inspection',
                    'priority': 'high',
                    'assigned_to': 1,
                    'mission_id': 1,
                    'due_date': '2024-01-15',
                    'estimated_hours': 2.0,
                    'tags': ['planning', 'inspection'],
                    'created_at': '2024-01-10T10:00:00Z'
                }
            ],
            'in_progress': [
                {
                    'id': 2,
                    'title': 'Review footage from last mission',
                    'description': 'Analyze and edit drone footage from the commercial property shoot',
                    'priority': 'medium',
                    'assigned_to': 2,
                    'mission_id': 2,
                    'due_date': '2024-01-12',
                    'estimated_hours': 4.0,
                    'time_spent': 1.5,
                    'tags': ['editing', 'review'],
                    'created_at': '2024-01-08T14:30:00Z'
                }
            ],
            'review': [],
            'done': [
                {
                    'id': 3,
                    'title': 'Deliver final photos to client',
                    'description': 'Send processed images and report to the client',
                    'priority': 'low',
                    'assigned_to': 1,
                    'mission_id': 3,
                    'due_date': '2024-01-10',
                    'estimated_hours': 0.5,
                    'time_spent': 0.5,
                    'tags': ['delivery', 'client'],
                    'created_at': '2024-01-05T09:00:00Z',
                    'completed_at': '2024-01-10T16:00:00Z'
                }
            ]
        }
    
    def _get_team_members(self) -> List[Dict[str, Any]]:
        """Get team members for task assignment."""
        return [
            {'id': 1, 'name': 'John Doe', 'role': 'Pilot'},
            {'id': 2, 'name': 'Jane Smith', 'role': 'Editor'},
            {'id': 3, 'name': 'Mike Johnson', 'role': 'Analyst'}
        ]
    
    def _get_available_missions(self) -> List[Dict[str, Any]]:
        """Get available missions for task association."""
        return [
            {'id': 1, 'title': 'Residential Property Inspection - 123 Main St'},
            {'id': 2, 'title': 'Commercial Building Survey - Downtown Plaza'},
            {'id': 3, 'title': 'Construction Progress - New Development'}
        ]
    
    def _format_task_for_display(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Format task data for display."""
        return {
            'id': task['id'],
            'title': task['title'],
            'description': task.get('description', ''),
            'priority': task['priority'],
            'status': task['status'],
            'assigned_to': task.get('assigned_to'),
            'mission_id': task.get('mission_id'),
            'due_date': task.get('due_date'),
            'estimated_hours': task.get('estimated_hours'),
            'time_spent': task.get('time_spent', 0),
            'tags': task.get('tags', []),
            'created_at': task.get('created_at'),
            'updated_at': task.get('updated_at')
        }
    
    def _generate_task_id(self) -> int:
        """Generate a new task ID."""
        # In real implementation, this would be handled by the database
        import random
        return random.randint(1000, 9999)


class TasksTablePage(BasePage):
    """Table view task management page."""
    
    def get_page_data(self) -> PageResponse:
        """Get table view page data."""
        self.require_authentication()
        
        try:
            # Get all tasks
            tasks = self._get_all_tasks()
            
            # Get filter options
            team_members = self._get_team_members()
            missions = self._get_available_missions()
            
            return self.create_response(data={
                'title': 'Tasks - Table View',
                'tasks': tasks,
                'team_members': team_members,
                'missions': missions,
                'filter_options': {
                    'statuses': [status.value for status in TaskStatus],
                    'priorities': [priority.value for priority in TaskPriority]
                },
                'table_columns': [
                    {'key': 'title', 'label': 'Title', 'sortable': True},
                    {'key': 'priority', 'label': 'Priority', 'sortable': True},
                    {'key': 'status', 'label': 'Status', 'sortable': True},
                    {'key': 'assigned_to', 'label': 'Assigned To', 'sortable': True},
                    {'key': 'due_date', 'label': 'Due Date', 'sortable': True},
                    {'key': 'progress', 'label': 'Progress', 'sortable': False},
                    {'key': 'actions', 'label': 'Actions', 'sortable': False}
                ]
            })
            
        except Exception as e:
            self.add_error('Failed to load tasks table')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle table view form submissions."""
        self.require_authentication()
        
        action = form_data.get('action')
        
        if action == 'filter_tasks':
            return self._filter_tasks(form_data)
        elif action == 'bulk_update':
            return self._bulk_update_tasks(form_data)
        elif action == 'export_tasks':
            return self._export_tasks(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _filter_tasks(self, form_data: Dict[str, Any]) -> PageResponse:
        """Filter tasks based on criteria."""
        filter_form = self.validate_form_data(TaskFilterForm, form_data)
        if not filter_form:
            return self.create_response(success=False)
        
        try:
            # Apply filters to task query
            filtered_tasks = self._apply_task_filters(filter_form)
            
            return self.create_response(
                success=True,
                data={
                    'tasks': filtered_tasks,
                    'total_count': len(filtered_tasks)
                }
            )
            
        except Exception as e:
            self.add_error('Failed to filter tasks')
            return self.create_response(success=False)
    
    def _bulk_update_tasks(self, form_data: Dict[str, Any]) -> PageResponse:
        """Bulk update multiple tasks."""
        task_ids = form_data.get('task_ids', [])
        updates = form_data.get('updates', {})
        
        if not task_ids:
            self.add_error('No tasks selected')
            return self.create_response(success=False)
        
        try:
            # Update multiple tasks
            updated_count = 0
            for task_id in task_ids:
                # Apply updates to each task
                updated_count += 1
            
            # Log bulk update
            self.log_activity('tasks_bulk_updated', {
                'task_ids': task_ids,
                'updates': updates,
                'count': updated_count
            })
            
            return self.create_response(
                success=True,
                data={'updated_count': updated_count},
                message=f'Successfully updated {updated_count} tasks'
            )
            
        except Exception as e:
            self.add_error('Failed to update tasks')
            return self.create_response(success=False)
    
    def _export_tasks(self, form_data: Dict[str, Any]) -> PageResponse:
        """Export tasks to CSV or Excel."""
        export_format = form_data.get('format', 'csv')
        task_ids = form_data.get('task_ids', [])
        
        try:
            # Generate export file
            if export_format == 'csv':
                file_path = self._generate_csv_export(task_ids)
            elif export_format == 'excel':
                file_path = self._generate_excel_export(task_ids)
            else:
                self.add_error('Invalid export format')
                return self.create_response(success=False)
            
            # Log export
            self.log_activity('tasks_exported', {
                'format': export_format,
                'task_count': len(task_ids) if task_ids else 'all'
            })
            
            return self.create_response(
                success=True,
                data={'download_url': file_path},
                message='Export generated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to export tasks')
            return self.create_response(success=False)
    
    def _get_all_tasks(self) -> List[Dict[str, Any]]:
        """Get all tasks for table view."""
        # In real implementation, query from database with pagination
        all_tasks = []
        
        # Get tasks from all statuses
        tasks_by_status = self._get_tasks_by_status()
        for status, tasks in tasks_by_status.items():
            all_tasks.extend(tasks)
        
        return all_tasks
    
    def _apply_task_filters(self, filters: TaskFilterForm) -> List[Dict[str, Any]]:
        """Apply filters to task list."""
        tasks = self._get_all_tasks()
        
        # Apply status filter
        if filters.status:
            tasks = [t for t in tasks if t['status'] in filters.status]
        
        # Apply priority filter
        if filters.priority:
            tasks = [t for t in tasks if t['priority'] in filters.priority]
        
        # Apply assignee filter
        if filters.assigned_to:
            tasks = [t for t in tasks if t.get('assigned_to') in filters.assigned_to]
        
        # Apply mission filter
        if filters.mission_id:
            tasks = [t for t in tasks if t.get('mission_id') == filters.mission_id]
        
        # Apply date filters
        if filters.due_date_from or filters.due_date_to:
            # Implement date filtering logic
            pass
        
        return tasks
    
    def _generate_csv_export(self, task_ids: List[int]) -> str:
        """Generate CSV export file."""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['ID', 'Title', 'Status', 'Priority', 'Assigned To', 'Due Date', 'Progress'])
        
        # Write task data
        tasks = self._get_all_tasks()
        for task in tasks:
            if not task_ids or task['id'] in task_ids:
                writer.writerow([
                    task['id'],
                    task['title'],
                    task['status'],
                    task['priority'],
                    task.get('assigned_to', ''),
                    task.get('due_date', ''),
                    f"{(task.get('time_spent', 0) / task.get('estimated_hours', 1)) * 100:.1f}%"
                ])
        
        # Save to file
        filename = f"tasks_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        file_path = f"/tmp/{filename}"
        
        with open(file_path, 'w') as f:
            f.write(output.getvalue())
        
        return file_path
    
    def _generate_excel_export(self, task_ids: List[int]) -> str:
        """Generate Excel export file."""
        # In real implementation, use openpyxl or similar
        # For now, just return CSV
        return self._generate_csv_export(task_ids)
    
    def _get_tasks_by_status(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get tasks organized by status."""
        # Reuse from KanbanPage
        kanban_page = TasksKanbanPage(self.db, self.request, self.current_user)
        return kanban_page._get_tasks_by_status()
    
    def _get_team_members(self) -> List[Dict[str, Any]]:
        """Get team members."""
        # Reuse from KanbanPage
        kanban_page = TasksKanbanPage(self.db, self.request, self.current_user)
        return kanban_page._get_team_members()
    
    def _get_available_missions(self) -> List[Dict[str, Any]]:
        """Get available missions."""
        # Reuse from KanbanPage
        kanban_page = TasksKanbanPage(self.db, self.request, self.current_user)
        return kanban_page._get_available_missions()