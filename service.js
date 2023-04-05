const users = {};

exports.users = users;

exports.getUsername = function getUsername(ws)
{
  var username="";
  Object.keys(users).forEach(e => {
    if ( ws ===  users[e].ws )
      username = e;
  });
  return username;
}
