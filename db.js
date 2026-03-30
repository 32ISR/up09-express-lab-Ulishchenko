const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database("./database.db");

// Включаем поддержку внешних ключей
db.pragma('foreign_keys = ON'); 


// Мой замечательный супер пупер код
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        year INTEGER,
        genre TEXT,
        description TEXT,
        createdBy INTEGER NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
`);
module.exports = db;