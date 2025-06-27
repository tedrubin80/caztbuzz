// scripts/generate-password.js
// Utility script to generate bcrypt password hashes

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('=== CastBuzz Password Hash Generator ===\n');

rl.question('Enter password to hash (or press Enter for default "ChangeMe123!"): ', async (password) => {
    const passwordToHash = password || 'ChangeMe123!';
    
    rl.question('Enter bcrypt rounds (or press Enter for default 10): ', async (rounds) => {
        const bcryptRounds = parseInt(rounds) || 10;
        
        console.log('\nGenerating hash...');
        
        try {
            const hash = await bcrypt.hash(passwordToHash, bcryptRounds);
            
            console.log('\n=== Result ===');
            console.log('Password:', passwordToHash);
            console.log('Rounds:', bcryptRounds);
            console.log('Hash:', hash);
            console.log('\n=== SQL Update Command ===');
            console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@castbuzz.com';`);
            console.log('\n✅ Done! Copy the hash above to use in your database.');
            
            // Verify the hash works
            const isValid = await bcrypt.compare(passwordToHash, hash);
            console.log('Verification:', isValid ? '✅ Hash verified successfully' : '❌ Hash verification failed');
            
        } catch (error) {
            console.error('Error generating hash:', error);
        }
        
        rl.close();
    });
});

rl.on('close', () => {
    process.exit(0);
});