import React from 'react';

interface TableProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  children: React.ReactNode;
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableHeaderCellElement> {
  className?: string;
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ className = '', children }) => {
  const classes = `w-full caption-bottom text-sm ${className}`;
  
  return (
    <div className="relative w-full overflow-auto">
      <table className={classes}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<TableProps> = ({ className = '', children }) => {
  const classes = `[&_tr]:border-b ${className}`;
  
  return (
    <thead className={classes}>
      {children}
    </thead>
  );
};

export const TableBody: React.FC<TableProps> = ({ className = '', children }) => {
  const classes = `[&_tr:last-child]:border-0 ${className}`;
  
  return (
    <tbody className={classes}>
      {children}
    </tbody>
  );
};

export const TableRow: React.FC<TableProps> = ({ className = '', children }) => {
  const classes = `border-b transition-colors hover:bg-gray-50/50 data-[state=selected]:bg-gray-50 ${className}`;
  
  return (
    <tr className={classes}>
      {children}
    </tr>
  );
};

export const TableHead: React.FC<TableHeadProps> = ({ className = '', children, ...props }) => {
  const classes = `h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0 ${className}`;
  
  return (
    <th className={classes} {...props}>
      {children}
    </th>
  );
};

export const TableCell: React.FC<TableCellProps> = ({ className = '', children, ...props }) => {
  const classes = `p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`;
  
  return (
    <td className={classes} {...props}>
      {children}
    </td>
  );
};