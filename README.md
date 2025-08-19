# SQL Editor with Snowflake and EKS Support

A Monaco Editor-based SQL editor that can connect to both Snowflake databases and EKS clusters.

## Features

### Snowflake Support
- Execute SQL queries against Snowflake databases
- Syntax highlighting for SQL
- Connection testing
- Schema and table browsing
- Result display in tabular format

### EKS Support
- Execute kubectl commands
- SQL-like queries for Kubernetes resources
- Support for `SELECT * FROM PODS/NODES/DEPLOYMENTS/SERVICES`
- Native kubectl command execution
- Connection status monitoring

## Setup Instructions

### 1. Install Backend Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure your connections:

```bash
cp .env.example .env
```

Edit the `.env` file with your actual credentials:

**For Snowflake:**
```env
SNOWFLAKE_ACCOUNT=your-account-name
SNOWFLAKE_USERNAME=your-username
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_WAREHOUSE=your-warehouse
SNOWFLAKE_DATABASE=your-database
SNOWFLAKE_SCHEMA=your-schema
SNOWFLAKE_ROLE=your-role
```

**For EKS:**
```env
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
EKS_CLUSTER_NAME=your-cluster-name
EKS_CLUSTER_REGION=us-west-2
```

### 3. Start the Backend Server

```bash
cd server
npm run dev
```

The server will start on `http://localhost:3001`

### 4. Start the Frontend

In a new terminal:

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

## Usage

### Snowflake Queries

1. Select "Snowflake" as connection type
2. Click "Test Connection" to verify your connection
3. Write SQL queries in the editor
4. Click "Execute SQL" to run queries

Example queries:
```sql
-- Get current user and database info
SELECT CURRENT_VERSION(), CURRENT_USER(), CURRENT_DATABASE();

-- List tables in current schema
SELECT * FROM INFORMATION_SCHEMA.TABLES LIMIT 10;

-- Query your data
SELECT * FROM your_table_name LIMIT 100;
```

### EKS Queries

1. Select "EKS Cluster" as connection type
2. Choose query type:
   - **SQL-like**: Use familiar SQL syntax for Kubernetes resources
   - **kubectl**: Execute native kubectl commands

#### SQL-like Queries
```sql
-- Get all pods
SELECT * FROM PODS;

-- Get all nodes
SELECT * FROM NODES;

-- Get all deployments
SELECT * FROM DEPLOYMENTS;

-- Get all services
SELECT * FROM SERVICES;
```

#### kubectl Commands
```bash
# Get pods in all namespaces
get pods --all-namespaces

# Get nodes
get nodes

# Get deployments
get deployments

# Describe a specific pod
describe pod <pod-name>

# Get logs from a pod
logs <pod-name>
```

## API Endpoints

### Snowflake
- `GET /api/snowflake/test-connection` - Test Snowflake connection
- `POST /api/snowflake/execute` - Execute SQL query
- `GET /api/snowflake/schemas` - List available schemas
- `GET /api/snowflake/tables` - List tables in current schema

### EKS
- `GET /api/eks/test-connection` - Test EKS connection
- `POST /api/eks/execute` - Execute kubectl command or SQL-like query
- `GET /api/eks/namespaces` - List Kubernetes namespaces
- `GET /api/eks/namespaces/:namespace/pods` - List pods in a namespace

## Security Features

- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- SQL injection protection for Snowflake
- Command whitelist for kubectl execution
- Environment variable configuration for sensitive credentials

## Prerequisites

### For Snowflake
- Valid Snowflake account and credentials
- Network access to your Snowflake instance

### For EKS
- AWS CLI configured or AWS credentials set
- kubectl installed and configured
- Access to EKS cluster
- Appropriate IAM permissions for EKS access

## Troubleshooting

### Snowflake Connection Issues
1. Verify your account name format (should be `<org>-<account>`)
2. Check network connectivity
3. Ensure user has necessary permissions
4. Verify warehouse is running

### EKS Connection Issues
1. Check AWS credentials are properly configured
2. Verify kubectl is installed and in PATH
3. Ensure kubeconfig is properly set up
4. Check IAM permissions for EKS access
5. Verify cluster name and region are correct

### Backend Server Issues
1. Check if all environment variables are set
2. Verify backend server is running on port 3001
3. Check CORS settings if frontend can't connect
4. Review server logs for detailed error messages

## Development

To extend functionality:

1. **Add new connection types**: Create new route files in `server/routes/`
2. **Add new query types**: Extend the frontend connection type selector
3. **Add new features**: Modify the Monaco Editor configuration or add new UI components

## Dependencies

### Backend
- Express.js - Web framework
- snowflake-sdk - Snowflake database connector
- @kubernetes/client-node - Kubernetes API client
- cors, helmet - Security middleware

### Frontend
- React - UI framework
- Monaco Editor - Code editor
- TypeScript - Type safety