import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { Badge, getStatusVariant } from '../components/Badge';
import type { Project, Task, User } from '../types';

interface SearchResults {
  type: string;
  items: (Project | Task | User)[];
}

export function SearchPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    inputRef.current?.focus();

    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const searchDebounce = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const url = new URL('/api/search', window.location.origin);
        url.searchParams.set('q', query);
        if (typeFilter) {
          url.searchParams.set('type', typeFilter);
        }

        const response = await fetch(url.toString());
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounce);
  }, [query, typeFilter]);

  const handleSelect = (type: string, item: Project | Task | User) => {
    // Save to recent searches
    const newRecent = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recentSearches', JSON.stringify(newRecent));

    // Navigate
    switch (type) {
      case 'projects':
        navigate(`/projects/${(item as Project).id}`);
        break;
      case 'tasks':
        navigate(`/projects/${(item as Task).projectId}`);
        break;
      case 'users':
        navigate('/team');
        break;
    }
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const isProject = (item: Project | Task | User): item is Project => {
    return 'icon' in item && 'color' in item;
  };

  const isTask = (item: Project | Task | User): item is Task => {
    return 'projectId' in item && 'priority' in item;
  };

  const isUser = (item: Project | Task | User): item is User => {
    return 'avatar' in item && 'role' in item;
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Search</h1>
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              ref={inputRef}
              placeholder="Search projects, tasks, or team members..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="projects">Projects</option>
            <option value="tasks">Tasks</option>
            <option value="users">Users</option>
          </select>
        </div>
      </div>

      {/* Recent Searches */}
      {!query && recentSearches.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent Searches</h2>
            <button
              onClick={clearRecentSearches}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => handleRecentSearch(search)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Results */}
      {!isLoading && query.length >= 2 && (
        <div className="space-y-6">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No results found for "{query}"</p>
            </div>
          ) : (
            results.map((group) => (
              <div key={group.type}>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase">
                  {group.type}
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(group.type, item)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      {isProject(item) && (
                        <>
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: `${item.color}20`, color: item.color }}
                          >
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {item.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {item.description}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(item.status)}>
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </>
                      )}

                      {isTask(item) && (
                        <>
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {item.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {item.description}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(item.status)}>
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </>
                      )}

                      {isUser(item) && (
                        <>
                          <Avatar src={item.avatar} name={item.name} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {item.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {item.email}
                            </p>
                          </div>
                          <Badge>{item.role}</Badge>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quick Tips */}
      {!query && recentSearches.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Search for projects, tasks, or team members
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Tip: Use <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">⌘K</kbd> to open search from anywhere
          </p>
        </div>
      )}
    </div>
  );
}
