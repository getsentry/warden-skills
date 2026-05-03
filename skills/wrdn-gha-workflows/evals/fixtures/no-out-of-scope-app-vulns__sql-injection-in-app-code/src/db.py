import sqlite3

def get_user(conn, user_id):
    # Classic SQL injection - string concatenation
    query = "SELECT * FROM users WHERE id = '" + user_id + "'"
    cur = conn.cursor()
    cur.execute(query)
    return cur.fetchone()

def login(conn, username, password):
    q = f"SELECT * FROM users WHERE name='{username}' AND pw='{password}'"
    return conn.execute(q).fetchone()
