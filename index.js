const express = require("express")
const db = require("./db")
const bcr = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cors = require("cors")
const app = express()

app.use(express.json())
app.use(cors())

const PORT = 3000
const SECRET = "asjdkasjdlkasdjkl"

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader) return res.status(401).json({ error: "Failed to provide token" })

    const token = authHeader.split(" ")[1]
    if (!token) return res.status(401).json({ error: "Token has invalid form" })

    try {
        const decoded = jwt.verify(token, SECRET)
        req.user = decoded
        next()
    } catch (error) {
        console.error(error)
        return res.status(403).json({ error: "Invalid token" })
    }
}

app.get("/", (req, res) => {
    return res.status(200).json({ text: "hello world" })
})

app.post("/auth/signin", (req, res) => {
    try {
        const { username, password } = req.body

        // проверьте есть ли username и password
        // если нет, то 400

        if (!username || !password) {
            return res.status(400).json({ error: "Missing data" })
        }

        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) // найти пользователя из бд
        if (!user) return res.status(401).json({ error: "Неправильный пароль" })
        // Вернуть 401 если юзера нет

        const valid = bcr.compareSync(password, user.password) // проверить через 
        // функцию bcr.compareSync
        if (!valid) return res.status(401).json({ error: "Неправильный пароль" })

        const { password: _, ...safeUser } = user

        const token = jwt.sign({ ...safeUser }, SECRET, { expiresIn: "24h" })
        res.status(201).json({ success: true, token, user: safeUser })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Something went wrong" })
    }
})
app.post("/auth/signup", (req, res) => {
    try {
        console.log(req.body);
        const { username, password, email } = req.body

        if (!username || !password) {
            return res.status(400).json({ error: "." })
        }

        if (username.length < 3) {
            return res.status(400).json({ error: "Недостаточно символов в пароле" })
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Недостаточно символов в пароле" })
        }

        const existing = db.prepare(
            "SELECT id FROM users WHERE username = ?"
        ).get(username)

        if (existing) return res.status(409).json({ error: "Пользователь уже существует" })

        const salt = bcr.genSaltSync(10)
        const hash = bcr.hashSync(password, salt)
        const role = "user"

        const info = db.prepare(`INSERT INTO users (username, email, password, role)
            VALUES(?,?,?,?)`).run(username.trim(), email.trim(), hash, role)

        const newUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid)

        const { password: _, ...safeUser } = newUser

        const token = jwt.sign({ ...safeUser }, SECRET, { expiresIn: "24h" })
        res.status(201).json({ success: true, token, user: safeUser })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "Failed to create" })
    }
})

app.get("/api/items", (req, res) => {
    try {
        const items = db.prepare(
            "SELECT * FROM items ORDER BY createAt DESC"
        ).all()

        return res.status(200).json(items)
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "Failed to fetch" })
    }
})

app.post("/api/items", auth, (req, res) => {
    // Я ЛЮБЛЮ КОГДА ВОЛОСАТЫЕ МУЖИКИ ОБМАЗЫВАЮТСЯ МАСЛОМ !!!
    // (c) Андрей Бардола 32ИСР
    try {
        const { title, description, price, imageUrl } = req.body

        if (!title || !title.trim()) {
            return res
                .status(400)
                .json({ error: "Нужно название" })
        }

        if (!description || !description.trim()) {
            return res
                .status(400)
                .json({ error: "Нужно описание" })
        }

        if (!price || price <= 0) {
            return res
                .status(400)
                .json({ error: "Нужна цена" })
        }

        const info = db.prepare(`
            INSERT INTO items (title, description, price, imageUrl, userId, username, status, highestBid, bidCount)
            VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, 0)
            `).run(title.trim(), description.trim(),
            parseFloat(price), imageUrl || null,
            req.user.id, req.user.username)

        const newItem = db
            .prepare("SELECT * FROM items WHERE id = ?")
            .get(info.lastInsertRowid)

        return res.status(201).json(newItem)
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "Failed to create" })
    }
})

app.delete("/api/items/:id", auth, (req, res) => {
    try {
        const { id } = req.params

        const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id)
        if (!item) return res.status(404).json({ error: "Товар не найден" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Something went wrong" })
    }
})

app.listen(PORT)