const mysql = require('mysql');

function getUser(req, res) {
  const id = req.query.id;
  // BLATANT SQL INJECTION in app code
  const query = `SELECT * FROM users WHERE id = ${id}`;
  connection.query(query, (err, results) => {
    res.json(results);
  });
}

module.exports = { getUser };
