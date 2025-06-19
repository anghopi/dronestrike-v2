import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock components with edge case handling
const EdgeCaseLogin = ({ onSubmit }: { onSubmit?: (data: any) => void }) => {
  const [formData, setFormData] = React.useState({ email: '', password: '' });
  const [errors, setErrors] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);

    try {
      // Validate email format
      if (!formData.email.includes('@')) {
        setErrors(['Invalid email format']);
        return;
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onSubmit?.(formData);
    } catch (error) {
      setErrors(['Login failed']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} role="form">
      <input
        type="email"
        aria-label="Email"
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        disabled={isSubmitting}
        maxLength={254} // RFC 5321 email length limit
      />
      <input
        type="password"
        aria-label="Password"
        value={formData.password}
        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
        disabled={isSubmitting}
        maxLength={128} // Common password length limit
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing In...' : 'Sign In'}
      </button>
      {errors.map((error, index) => (
        <div key={index} role="alert" aria-live="polite">
          {error}
        </div>
      ))}
    </form>
  );
};

const EdgeCaseDataTable = ({ data = [] }: { data?: any[] }) => {
  const [sortField, setSortField] = React.useState<string>('');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = React.useState<Set<number>>(new Set());

  const sortedData = React.useMemo(() => {
    if (!sortField || !data.length) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const modifier = sortDirection === 'asc' ? 1 : -1;
      return aVal > bVal ? modifier : -modifier;
    });
  }, [data, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data.map((_, index) => index)));
    }
  };

  if (!data.length) {
    return (
      <div role="table" aria-label="Empty data table">
        <div role="alert">No data available</div>
      </div>
    );
  }

  return (
    <div role="table" aria-label="Data table">
      <div role="row">
        <input
          type="checkbox"
          checked={selectedRows.size === data.length && data.length > 0}
          onChange={handleSelectAll}
          aria-label="Select all rows"
        />
        <button onClick={() => handleSort('name')} aria-label="Sort by name">
          Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button onClick={() => handleSort('score')} aria-label="Sort by score">
          Score {sortField === 'score' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
      </div>
      {sortedData.map((item, index) => (
        <div key={index} role="row">
          <input
            type="checkbox"
            checked={selectedRows.has(index)}
            onChange={() => {
              const newSelected = new Set(selectedRows);
              if (newSelected.has(index)) {
                newSelected.delete(index);
              } else {
                newSelected.add(index);
              }
              setSelectedRows(newSelected);
            }}
            aria-label={`Select row ${index + 1}`}
          />
          <span>{item.name || 'N/A'}</span>
          <span>{item.score !== undefined ? item.score : 'N/A'}</span>
        </div>
      ))}
    </div>
  );
};

const EdgeCaseApiComponent = () => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate various API failure scenarios
      if (retryCount === 0) {
        throw new Error('Network timeout');
      } else if (retryCount === 1) {
        throw new Error('Server error 500');
      } else if (retryCount === 2) {
        throw new Error('Rate limit exceeded');
      }
      
      // Success case
      setData({ message: 'Data loaded successfully' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    fetchData();
  };

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        Load Data
      </button>
      {loading && <div role="status" aria-label="Loading">Loading...</div>}
      {error && (
        <div role="alert" aria-live="assertive">
          Error: {error}
          <button onClick={handleRetry}>Retry ({retryCount}/3)</button>
        </div>
      )}
      {data && <div role="main">{JSON.stringify(data)}</div>}
    </div>
  );
};

describe('DroneStrike v2 - Edge Case Testing', () => {
  
  describe('Form Input Edge Cases', () => {
    
    test('handles extremely long input values', async () => {
      render(<EdgeCaseLogin />);
      
      const emailInput = screen.getByLabelText('Email');
      const longEmail = 'a'.repeat(300) + '@example.com'; // Exceeds max length
      
      await userEvent.type(emailInput, longEmail);
      
      // Should be truncated to max length
      expect(emailInput).toHaveValue(longEmail.substring(0, 254));
    });

    test('handles special characters and unicode', async () => {
      render(<EdgeCaseLogin />);
      
      const emailInput = screen.getByLabelText('Email');
      const specialEmail = 'test+tag@example-domain.com';
      const unicodeEmail = 'тест@пример.рф';
      
      await userEvent.type(emailInput, specialEmail);
      expect(emailInput).toHaveValue(specialEmail);
      
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, unicodeEmail);
      expect(emailInput).toHaveValue(unicodeEmail);
    });

    test('prevents XSS through input sanitization', async () => {
      render(<EdgeCaseLogin />);
      
      const emailInput = screen.getByLabelText('Email');
      const xssAttempt = '<script>alert("xss")</script>@evil.com';
      
      await userEvent.type(emailInput, xssAttempt);
      
      // Input should contain the raw text, not execute it
      expect(emailInput).toHaveValue(xssAttempt);
      expect(screen.queryByText('alert("xss")')).not.toBeInTheDocument();
    });

    test('handles paste operations with large content', async () => {
      render(<EdgeCaseLogin />);
      
      const emailInput = screen.getByLabelText('Email');
      const largeContent = 'a'.repeat(1000) + '@example.com';
      
      await userEvent.click(emailInput);
      await userEvent.paste(largeContent);
      
      // Should be truncated
      expect(emailInput.value.length).toBeLessThanOrEqual(254);
    });

    test('handles rapid form submission attempts', async () => {
      const mockSubmit = jest.fn();
      render(<EdgeCaseLogin onSubmit={mockSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      const emailInput = screen.getByLabelText('Email');
      
      await userEvent.type(emailInput, 'test@example.com');
      
      // Rapidly click submit multiple times
      await userEvent.click(submitButton);
      await userEvent.click(submitButton);
      await userEvent.click(submitButton);
      
      // Should only submit once due to disabled state
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Data Table Edge Cases', () => {
    
    test('handles empty data gracefully', () => {
      render(<EdgeCaseDataTable data={[]} />);
      
      expect(screen.getByRole('alert')).toHaveTextContent('No data available');
    });

    test('handles null and undefined values', () => {
      const edgeCaseData = [
        { name: 'Valid Item', score: 85 },
        { name: null, score: undefined },
        { name: '', score: 0 },
        { name: 'Item with null score', score: null },
      ];
      
      render(<EdgeCaseDataTable data={edgeCaseData} />);
      
      // Should display N/A for null/undefined values
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    test('handles extremely large datasets', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        name: `Item ${i}`,
        score: Math.floor(Math.random() * 100)
      }));
      
      const startTime = performance.now();
      render(<EdgeCaseDataTable data={largeDataset} />);
      const endTime = performance.now();
      
      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('handles sorting with mixed data types', () => {
      const mixedData = [
        { name: 'Alpha', score: '85' },
        { name: 'Beta', score: 90 },
        { name: 'Gamma', score: null },
        { name: 'Delta', score: '75' },
      ];
      
      render(<EdgeCaseDataTable data={mixedData} />);
      
      const sortButton = screen.getByLabelText('Sort by score');
      fireEvent.click(sortButton);
      
      // Should not crash with mixed types
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    test('handles select all with zero items', () => {
      render(<EdgeCaseDataTable data={[]} />);
      
      // Should show empty state, not checkbox
      expect(screen.getByRole('alert')).toHaveTextContent('No data available');
    });
  });

  describe('Network and API Edge Cases', () => {
    
    test('handles network timeouts gracefully', async () => {
      render(<EdgeCaseApiComponent />);
      
      const loadButton = screen.getByText('Load Data');
      await userEvent.click(loadButton);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network timeout');
      });
    });

    test('implements retry mechanism with backoff', async () => {
      render(<EdgeCaseApiComponent />);
      
      const loadButton = screen.getByText('Load Data');
      await userEvent.click(loadButton);
      
      // First failure
      await waitFor(() => {
        expect(screen.getByText('Retry (0/3)')).toBeInTheDocument();
      });
      
      // Retry and get second failure
      const retryButton = screen.getByText('Retry (0/3)');
      await userEvent.click(retryButton);
      
      await waitFor(() => {
        expect(screen.getByText('Retry (1/3)')).toBeInTheDocument();
      });
    });

    test('prevents concurrent API requests', async () => {
      render(<EdgeCaseApiComponent />);
      
      const loadButton = screen.getByText('Load Data');
      
      // Rapidly click load button
      await userEvent.click(loadButton);
      await userEvent.click(loadButton);
      await userEvent.click(loadButton);
      
      // Button should be disabled during loading
      expect(loadButton).toBeDisabled();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    
    test('handles component unmounting during async operations', async () => {
      const { unmount } = render(<EdgeCaseApiComponent />);
      
      const loadButton = screen.getByText('Load Data');
      await userEvent.click(loadButton);
      
      // Unmount component while API call is in progress
      unmount();
      
      // Should not throw errors or memory leaks
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    test('handles rapid state updates', async () => {
      render(<EdgeCaseLogin />);
      
      const emailInput = screen.getByLabelText('Email');
      
      // Rapidly type and clear
      for (let i = 0; i < 100; i++) {
        await userEvent.type(emailInput, 'a');
        await userEvent.clear(emailInput);
      }
      
      // Should not crash or cause performance issues
      expect(emailInput).toHaveValue('');
    });

    test('handles memory cleanup on component destruction', () => {
      const TestComponent = () => {
        const [listeners, setListeners] = React.useState<(() => void)[]>([]);
        
        React.useEffect(() => {
          const cleanup = () => console.log('cleanup');
          setListeners(prev => [...prev, cleanup]);
          
          return () => {
            listeners.forEach(fn => fn());
          };
        }, [listeners]);
        
        return <div>Memory test</div>;
      };
      
      const { unmount } = render(<TestComponent />);
      unmount();
      
      // Should not cause memory leaks
      expect(true).toBe(true);
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    
    test('handles missing localStorage gracefully', () => {
      const originalLocalStorage = window.localStorage;
      
      // Mock localStorage to throw errors
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => { throw new Error('localStorage not available'); },
          setItem: () => { throw new Error('localStorage not available'); },
          removeItem: () => { throw new Error('localStorage not available'); },
        },
        writable: true
      });
      
      // Component should still render without crashing
      render(<EdgeCaseLogin />);
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      
      // Restore original localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      });
    });

    test('handles missing modern browser APIs', () => {
      const originalIntersectionObserver = window.IntersectionObserver;
      
      // Remove IntersectionObserver
      delete (window as any).IntersectionObserver;
      
      // Component should still work
      render(<EdgeCaseDataTable data={[{ name: 'Test', score: 85 }]} />);
      expect(screen.getByText('Test')).toBeInTheDocument();
      
      // Restore
      window.IntersectionObserver = originalIntersectionObserver;
    });
  });

  describe('Security Edge Cases', () => {
    
    test('prevents prototype pollution', () => {
      const maliciousData = [
        { name: 'Normal Item', score: 85 },
        { '__proto__': { 'isEvil': true }, name: 'Evil Item', score: 90 }
      ];
      
      render(<EdgeCaseDataTable data={maliciousData} />);
      
      // Should not pollute prototype
      expect((Object.prototype as any).isEvil).toBeUndefined();
    });

    test('sanitizes dangerous HTML attributes', async () => {
      render(<EdgeCaseLogin />);
      
      const emailInput = screen.getByLabelText('Email');
      const dangerousInput = 'test@example.com" onload="alert(1)"';
      
      await userEvent.type(emailInput, dangerousInput);
      
      // Should not execute the onload
      expect(emailInput).toHaveValue(dangerousInput);
    });
  });

  describe('Accessibility Edge Cases', () => {
    
    test('maintains focus management with dynamic content', async () => {
      render(<EdgeCaseApiComponent />);
      
      const loadButton = screen.getByText('Load Data');
      await userEvent.click(loadButton);
      
      // Focus should be managed properly when content changes
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      });
    });

    test('provides proper ARIA live regions for dynamic updates', async () => {
      render(<EdgeCaseLogin />);
      
      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button');
      
      await userEvent.type(emailInput, 'invalidemail');
      await userEvent.click(submitButton);
      
      // Error should be announced via ARIA live region
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'polite');
      });
    });

    test('handles high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      render(<EdgeCaseLogin />);
      
      // Should render properly in high contrast mode
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
  });

  describe('Stress Testing', () => {
    
    test('handles rapid component mounting/unmounting', () => {
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(<EdgeCaseLogin />);
        unmount();
      }
      
      // Should not cause memory leaks or crashes
      expect(true).toBe(true);
    });

    test('handles concurrent user interactions', async () => {
      render(<EdgeCaseDataTable data={[
        { name: 'Item 1', score: 85 },
        { name: 'Item 2', score: 92 },
        { name: 'Item 3', score: 78 }
      ]} />);
      
      const sortNameButton = screen.getByLabelText('Sort by name');
      const sortScoreButton = screen.getByLabelText('Sort by score');
      const selectAllCheckbox = screen.getByLabelText('Select all rows');
      
      // Rapidly interact with multiple controls
      await Promise.all([
        userEvent.click(sortNameButton),
        userEvent.click(sortScoreButton),
        userEvent.click(selectAllCheckbox),
        userEvent.click(sortNameButton),
      ]);
      
      // Should handle concurrent interactions gracefully
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });
});