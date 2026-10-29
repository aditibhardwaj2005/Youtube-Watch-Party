import pool from "@/lib/db";

export default async function handler(req, res) {
  try {
    const client = await pool.connect();
    const { rows } = await client.query('SELECT NOW()');
    client.release();
    res.status(200).json({ message: "PostgreSQL Connected!", time: rows[0].now });
  } catch (error) {
    res.status(500).json({ error: "❌ PostgreSQL Connection Failed", details: error.message });
  }
}