const { exec } = require('child_process');

function runCmd(req, res) {
  // BLATANT COMMAND INJECTION in app code
  exec('ls ' + req.query.dir, (err, stdout) => {
    res.send(stdout);
  });
}

module.exports = { runCmd };
