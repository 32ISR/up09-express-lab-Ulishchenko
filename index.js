const express = require("express")
const db = require("./db")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cors = require("cors")
const app = express()

app.use(express.json())
app.use(cors())

const PORT = 3000
const SECRET = "Zemfira"

//Мидл ВАРКА
const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "Failed to provide token" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Token has invalid form" });
    }

    try {
        const decoded = jwt.verify(token, SECRET);
        const user = db
            .prepare("SELECT * FROM users WHERE id = ?")
            .get(decoded.id);

        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }

        req.user = user;
        next();

    } catch (err) {
        return res.status(403).json({ message: "Missing data" });
    }
};

//Роль Мидл ВАРКИ
function checkRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "На концерт не пустим" });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "У вас нет прав" });
        }

        next();
    };
}

// Зарегаемся 
app.post("/api/auth/register", (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: "Not all data" });
        }
        const existing = db
            .prepare("SELECT id FROM users WHERE email = ? OR username = ?")
            .get(email, username);

        if (existing) {
            return res.status(409).json({ error: "User already exists" });
        }
        const oxymiron = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, oxymiron);

        const role = "user";
        const info = db.prepare(`
            INSERT INTO users (username, email, password, role)
            VALUES (?, ?, ?, ?)
        `).run(username, email, hash, role);

        const user = db
            .prepare("SELECT * FROM users WHERE id = ?")
            .get(info.lastInsertRowid);

        const { password: _, ...safeUser } = user;
        const token = jwt.sign({ ...safeUser }, SECRET, { expiresIn: "24h" });

        return res.status(201).json({ token, user: safeUser });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Mistake" });
    }
});
// логин
app.post("/api/auth/login", (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Missing data" });
        }
        const user = db
            .prepare("SELECT * FROM users WHERE email = ?")
            .get(email);

        if (!user) {
            return res.status(401).json({ error: "Invalid" });
        }
        const valid = bcrypt.compareSync(password, user.password);

        if (!valid) {
            return res.status(401).json({ error: "Invalid" });
        }

        const { password: _, ...safeUser } = user;
        const token = jwt.sign({ ...safeUser }, SECRET, { expiresIn: "24h" });

        return res.status(200).json({ token, user: safeUser });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Unexpected error" });
    }
});

app.get("/api/auth/profile", (req, res) => {
    return res.status(200).json(req)
});

// все книги 
app.get("/api/books", (req, res) => {
    try {
        const { author, genre } = req.query;
        let query = ` SELECT books.*, users.username AS added_by FROM books JOIN users ON books.createdBy = users.id `;
        let params = [];

        if (author) {
            query += " WHERE books.author = ?";
            params.push(author);
        } else if (genre) {
            query += " WHERE books.genre = ?";
            params.push(genre);
        }
        const books = params.length
            ? db.prepare(query).all(...params)
            : db.prepare(query).all();

        return res.status(200).json(books);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed" });
    }
});

// книга по id
app.get("/api/books/:id", (req, res) => {
    try {
        const { id } = req.params;

        const book = db.prepare(` SELECT books.*, users.username AS added_by FROM books JOIN users ON books.createdBy = users.id WHERE books.id = ? `).get(id);

        if (!book) {
            return res.status(404).json({ error: "Book not found" });
        }
        const reviews = db.prepare(` SELECT reviews.*, users.username FROM reviews JOIN users ON reviews.userId = users.id WHERE reviews.bookId = ? `).all(id);
        return res.status(200).json({ ...book, reviews });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed" });
    }
});

// создаем 
app.post("/api/books", auth, (req, res) => {
    try {
        const { title, author, year, genre, description } = req.body;

        if (!title || !author) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const info = db.prepare(` 
            INSERT INTO books (title, author, year, genre, description, createdBy) VALUES (?, ?, ?, ?, ?, ?) `).run(title, author, year, genre, description, req.user.id);
        const Detsl = db
            .prepare("SELECT * FROM books WHERE id = ?")
            .get(info.lastInsertRowid);

        return res.status(201).json(Detsl);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed" });
    }
});


// стираем из памяти
app.delete("/api/books/:id", auth, (req, res) => {
    try {
        const { id } = req.params;
        const book = db.prepare("SELECT * FROM books WHERE id = ?").get(id);

        if (!book) {
            return res.status(404).json({ error: "Not found" });
        }
        if (req.user.role !== "admin" && book.createdBy !== req.user.id) {
            return res.status(403).json({ error: "Not allowed" });
        }
        db.prepare("DELETE FROM books WHERE id = ?").run(id);
        return res.status(200).json({ message: "Deleted successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to delete" });
    }
});

// добавить отзыв
app.post("/api/books/:id/reviews", auth, (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        if (!rating) {
            return res.status(400).json({ error: "Rating required" });
        }

        db.prepare(` INSERT INTO reviews (bookId, userId, rating, comment) VALUES (?, ?, ?, ?) `).run(id, req.user.id, rating, comment);
        return res.status(201).json({ message: "Review created" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed" });
    }
});

// Тетрадь позитива
app.get("/api/admin/users", auth, (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ error: "Not allowed" });
        }
        const users = db.prepare("SELECT id, username, email, role FROM users").all();
        return res.status(200).json(users);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to fetch users" });
    }
});

app.listen(PORT)