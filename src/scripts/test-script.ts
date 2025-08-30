console.log('Test script is running!');
console.log('This is a test to verify script execution.');

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
  await test();
  console.log('All tests completed!');
})();
