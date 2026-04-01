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
        const { username, email, password, role } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: "Not all data" });
        }
        const existingEmail = db
            .prepare("SELECT id FROM users WHERE email = ?")
            .get(email);
        const existingUsername = db
            .prepare("SELECT id FROM users WHERE username = ?")
            .get(username);

        if (existingEmail || existingUsername) {
            return res.status(409).json({ error: "User already exists" });
        }
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        const userRole = role === "admin" ? "admin" : "user";
        const info = db.prepare(`
            INSERT INTO users (username, email, password, role)
            VALUES (?, ?, ?, ?)
        `).run(username, email, hash, userRole);
        const user = db
            .prepare("SELECT id, username, email, role, createdAt FROM users WHERE id = ?")
            .get(info.lastInsertRowid);

        const token = jwt.sign({ ...user }, SECRET, { expiresIn: "24h" });
        return res.status(201).json({ token, user });
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
// Получить данные текущего пользователя
app.get("/api/auth/profile", auth, (req, res) => {
    try {
        const user = db.prepare(
            "SELECT * FROM users WHERE id = ?"
        ).get(req.user.id)
        const { password, ...safeUser } = user
        return res.status(200).json(safeUser)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Something wrong" })
    }
})
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

app.put("/api/books/:id", auth, (req, res) => {
    try {
        const { id } = req.params;
        const { title, author, year, genre, description } = req.body;
        const book = db.prepare("SELECT * FROM books WHERE id = ?").get(id);

        if (!book) {
            return res.status(404).json({ error: "Book not found" });
        }
        if (req.user.role !== "admin" && book.createdBy !== req.user.id) {
            return res.status(403).json({ error: "Not allowed" });
        }
        db.prepare(`
            UPDATE books SET title = ?, author = ?, year = ?, genre = ?, description = ? WHERE id = ? `).run(title, author, year, genre, description, id);

        return res.json({ message: "Updated successfully" });
    } catch (err) {
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
app.post("/api/books/:id/reviews", auth, (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        const book = db
            .prepare("SELECT * FROM books WHERE id = ?")
            .get(id);
        if (!book) {
            return res.status(404).json({ error: "Book not found" });
        }
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5" });
        }
        const existingReview = db
            .prepare("SELECT * FROM reviews WHERE bookId = ? AND userId = ?")
            .get(id, req.user.id);
        if (existingReview) {
            return res.status(400).json({ error: "You already reviewed this book" });
        }
        db.prepare(`
            INSERT INTO reviews (bookId, userId, rating, comment)
            VALUES (?, ?, ?, ?)
        `).run(id, req.user.id, rating, comment);
        return res.status(201).json({ message: "Review created" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed" });
    }
});
// Получить все отзывы к книге
app.get("/api/books/:id/reviews", (req, res) => {
     try {
        const { id } = req.params;
        const reviews = db.prepare(` SELECT reviews.*, users.username FROM reviews JOIN users ON reviews.userId = users.id WHERE reviews.bookId = ? `).all(id);
        return res.json(reviews);
        } catch (err) {
        return res.status(500).json({ error: "Failed" });
    }   
});   

app.delete("/api/reviews/:id", auth, (req, res) => {
    try {
        const { id } = req.params;
        const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }
        if (req.user.role !== "admin" && review.userId !== req.user.id) {
            return res.status(403).json({ error: "Not allowed" });
        }
        db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
        return res.json({ message: "Deleted" });
    } catch (err) {
        return res.status(500).json({ error: "Failed" });
    }
});

// Тетрадь позитива (все п)
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

app.delete("/api/admin/users/:id", auth, (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ error: "Not allowed" });
        }
        const { id } = req.params;
        db.prepare("DELETE FROM users WHERE id = ?").run(id);
        return res.json({ message: "User deleted" });
    } catch (err) {
        return res.status(500).json({ error: "Failed" });
    }
});

app.listen(PORT)