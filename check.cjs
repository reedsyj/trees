const https = require('https');
const urls = [
  'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00',
  'https://images.unsplash.com/photo-1562690868-60bbe7293e94',
  'https://images.unsplash.com/photo-1611073052081-5caa00b34a0a',
  'https://images.unsplash.com/photo-1599598425947-330026293905',
  'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11',
  'https://images.unsplash.com/photo-1593482892290-f54927ae1bb6'
];
urls.forEach(url => {
  https.get(url, (res) => {
    console.log(url, res.statusCode);
  }).on('error', (e) => {
    console.error(url, e.message);
  });
});
