'use strict';

const mysql = require('mysql');
const { config } = require("./config");

const pool = mysql.createPool({
    connectionLimit : 1,
    host     : config.sqlhost,
    user     : config.sqluser,
    password : config.sqlpassword,
    database : config.sqldatabase,
    connectTimeout: 5000
  });
  
  pool.on('acquire', function (connection) {
    console.log('Connection %d acquired', connection.threadId);
  });  

  exports.getSqlConn = function() {
    return new Promise(function(resolve, reject) {
        pool.getConnection( function(err,connection)
        {
            if (err) reject(err); 
            else resolve(connection);
        });
    });
  };

  exports.SqlQuery = function (conn,query,values) {
    return new Promise(function(resolve, reject) {
        conn.query(query,values, function (err, results, fields)
        {
            if (err) reject(err); 
            else resolve(results);
        });
    });
  }

  exports.getChatList = async function (username)
  {
    var skipSQL=false;
    var results= [];
    try  
    {
    if ( !skipSQL ) 
    {
      var conn = await exports.getSqlConn();
      if (username)
        results = await exports.SqlQuery(conn,'SELECT chat,user FROM ausers WHERE user=?',[username]);
      else
        results = await exports.SqlQuery(conn,'SELECT chat,user FROM ausers');
    } else {
      results=[{chat:"test"},{chat:"test2"}];
    }
    return results;
    } catch(err) { handleError(err);}
    finally { if (conn) { console.log("Release!"); conn.release(); }}
  }

  exports.insertChat = async function (username,chat)
  {
    try  
    {
      var conn = await exports.getSqlConn();
      await exports.SqlQuery(conn,'INSERT INTO ausers (chat,user) VALUES (?,?)',[chat,username]);
    } catch(err) { handleError(err);}
    finally { if (conn) { console.log("Release!"); conn.release(); }}
  }

  exports.deleteChat = async function (username,chat)
  {
    try  
    {
      var conn = await exports.getSqlConn();
      await exports.SqlQuery(conn,'DELETE FROM ausers WHERE chat=? AND user=?',[chat,username]);
    } catch(err) { handleError(err);}
    finally { if (conn) { console.log("Release!"); conn.release(); }}
  }

  function handleError(err) {  
    if ( err.sqlMessage ) 
      throw new Error(err.sqlMessage);
    else
      throw new Error(err.message);
  }
  








