const Database = require('better-sqlite3');
const path = require('path');


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
`);

module.exports = db;