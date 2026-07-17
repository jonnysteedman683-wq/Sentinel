const header = { alg: "HS256", typ: "JWT" };
const payload = { user_id: "test-user-123" };
const token = Buffer.from(JSON.stringify(header)).toString('base64') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.signature';

fetch('http://localhost:3000/api/generate-insight', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  }
}).then(r => r.text()).then(console.log).catch(console.error);
