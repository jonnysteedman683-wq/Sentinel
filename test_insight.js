fetch('http://localhost:3000/api/generate-insight', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer test-token' // Will make getUidFromRequest return "test-token"
  }
}).then(r => r.text()).then(console.log).catch(console.error);
