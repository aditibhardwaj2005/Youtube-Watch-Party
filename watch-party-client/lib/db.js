import { Pool } from 'pg';

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
});

(async () => {
    try {
        const client = await pool.connect();
        console.log("✅ PostgreSQL Connected Successfully!");
        client.release();
    } catch (error) {
        console.error("❌ PostgreSQL Connection Failed (Initial Check):", error.message);
    }
})();

export default pool;