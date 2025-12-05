// Test script to verify Giphy API key
require('dotenv').config();

console.log('=== Giphy API Key Test ===');
console.log('GIPHY_API_KEY exists:', !!process.env.GIPHY_API_KEY);
console.log('GIPHY_API_KEY length:', process.env.GIPHY_API_KEY?.length || 0);
console.log('GIPHY_API_KEY preview:', process.env.GIPHY_API_KEY ? 
  `${process.env.GIPHY_API_KEY.substring(0, 4)}...${process.env.GIPHY_API_KEY.substring(process.env.GIPHY_API_KEY.length - 4)}` : 
  'N/A'
);
console.log('All GIPHY env vars:', Object.keys(process.env).filter(key => key.includes('GIPHY')));

// Test actual API call
if (process.env.GIPHY_API_KEY) {
  console.log('\n=== Testing Giphy API ===');
  fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${process.env.GIPHY_API_KEY}&limit=1&rating=g`)
    .then(res => res.json())
    .then(data => {
      if (data.data && data.data.length > 0) {
        console.log('✅ Giphy API works! Got', data.data.length, 'GIF(s)');
      } else if (data.message) {
        console.log('❌ Giphy API error:', data.message);
      } else {
        console.log('❌ Unexpected response:', data);
      }
    })
    .catch(err => {
      console.log('❌ Fetch error:', err.message);
    });
} else {
  console.log('\n❌ Cannot test API - no key found');
}
