const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'coures_select',
})
db.connect();
module.exports = db;
