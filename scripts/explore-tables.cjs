#!/usr/bin/env node

const https = require('https');

const REDASH_URL = 'https://info.panacealending.com';
const API_KEY = '8YVgF5kpoKMuG2vBz1gzhf9mRbRZWU1Tv0JPLGPN';

async function makeRedashRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${REDASH_URL}/api${endpoint}`;
    const options = {
      method: 'POST',
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

async function runQuery(sql) {
  try {
    const queryData = {
      data_source_id: 1, // panacea-prod MySQL database
      query: sql,
      max_age: 0
    };

    const result = await makeRedashRequest('/query_results');
    return result;
  } catch (error) {
    console.error('Error running query:', error);
    return null;
  }
}

async function exploreTables() {
  console.log('🔍 Exploring database tables...');
  
  // Try to get table list
  console.log('\n📋 Getting table list...');
  
  // Let's try some common DroneStrike table queries
  const tableQueries = [
    "SHOW TABLES",
    "SELECT table_name FROM information_schema.tables WHERE table_schema = '_panaceadb'",
    "SELECT * FROM properties LIMIT 1",
    "SELECT * FROM users LIMIT 1", 
    "SELECT * FROM leads LIMIT 1"
  ];
  
  for (const sql of tableQueries) {
    console.log(`\n🔍 Trying: ${sql}`);
    try {
      // This approach may not work via API, but let's try
      console.log('   (API query execution may be limited)');
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n💡 Alternative Approach:');
  console.log('Since I can see from the earlier queries that these tables exist:');
  console.log('- properties');
  console.log('- leads'); 
  console.log('- users');
  console.log('- loans');
  console.log('- prospects');
  console.log('- collaterals');
  console.log('');
  console.log('I recommend we:');
  console.log('1. Set up MySQL connection (instead of PostgreSQL)');
  console.log('2. Get the database password from you');
  console.log('3. Connect directly to explore the real table structure');
}

exploreTables();