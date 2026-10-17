const axios = require('axios');
const token = process.env.LAMIX_API_TOKEN || 'V5sNe9n8mmeXIatTnOb4NRrtK19h2Htys2PthS4BXKE';
const baseURL = 'https://panel.lamix.org';

async function testAll() {
  const headers = { 'Authorization': `Bearer ${token}` };
  
  console.log('--- 1. Testing /api/v1/ranges ---');
  try {
    const resRanges = await axios.get(`${baseURL}/api/v1/ranges`, { headers });
    console.log('Ranges Status:', resRanges.status);
    console.log('Ranges Data Sample:\n', JSON.stringify(resRanges.data, null, 2).slice(0, 1500));
  } catch (e) {
    console.log('Ranges Error:', e.response?.status, e.response?.data || e.message);
  }

  // Sleep 1.2s to respect 1s rate limit
  await new Promise(r => setTimeout(r, 1200));

  console.log('\n--- 2. Testing /api/v1/numbers ---');
  try {
    const resNumbers = await axios.get(`${baseURL}/api/v1/numbers?limit=5`, { headers });
    console.log('Numbers Status:', resNumbers.status);
    console.log('Numbers Data Sample:\n', JSON.stringify(resNumbers.data, null, 2).slice(0, 1500));
  } catch (e) {
    console.log('Numbers Error:', e.response?.status, e.response?.data || e.message);
  }

  await new Promise(r => setTimeout(r, 1200));

  console.log('\n--- 3. Testing /api/v1/cdrs ---');
  try {
    const resCdrs = await axios.get(`${baseURL}/api/v1/cdrs?limit=5`, { headers });
    console.log('Cdrs Status:', resCdrs.status);
    console.log('Cdrs Data Sample:\n', JSON.stringify(resCdrs.data, null, 2).slice(0, 1500));
  } catch (e) {
    console.log('Cdrs Error:', e.response?.status, e.response?.data || e.message);
  }

  await new Promise(r => setTimeout(r, 1200));

  console.log('\n--- 4. Testing /api/v1/messages ---');
  try {
    const resMsgs = await axios.get(`${baseURL}/api/v1/messages?limit=5`, { headers });
    console.log('Messages Status:', resMsgs.status);
    console.log('Messages Data Sample:\n', JSON.stringify(resMsgs.data, null, 2).slice(0, 1500));
  } catch (e) {
    console.log('Messages Error:', e.response?.status, e.response?.data || e.message);
  }
}

testAll();
