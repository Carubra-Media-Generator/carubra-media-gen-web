const { creditUserCoinsByEmail } = require('../lib/coins.ts');

async function addCoins() {
  try {
    const result = await creditUserCoinsByEmail('user7@gmail.com', 20);
    console.log(`Successfully added 20 coins to user7@gmail.com. New balance: ${result}`);
  } catch (error) {
    console.error('Error adding coins:', error);
  }
}

addCoins();
