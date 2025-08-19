import express from 'express';
import { KubeConfig, CoreV1Api, AppsV1Api, CustomObjectsApi } from '@kubernetes/client-node';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize Kubernetes client
function initializeKubeClient() {
  const kc = new KubeConfig();
  
  try {
    // Try to load from default kubeconfig or environment
    if (process.env.KUBECONFIG_PATH) {
      kc.loadFromFile(process.env.KUBECONFIG_PATH);
    } else {
      kc.loadFromDefault();
    }
    
    const coreV1Api = kc.makeApiClient(CoreV1Api);
    const appsV1Api = kc.makeApiClient(AppsV1Api);
    const customApi = kc.makeApiClient(CustomObjectsApi);
    
    return { kc, coreV1Api, appsV1Api, customApi };
  } catch (error) {
    console.error('Failed to initialize Kubernetes client:', error.message);
    throw error;
  }
}

// Helper function to execute kubectl commands
function executeKubectl(command, args = []) {
  return new Promise((resolve, reject) => {
    const kubectl = spawn('kubectl', [command, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    kubectl.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    kubectl.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    kubectl.on('close', (code) => {
      if (code === 0) {
        try {
          // Try to parse as JSON, fallback to plain text
          const result = stdout.trim();
          resolve(result.startsWith('{') || result.startsWith('[') ? JSON.parse(result) : result);
        } catch (error) {
          resolve(stdout.trim());
        }
      } else {
        reject(new Error(`kubectl command failed: ${stderr || stdout}`));
      }
    });
    
    kubectl.on('error', (error) => {
      reject(new Error(`Failed to execute kubectl: ${error.message}`));
    });
  });
}

// Test EKS connection
router.get('/test-connection', async (req, res) => {
  try {
    const { coreV1Api } = initializeKubeClient();
    
    // Test connection by getting cluster info
    const response = await coreV1Api.listNode();
    const nodes = response.body.items;
    
    res.json({
      success: true,
      message: 'Successfully connected to EKS cluster',
      data: {
        nodeCount: nodes.length,
        nodes: nodes.map(node => ({
          name: node.metadata.name,
          status: node.status.conditions.find(c => c.type === 'Ready')?.status || 'Unknown',
          version: node.status.nodeInfo.kubeletVersion,
          os: node.status.nodeInfo.osImage
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'EKS connection failed',
      message: error.message
    });
  }
});

// Execute kubectl commands (supporting SQL-like queries for Kubernetes resources)
router.post('/execute', async (req, res) => {
  const { query, queryType = 'kubectl' } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid query',
      message: 'Query must be a non-empty string'
    });
  }
  
  try {
    let result;
    const startTime = Date.now();
    
    if (queryType === 'kubectl') {
      // Parse kubectl-style commands
      const args = query.trim().split(/\s+/);
      const command = args[0];
      const commandArgs = args.slice(1);
      
      // Whitelist allowed commands for security
      const allowedCommands = [
        'get', 'describe', 'logs', 'top', 'explain',
        'api-resources', 'api-versions', 'cluster-info'
      ];
      
      if (!allowedCommands.includes(command)) {
        return res.status(400).json({
          success: false,
          error: 'Command not allowed',
          message: `Only these commands are allowed: ${allowedCommands.join(', ')}`
        });
      }
      
      result = await executeKubectl(command, commandArgs);
    } else if (queryType === 'sql') {
      // Parse SQL-like queries for Kubernetes (custom implementation)
      result = await executeSQLLikeQuery(query);
    } else {
      throw new Error('Invalid query type. Use "kubectl" or "sql"');
    }
    
    const executionTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: formatKubernetesResult(result),
      executionTime: `${executionTime}ms`,
      query: query.substring(0, 200),
      queryType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Query execution failed',
      message: error.message,
      query: query.substring(0, 200)
    });
  }
});

// SQL-like query executor for Kubernetes
async function executeSQLLikeQuery(sqlQuery) {
  const { coreV1Api, appsV1Api } = initializeKubeClient();
  
  // Simple SQL-like parser (you can extend this)
  const upperQuery = sqlQuery.toUpperCase().trim();
  
  if (upperQuery.startsWith('SELECT * FROM PODS')) {
    const response = await coreV1Api.listPodForAllNamespaces();
    return response.body.items.map(pod => ({
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      status: pod.status.phase,
      created: pod.metadata.creationTimestamp,
      restarts: pod.status.containerStatuses?.[0]?.restartCount || 0
    }));
  } else if (upperQuery.startsWith('SELECT * FROM DEPLOYMENTS')) {
    const response = await appsV1Api.listDeploymentForAllNamespaces();
    return response.body.items.map(deployment => ({
      name: deployment.metadata.name,
      namespace: deployment.metadata.namespace,
      replicas: deployment.status.replicas || 0,
      ready: deployment.status.readyReplicas || 0,
      available: deployment.status.availableReplicas || 0,
      created: deployment.metadata.creationTimestamp
    }));
  } else if (upperQuery.startsWith('SELECT * FROM SERVICES')) {
    const response = await coreV1Api.listServiceForAllNamespaces();
    return response.body.items.map(service => ({
      name: service.metadata.name,
      namespace: service.metadata.namespace,
      type: service.spec.type,
      clusterIP: service.spec.clusterIP,
      ports: service.spec.ports?.map(p => `${p.port}:${p.targetPort}/${p.protocol}`).join(', ') || 'N/A'
    }));
  } else if (upperQuery.startsWith('SELECT * FROM NODES')) {
    const response = await coreV1Api.listNode();
    return response.body.items.map(node => ({
      name: node.metadata.name,
      status: node.status.conditions.find(c => c.type === 'Ready')?.status || 'Unknown',
      version: node.status.nodeInfo.kubeletVersion,
      os: node.status.nodeInfo.osImage,
      arch: node.status.nodeInfo.architecture,
      created: node.metadata.creationTimestamp
    }));
  } else {
    throw new Error('Unsupported SQL query. Try: SELECT * FROM PODS|DEPLOYMENTS|SERVICES|NODES');
  }
}

// Format Kubernetes results for display
function formatKubernetesResult(result) {
  if (typeof result === 'string') {
    // Plain text result - convert to table format
    const lines = result.split('\\n').filter(line => line.trim());
    if (lines.length > 1) {
      // Assume first line is header
      const headers = lines[0].split(/\\s+/).filter(h => h);
      const rows = lines.slice(1).map(line => line.split(/\\s+/).filter(cell => cell));
      
      return {
        columns: headers,
        rows: rows,
        rowCount: rows.length
      };
    } else {
      return {
        message: result,
        rowCount: 0
      };
    }
  } else if (Array.isArray(result)) {
    // Array of objects - convert to table
    if (result.length === 0) {
      return {
        message: 'No results found',
        rowCount: 0
      };
    }
    
    const columns = Object.keys(result[0]);
    const rows = result.map(obj => columns.map(col => obj[col] || ''));
    
    return {
      columns: columns,
      rows: rows,
      rowCount: rows.length
    };
  } else {
    // Object result
    return {
      message: JSON.stringify(result, null, 2),
      rowCount: 1
    };
  }
}

// Get namespaces
router.get('/namespaces', async (req, res) => {
  try {
    const { coreV1Api } = initializeKubeClient();
    const response = await coreV1Api.listNamespace();
    
    const namespaces = response.body.items.map(ns => ({
      name: ns.metadata.name,
      status: ns.status.phase,
      created: ns.metadata.creationTimestamp
    }));
    
    res.json({
      success: true,
      data: {
        columns: ['name', 'status', 'created'],
        rows: namespaces.map(ns => [ns.name, ns.status, ns.created]),
        rowCount: namespaces.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch namespaces',
      message: error.message
    });
  }
});

// Get pods in a namespace
router.get('/namespaces/:namespace/pods', async (req, res) => {
  const { namespace } = req.params;
  
  try {
    const { coreV1Api } = initializeKubeClient();
    const response = await coreV1Api.listNamespacedPod(namespace);
    
    const pods = response.body.items.map(pod => ({
      name: pod.metadata.name,
      status: pod.status.phase,
      ready: pod.status.containerStatuses?.filter(c => c.ready).length || 0,
      restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
      age: pod.metadata.creationTimestamp
    }));
    
    res.json({
      success: true,
      data: {
        columns: ['name', 'status', 'ready', 'restarts', 'age'],
        rows: pods.map(pod => [pod.name, pod.status, pod.ready, pod.restarts, pod.age]),
        rowCount: pods.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pods',
      message: error.message
    });
  }
});

export default router;