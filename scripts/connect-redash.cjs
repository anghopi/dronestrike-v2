#!/usr/bin/env node

// Script to connect to Redash and get database information
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

    console.log(`🔍 Fetching: ${url}`);

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
          console.error('❌ Error parsing JSON:', error);
          console.error('📄 Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });

    req.end();
  });
}

async function exploreRedash() {
  try {
    console.log('🚀 Connecting to Redash at:', REDASH_URL);
    
    // Get data sources
    console.log('\n📊 Fetching data sources...');
    const dataSources = await makeRedashRequest('/data_sources');
    
    console.log('\n✅ Data Sources Found:');
    dataSources.forEach((source, index) => {
      console.log(`${index + 1}. ${source.name} (${source.type})`);
      console.log(`   ID: ${source.id}`);
      if (source.options) {
        console.log(`   Host: ${source.options.host || 'N/A'}`);
        console.log(`   Database: ${source.options.dbname || source.options.database || 'N/A'}`);
        console.log(`   Port: ${source.options.port || 'N/A'}`);
        console.log(`   User: ${source.options.user || 'N/A'}`);
      }
      console.log('');
    });

    // Get queries to understand table structure
    console.log('\n📋 Fetching recent queries...');
    const queries = await makeRedashRequest('/queries?page_size=20');
    
    console.log('\n✅ Recent Queries (showing table names):');
    const tableNames = new Set();
    
    queries.results.slice(0, 10).forEach((query, index) => {
      console.log(`${index + 1}. ${query.name}`);
      
      // Extract table names from SQL query
      const sql = query.query.toLowerCase();
      const fromMatches = sql.match(/from\s+(\w+)/g);
      const joinMatches = sql.match(/join\s+(\w+)/g);
      
      if (fromMatches) {
        fromMatches.forEach(match => {
          const tableName = match.replace(/from\s+/, '');
          tableNames.add(tableName);
        });
      }
      
      if (joinMatches) {
        joinMatches.forEach(match => {
          const tableName = match.replace(/join\s+/, '');
          tableNames.add(tableName);
        });
      }
    });

    console.log('\n📋 Detected Table Names:');
    Array.from(tableNames).sort().forEach(table => {
      console.log(`   - ${table}`);
    });

    // Get user info
    console.log('\n👤 User Information:');
    try {
      const user = await makeRedashRequest('/users/me');
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Groups: ${user.groups.map(g => g.name).join(', ')}`);
    } catch (error) {
      console.log('   ⚠️  Could not fetch user info');
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Choose the appropriate data source for your database');
    console.log('2. Update your .env file with the connection details');
    console.log('3. Test the database connection');

  } catch (error) {
    console.error('❌ Error exploring Redash:', error);
    process.exit(1);
  }
}

// Run the exploration
exploreRedash();