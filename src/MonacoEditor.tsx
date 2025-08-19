import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';

type ConnectionType = 'snowflake' | 'eks';
type QueryType = 'sql' | 'kubectl';

interface QueryResult {
  columns?: string[];
  rows?: any[][];
  rowCount?: number;
  message?: string;
  rowsAffected?: number;
}

function App() {
  const [query, setQuery] = useState("-- SQL Editor\nSELECT * FROM users WHERE id = 1;");
  const [results, setResults] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType>('snowflake');
  const [queryType, setQueryType] = useState<QueryType>('sql');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const editorRef = useRef(null);

  // Sample queries for different connection types
  const sampleQueries = {
    snowflake: {
      sql: "-- Snowflake SQL Query\nSELECT CURRENT_VERSION(), CURRENT_USER(), CURRENT_DATABASE();\n\n-- Example queries:\n-- SELECT * FROM INFORMATION_SCHEMA.TABLES LIMIT 10;\n-- SELECT COUNT(*) FROM your_table_name;"
    },
    eks: {
      sql: "-- Kubernetes SQL-like Queries\nSELECT * FROM PODS;\n\n-- Available tables:\n-- SELECT * FROM NODES\n-- SELECT * FROM DEPLOYMENTS\n-- SELECT * FROM SERVICES",
      kubectl: "get pods --all-namespaces\n\n# Other kubectl commands:\n# get nodes\n# get deployments\n# get services\n# describe pod <pod-name>\n# logs <pod-name>"
    }
  };

  function handleEditorChange(value: string | undefined) {
    setQuery(value || '');
  }

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor;
    console.log('Editor mounted:', editor);
  }

  async function testConnection() {
    setConnectionStatus('connecting');
    setError(null);

    try {
      const endpoint = connectionType === 'snowflake' ? '/api/snowflake/test-connection' : '/api/eks/test-connection';
      
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setConnectionStatus('connected');
        setResults(data.data);
      } else {
        setConnectionStatus('error');
        setError(data.message || 'Connection failed');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setError(err.message || 'Failed to connect to backend server');
    }
  }

  async function executeQuery() {
    if (!query.trim()) {
      setError("Please enter a query");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResults(null);

    try {
      const endpoint = connectionType === 'snowflake' ? '/api/snowflake/execute' : '/api/eks/execute';
      
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: query,
          queryType: connectionType === 'eks' ? queryType : 'sql'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.message || 'Query execution failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute query');
    } finally {
      setIsExecuting(false);
    }
  }

  function handleConnectionTypeChange(newType: ConnectionType) {
    setConnectionType(newType);
    setConnectionStatus('disconnected');
    setResults(null);
    setError(null);
    
    // Set appropriate query type and sample query
    if (newType === 'snowflake') {
      setQueryType('sql');
      setQuery(sampleQueries.snowflake.sql);
    } else {
      setQueryType('sql'); // Default to SQL-like for EKS
      setQuery(sampleQueries.eks.sql);
    }
  }

  function handleQueryTypeChange(newType: QueryType) {
    setQueryType(newType);
    if (connectionType === 'eks') {
      setQuery(sampleQueries.eks[newType]);
    }
  }

  const getEditorLanguage = () => {
    if (connectionType === 'snowflake' || queryType === 'sql') {
      return 'sql';
    }
    return 'shell'; // For kubectl commands
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4caf50';
      case 'connecting': return '#ff9800';
      case 'error': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <div style={{ width: '1000px', fontFamily: 'Arial, sans-serif' }}>
      {/* Connection Controls */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '15px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '4px',
        border: '1px solid #ddd'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Connection Settings</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
          <div>
            <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Connection Type:</label>
            <select 
              value={connectionType} 
              onChange={(e) => handleConnectionTypeChange(e.target.value as ConnectionType)}
              style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="snowflake">Snowflake</option>
              <option value="eks">EKS Cluster</option>
            </select>
          </div>

          {connectionType === 'eks' && (
            <div>
              <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Query Type:</label>
              <select 
                value={queryType} 
                onChange={(e) => handleQueryTypeChange(e.target.value as QueryType)}
                style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="sql">SQL-like</option>
                <option value="kubectl">kubectl</option>
              </select>
            </div>
          )}

          <button
            onClick={testConnection}
            disabled={connectionStatus === 'connecting'}
            style={{
              padding: '8px 16px',
              backgroundColor: connectionStatus === 'connecting' ? '#ccc' : '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: connectionStatus === 'connecting' ? 'not-allowed' : 'pointer',
            }}
          >
            {connectionStatus === 'connecting' ? 'Testing...' : 'Test Connection'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '50%', 
                backgroundColor: getConnectionStatusColor() 
              }}
            />
            <span style={{ fontSize: '14px', textTransform: 'capitalize' }}>
              {connectionStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div style={{ height: '400px', border: '1px solid #ccc', marginBottom: '10px' }}>
        <Editor
          height="100%"
          width="100%"
          language={getEditorLanguage()}
          value={query}
          theme="vs-dark"
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            autoIndent: 'full',
          }}
        />
      </div>
      
      {/* Execute Button */}
      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={executeQuery}
          disabled={isExecuting || !query.trim()}
          style={{
            padding: '12px 24px',
            backgroundColor: isExecuting ? '#ccc' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isExecuting ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {isExecuting ? 'Executing...' : 
           connectionType === 'snowflake' ? 'Execute SQL' : 
           queryType === 'sql' ? 'Execute Query' : 'Execute kubectl'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          color: '#d32f2f',
          marginBottom: '15px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '15px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Results:</h3>
          
          {results.columns ? (
            <div>
              <p style={{ marginBottom: '10px' }}>
                <strong>Rows returned:</strong> {results.rowCount}
              </p>
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  backgroundColor: 'white',
                  minWidth: '600px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      {results.columns.map((column, index) => (
                        <th key={index} style={{ 
                          padding: '10px', 
                          border: '1px solid #ddd',
                          textAlign: 'left',
                          fontWeight: 'bold',
                          position: 'sticky',
                          top: 0,
                          backgroundColor: '#f0f0f0'
                        }}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.rows?.map((row, rowIndex) => (
                      <tr key={rowIndex} style={{ 
                        backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f8f8f8' 
                      }}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} style={{ 
                            padding: '10px', 
                            border: '1px solid #ddd',
                            wordBreak: 'break-all'
                          }}>
                            {String(cell || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <pre style={{ 
                backgroundColor: 'white', 
                padding: '15px', 
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {results.message}
              </pre>
              {results.rowsAffected && (
                <p style={{ marginTop: '10px' }}>
                  <strong>Rows affected:</strong> {results.rowsAffected}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;