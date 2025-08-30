console.log('Basic test script is running!');
console.log('Node.js version:', process.version);

// Test async/await
async function test() {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log('Async test completed!');
      resolve(true);
    }, 1000);
  });
}

(async () => {
  console.log('Starting async test...');
  await test();
  console.log('All tests completed successfully!');
  process.exit(0);
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
