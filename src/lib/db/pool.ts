import mysql from 'mysql2/promise'

// MySQL 8.0 bağlantı havuzu — Docker versiyonunda Supabase yerine kullanılır
const pool = mysql.createPool({
    host:               process.env.MYSQL_HOST     ?? 'localhost',
    port:               parseInt(process.env.MYSQL_PORT ?? '3306', 10),
    user:               process.env.MYSQL_USER     ?? 'teker',
    password:           process.env.MYSQL_PASSWORD ?? 'teker123',
    database:           process.env.MYSQL_DATABASE ?? 'teker_market',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           '+00:00',
    charset:            'utf8mb4',
    // JSON sütunlarını otomatik parse et
    typeCast(field, next) {
        if (field.type === 'JSON') {
            const val = field.string()
            if (val === null) return null
            try { return JSON.parse(val) } catch { return val }
        }
        // TINYINT(1) → boolean
        if (field.type === 'TINY' && field.length === 1) {
            return field.string() === '1'
        }
        return next()
    },
})

export default pool
