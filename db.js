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

function seedDatabase() {

    // Проверяем, есть ли уже Земфирка (пользователь)
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    if (userCount > 0) {
        console.log("Ура, Земфира на сцене!");
        return;
    }

    console.log("Земфира готовиться...");

    // Хэшируем пароли как попросил начальника

    const adminPass = bcrypt.hashSync("qwerty123", 10);
    const userPass = bcrypt.hashSync("qwerty123", 10);

    // Добавляем Земфирку и Админа
    const insertUser = db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
    insertUser.run("admin", "Makulatura@gmail.com", adminPass, "admin");
    insertUser.run("user", "Zemfira@gmail.com", userPass, "user");

    // Краду апельсины у Земфиры
    const admin = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get("user");

    const insertBook = db.prepare(`
        INSERT INTO books (title, author, year, genre, description, createdBy)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const books = [
        ["Нейт диаз", "Макулатура",  2016, "хип-хоп", "рэп", admin.id],
        ["Вечеринка у Децла", "Detsl", 1999 , "хип-хоп", "рэп", admin.id],
        ["ПЛМ", "Мелатонин", 2024, "альтернативный рок", "амбасадор", admin.id],
        ["Ice Baby", "Гуф", 2009, "хип-хоп", "рэп", admin.id],
        ["Heavenly", " Cigarettes After Sex", 2019, "рок", "поп", user.id],
    ];
    // Это все правда книги так женя сказала


    const bookIds = [];
    for (const book of books) {
        const info = insertBook.run(...book);
        bookIds.push(info.lastInsertRowid);
    }

    // Делаем отзывы 
    const insertReview = db.prepare(`
        INSERT INTO reviews (bookId, userId, rating, comment) VALUES (?, ?, ?, ?)
    `);
    const reviews = [
        [bookIds[0], user.id, 5, "Словил тильт, мне понравиллось"],
        [bookIds[1], user.id, 4, "Лучше чем ничего"],
        [bookIds[2], user.id, 5, "Эээ...ну да вроде норм"],
        [bookIds[3], admin.id, 5, "Лучше чем балерина капучино"],
        [bookIds[4], admin.id, 4, "ОГО ЗДЕСЬ НЕТ ЦЕНЗУРЫ"],
    ];
    for (const review of reviews) {
        insertReview.run(...review);
    }

    console.log("Да поменял я все.");
}


seedDatabase();
module.exports = db;