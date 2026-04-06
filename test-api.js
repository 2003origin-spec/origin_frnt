const http = require('http');

http.get('http://localhost:3000/api/assessments/ogcode/questions/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Returned questions:', parsed.length);
    } catch(e) {
      console.log('Error parsing:', e.message);
    }
  });
}).on('error', err => console.log(err));
