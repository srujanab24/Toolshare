const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../toolshare.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'customer')),
    phone TEXT,
    address TEXT,
    avatar TEXT,
    is_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price_per_day REAL NOT NULL,
    deposit REAL DEFAULT 0,
    location TEXT,
    image TEXT,
    is_available INTEGER DEFAULT 1,
    condition TEXT DEFAULT 'Good',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    total_days INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','active','completed','cancelled')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tool_id) REFERENCES tools(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    booking_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tool_id) REFERENCES tools(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    tool_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS availability_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    blocked_date TEXT NOT NULL,
    reason TEXT,
    FOREIGN KEY (tool_id) REFERENCES tools(id)
  );
`);

// Seed demo data
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (userCount.cnt === 0) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('password123', 10);

  db.prepare(`INSERT INTO users (name, email, password, role, phone, address) VALUES (?,?,?,?,?,?)`).run('Rajan Kumar', 'owner@demo.com', hash, 'owner', '9876543210', 'Chennai, TN');
  db.prepare(`INSERT INTO users (name, email, password, role, phone, address) VALUES (?,?,?,?,?,?)`).run('Priya Sharma', 'customer@demo.com', hash, 'customer', '9123456789', 'Coimbatore, TN');

  const tools = [
    [1,'Bosch Drill Machine','Professional 13mm drill with hammer function and variable speed. Ideal for masonry, wood and metal.','Power Tools',100,500,'Chennai, TN','https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600','Good'],
    [1,'Hammer Set (5 pcs)','Complete set with claw hammer, ball peen, rubber mallet and more.','Hand Tools',50,200,'Chennai, TN','https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=600','Excellent'],
    [1,'Aluminium Ladder 8ft','Lightweight yet sturdy aluminium ladder for indoor/outdoor use.','Ladders',120,800,'Chennai, TN','https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600','Good'],
    [1,'Lawn Mower / Grass Cutter','Electric grass trimmer with 30m cord. Lightweight and easy to use.','Garden',150,600,'Chennai, TN','https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=600','Good'],
    [1,'Angle Grinder','900W angle grinder with safety guard. For cutting and grinding metal.','Power Tools',130,700,'Chennai, TN','https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600','Good'],
    [1,'Pressure Washer','High-pressure 1600PSI washer, ideal for cleaning driveways and walls.','Cleaning',200,1000,'Chennai, TN','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600','Excellent'],
  ];

  const ins = db.prepare(`INSERT INTO tools (owner_id,title,description,category,price_per_day,deposit,location,image,condition) VALUES (?,?,?,?,?,?,?,?,?)`);
  tools.forEach(t => ins.run(...t));
}

module.exports = db;
