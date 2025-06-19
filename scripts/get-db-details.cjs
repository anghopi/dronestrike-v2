#!/usr/bin/env node

// Script to get specific database connection details
const https = require('https');

const REDASH_URL = 'https://info.panacealending.com';
const API_KEY = '8YVgF5kpoKMuG2vBz1gzhf9mRbRZWU1Tv0JPLGPN';

async function makeRedashRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${REDASH_URL}/api${endpoint}`;
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Key ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function getDbConnectionDetails() {
  try {
    console.log('🔍 Getting detailed database connection info...');
    
    // Get the panacea-prod data source details
    const dataSource = await makeRedashRequest('/data_sources/1'); // ID 1 is panacea-prod
    
    console.log('\n📊 Database Connection Details:');
    console.log('=================================');
    console.log(`Name: ${dataSource.name}`);
    console.log(`Type: ${dataSource.type}`);
    
    if (dataSource.options) {
      console.log(`Host: ${dataSource.options.host || 'Not specified'}`);
      console.log(`Port: ${dataSource.options.port || 'Default (3306 for MySQL)'}`);
      console.log(`Database: ${dataSource.options.db || dataSource.options.database || 'Not specified'}`);
      console.log(`User: ${dataSource.options.user || 'Not specified'}`);
      console.log(`SSL: ${dataSource.options.use_ssl ? 'Enabled' : 'Disabled'}`);
    }
    
    // Try to get schema information
    console.log('\n📋 Checking schema...');
    try {
      const schemas = await makeRedashRequest('/data_sources/1/schema');
      
      console.log('\n✅ Available Tables:');
      Object.keys(schemas).slice(0, 20).forEach(tableName => {
        const table = schemas[tableName];
        console.log(`📋 ${tableName}`);
        if (table.columns) {
          const keyColumns = table.columns.slice(0, 5).map(col => col.name).join(', ');
          console.log(`   Columns: ${keyColumns}${table.columns.length > 5 ? ', ...' : ''}`);
        }
      });
      
      // Focus on key DroneStrike tables
      const keyTables = ['properties', 'leads', 'users', 'loans', 'prospects', 'missions'];
      console.log('\n🎯 Key DroneStrike Tables:');
      keyTables.forEach(tableName => {
        if (schemas[tableName]) {
          console.log(`✅ ${tableName} - ${schemas[tableName].columns.length} columns`);
        } else {
          console.log(`❌ ${tableName} - Not found`);
        }
      });
      
    } catch (schemaError) {
      console.log('⚠️  Could not fetch schema details');
    }
    
    console.log('\n💡 Suggested Environment Variables:');
    console.log('=====================================');
    console.log('# Update your .env file with these values:');
    if (dataSource.options) {
      console.log(`DATABASE_HOST=${dataSource.options.host || 'your-mysql-host'}`);
      console.log(`DATABASE_PORT=${dataSource.options.port || '3306'}`);
      console.log(`DATABASE_USER=${dataSource.options.user || 'your-username'}`);
      console.log(`DATABASE_PASSWORD=your-password-here`);
      console.log(`DATABASE_NAME=${dataSource.options.db || dataSource.options.database || 'your-database-name'}`);
      console.log(`DATABASE_URL=mysql://${dataSource.options.user || 'user'}:password@${dataSource.options.host || 'host'}:${dataSource.options.port || '3306'}/${dataSource.options.db || 'database'}`);
    }
    
  } catch (error) {
    console.error('❌ Error getting database details:', error);
  }
}

getDbConnectionDetails();