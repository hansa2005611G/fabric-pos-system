const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

async function setupAdmin() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Hash the password
    const password = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    console.log('✅ Password hashed');

    // Check if admin exists
    const checkQuery = 'SELECT * FROM users WHERE username = $1';
    const checkResult = await client.query(checkQuery, ['admin']);

    if (checkResult.rows.length > 0) {
      // Update existing admin
      const updateQuery = `
        UPDATE users 
        SET password_hash = $1
        WHERE username = 'admin'
        RETURNING user_id, username, full_name, role
      `;
      const result = await client.query(updateQuery, [passwordHash]);
      console.log('✅ Admin password updated');
      console.log('Admin user:', result.rows[0]);
    } else {
      // Create new admin
      const insertQuery = `
        INSERT INTO users (username, password_hash, full_name, role, branch_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING user_id, username, full_name, role
      `;
      const result = await client.query(insertQuery, [
        'admin',
        passwordHash,
        'System Admin',
        'admin',
        1
      ]);
      console.log('✅ Admin user created');
      console.log('Admin user:', result.rows[0]);
    }

    console.log('\n🔐 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n⚠️  Change this password in production!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

setupAdmin();