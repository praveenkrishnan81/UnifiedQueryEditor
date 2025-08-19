import express from 'express';
import snowflake from 'snowflake-sdk';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Snowflake connection configuration
const snowflakeConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
  role: process.env.SNOWFLAKE_ROLE,
  clientSessionKeepAlive: true,
  clientSessionKeepAliveHeartbeatFrequency: 3600
};

// Helper function to create Snowflake connection
function createConnection() {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection(snowflakeConfig);
    
    connection.connect((err, conn) => {
      if (err) {
        console.error('Failed to connect to Snowflake:', err.message);
        reject(err);
      } else {
        console.log('Successfully connected to Snowflake');
        resolve(conn);
      }
    });
  });
}

// Helper function to execute SQL query
function executeQuery(connection, sqlText) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sqlText,
      complete: (err, stmt, rows) => {
        if (err) {
          console.error('Query execution failed:', err.message);
          reject(err);
        } else {
          // Get column metadata
          const columns = stmt.getColumns().map(col => ({
            name: col.getName(),
            type: col.getType(),
            nullable: col.isNullable()
          }));
          
          resolve({
            columns: columns.map(col => col.name),
            columnMetadata: columns,
            rows: rows || [],
            rowCount: rows ? rows.length : 0,
            executionTime: stmt.getStatementId()
          });
        }
      }
    });
  });
}

// Test Snowflake connection
router.get('/test-connection', async (req, res) => {
  let connection = null;
  
  try {
    connection = await createConnection();
    
    // Simple test query
    const result = await executeQuery(connection, 'SELECT CURRENT_VERSION() as VERSION, CURRENT_USER() as USER, CURRENT_DATABASE() as DATABASE');
    
    res.json({
      success: true,
      message: 'Successfully connected to Snowflake',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Connection failed',
      message: error.message
    });
  } finally {
    if (connection) {
      connection.destroy((err) => {
        if (err) console.error('Error closing connection:', err.message);
      });
    }
  }
});

// Execute SQL query
router.post('/execute', async (req, res) => {
  const { query } = req.body;
  let connection = null;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid query',
      message: 'Query must be a non-empty string'
    });
  }

  // Basic SQL injection protection (you should add more robust validation)
  const suspiciousPatterns = [
    /drop\s+table/i,
    /drop\s+database/i,
    /delete\s+from.*where\s*1\s*=\s*1/i,
    /union.*select/i
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(query))) {
    return res.status(400).json({
      success: false,
      error: 'Query blocked',
      message: 'Query contains potentially dangerous operations'
    });
  }
  
  try {
    const startTime = Date.now();
    connection = await createConnection();
    const result = await executeQuery(connection, query);
    const executionTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: result,
      executionTime: `${executionTime}ms`,
      query: query.substring(0, 200) // Return first 200 chars for confirmation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Query execution failed',
      message: error.message,
      query: query.substring(0, 200)
    });
  } finally {
    if (connection) {
      connection.destroy((err) => {
        if (err) console.error('Error closing connection:', err.message);
      });
    }
  }
});

// Get database schemas
router.get('/schemas', async (req, res) => {
  let connection = null;
  
  try {
    connection = await createConnection();
    const result = await executeQuery(connection, `
      SELECT 
        DATABASE_NAME,
        SCHEMA_NAME,
        SCHEMA_OWNER,
        CREATED,
        LAST_ALTERED
      FROM INFORMATION_SCHEMA.SCHEMATA
      ORDER BY DATABASE_NAME, SCHEMA_NAME
    `);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schemas',
      message: error.message
    });
  } finally {
    if (connection) {
      connection.destroy((err) => {
        if (err) console.error('Error closing connection:', err.message);
      });
    }
  }
});

// Get tables in current database/schema
router.get('/tables', async (req, res) => {
  let connection = null;
  
  try {
    connection = await createConnection();
    const result = await executeQuery(connection, `
      SELECT 
        TABLE_CATALOG,
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE,
        CREATED,
        LAST_ALTERED,
        ROW_COUNT,
        BYTES
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = CURRENT_SCHEMA()
      ORDER BY TABLE_NAME
    `);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tables',
      message: error.message
    });
  } finally {
    if (connection) {
      connection.destroy((err) => {
        if (err) console.error('Error closing connection:', err.message);
      });
    }
  }
});

export default router;