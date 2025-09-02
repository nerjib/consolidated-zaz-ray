
const { Client } = require('pg');

const dbConfig = {
    HOST: "localhost",
    USER: "postgres",
    PASSWORD: "1886",
    DB: "postgres",
};

const client = new Client({
    host: dbConfig.HOST,
    user: dbConfig.USER,
    password: dbConfig.PASSWORD,
    database: dbConfig.DB,
});

async function findPlatformOwner() {
    try {
        await client.connect();
        console.log('Connected to the database.');

        const res = await client.query('SELECT * FROM ray_users WHERE role = $1', ['platform-owner']);
        
        if (res.rows.length > 0) {
            console.log('Platform owner(s) found:');
            console.log(res.rows);
        } else {
            console.log('No platform owner found.');
        }
    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
        console.log('Disconnected from the database.');
    }
}

findPlatformOwner();
