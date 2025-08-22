# FullStack Store Ratings

A full-stack web application for submitting and managing store ratings with role-based access control.

## Tech Stack
- **Backend:** ExpressJs / Loopback / NestJs
- **Frontend:** ReactJs
- **Database:** PostgreSQL / MySQL

## Features

### User Roles
1. **System Administrator**
   - Add new stores, normal users, and admin users.
   - Dashboard showing total users, stores, and ratings.
   - View and filter lists of users and stores.
   - Add new users with detailed information.

2. **Normal User**
   - Sign up, log in, and update password.
   - View and search registered stores.
   - Submit and modify ratings (1-5) for stores.

3. **Store Owner**
   - Log in and update password.
   - View users who rated their store.
   - See average store rating.

### Form Validations
- **Name:** 20-60 characters
- **Address:** Max 400 characters
- **Password:** 8-16 characters, must include one uppercase letter and one special character
- **Email:** Must follow standard email format

### Additional Notes
- Tables support sorting (ascending/descending) for key fields.
- Follows best practices for frontend, backend, and database design.
