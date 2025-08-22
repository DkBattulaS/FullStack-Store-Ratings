# 📌 FullStack Store Ratings

A full-stack web application for submitting and managing store ratings with **role-based access control**.

---

## 🚀 Tech Stack
- **Backend:** Express.js  
- **Frontend:** React.js  
- **Database:** PostgreSQL

---

## ✨ Features

### 👨‍💻 System Administrator
- Add new stores, normal users, and admin users.  
- Dashboard showing total users, stores, and ratings.  
- View and filter lists of users and stores.  
- Add new users with detailed information.  

### 👥 Normal User
- Sign up, log in, and update password.  
- View and search registered stores.  
- Submit and modify ratings (1–5) for stores.  

### 🏪 Store Owner
- Log in and update password.  
- View users who rated their store.  
- See average store rating.  

---

## 🏗️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://https://github.com/DkBattulaS/FullStack-Store-Ratings/.git
cd rating-stores-app


2️⃣ Backend Setup
cd backend
npm install
npm run dev


Configure database in .env file:

DB_HOST=localhost
DB_USER=your_username
DB_PASS=your_password
DB_NAME=store_ratings

3️⃣ Frontend Setup
cd frontend
npm install
npm start

📂 Project Structure
rating-stores-app/
 ├── backend/        # Express/Nest backend API
 ├── frontend/       # React frontend
 ├── database/       # SQL schema / migrations
 ├── README.md
 └── .gitignore


