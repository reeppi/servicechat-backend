'use strict';

const express = require('express');
const { Server } = require('ws');
const PORT = process.env.PORT || 3001;
const INDEX = '/index.html';
global.cors = require('cors');
global.app = express();
global.router = express.Router();
global.passport = require('passport');

const { config } = require("./config");

const session = require('express-session');
app.use(session( { secret:config.sessionSecret,resave:true} ));
app.use(passport.initialize());
app.use(passport.session());
require('./passport');
app.use(cors()); 
const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));
const wss = new Server({ server });
const yup  = require("yup");
const jwt = require("jsonwebtoken");
const { users,getUsername } = require("./service");
const { SqlQuery,getSqlConn,getChatList } = require("./mysql");
router.get('/', cors(), (req, res) => res.sendFile(INDEX, { root: __dirname }) );
require('./auth')();
require('./admin')();
const checkAccess = (req, res, next) => {
  next();
}
const authOb = { session: false, failureRedirect : '/failureJson' }
app.use('/insert', passport.authenticate('jwt', authOb), checkAccess);
app.use('/delete', passport.authenticate('jwt', authOb), checkAccess);
app.use('/chatlist', passport.authenticate('jwt', authOb), checkAccess);
app.use("/",router);

const schemas = {
  "MSG": yup.object().shape( { msg: yup.string().required().max(100)}),
  "LOGIN": yup.object().shape( { chat: yup.string().required().max(40) }),
  "GETCHATLIST": yup.object().shape( { code: yup.string().required().max(600) }),
  "TOKEN": yup.object().shape( { code: yup.string().required().max(600), chat: yup.string().required().max(40) }),
  "MSGADMIN": yup.object().shape( { sender: yup.string().required().max(40), receiver: yup.string().required().max(40), msg: yup.string().required().max(200), }),
}

wss.on('connection', (ws) => {
  console.log('Client connected!');

  ws.on('close', () => { 
    try {
      var username = getUsername(ws);
      if (username)
      {
        console.log("Timeout launched for "+username);
        if ( !users[username].admin)
          users[username].timeOut=setTimeout(removeUser, 2000, username);
        else 
          delete users[username];
      }
    } catch (e)
    {
      console.log(e.message);
    }
    console.log("Client "+username+" disconnected ");
  });
  
  ws.on('message', async (msg) => { 
    try {
    const data=JSON.parse(msg);
    if ( !("event" in data ) )
      throw new Error("Ei event kenttää");
    if ( !("payload" in data ) )
      throw new Error("Ei payload kenttää");
       
    schemas[data.event].validateSync(data.payload);
    switch ( data.event )
      {
        case "LOGIN": 
            login(ws,data);
            break;
        case "MSG": 
            message(ws,data);
            break;
        case "MSGADMIN":
            messageAdmin(ws,data);
            break;
        case "GETCHATLIST":
            await chatList(ws,data);
            break;
        case "TOKEN": 
            await token(ws,data);
            break;
      }    
    } catch (e)
    {
      ws.send(JSON.stringify({event:"MSG", payload: { sender:"server", error:true, msg:e.message }}));
      console.log("main error : "+e.message);
    }
  
  });
});

function login(ws,data)
{
  var userCode="";
  var newCode=true;
  if ( data.payload.user != "" )
  {
    if ( users[data.payload.user] )
    {
    if ( users[data.payload.user].admin ) throw new Error("Admini!")
        console.log("Löytyi käyttäjä ei luoda uutta");
    if ( users[data.payload.user].timeOut)
      clearTimeout(users[data.payload.user].timeOut);

    users[data.payload.user]={ws,chat:data.payload.chat,admin:false};
    newCode=false;
    userCode=data.payload.user;
    }
  }
  if ( newCode )
  {
    userCode = randomString(10);
    //userCode = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 30);
    users[userCode]={ws,chat:data.payload.chat,admin:false};
  }

  console.log("Logged as guest "+ userCode );
  ws.send(JSON.stringify({event:"USER", payload: { sender:userCode }}));
  sendUsers(userCode,data.payload.chat);
  console.log(users[userCode].ws._socket.remoteAddress);
}

function message(ws,data)
{
  var time = getTime();
  ws.send(JSON.stringify({event:"MSG", payload: { msg:data.payload.msg, time }}));
  var user=getUsername(ws);
  if (user )
  {
    let chat=users[user].chat;
    console.log("chatti viesti -> "+ data.payload.msg + " -- "+chat); 
    // Lähetetään viesti kaikille chatin admineille
    Object.keys(users).forEach(e => {
      if ( chat ===  users[e].chat && users[e].admin )
      {
       
        users[e].ws.send(JSON.stringify({event:"MSG", payload: { sender:user, time, msg:data.payload.msg }}));
        console.log("Viesti lähetetty "+ e);
      }
      });
  }
}

function messageAdmin(ws,data)
{
  console.log("Message admin");
  var user=getUsername(ws);
  if ( users[user].admin )
  {
    if ( users[data.payload.receiver] )
    {
      let time = getTime();
      users[data.payload.receiver].ws.send(JSON.stringify({event:"MSG", payload: { sender:data.payload.sender, msg:data.payload.msg,time }}));
      ws.send(JSON.stringify({event:"MSG", payload: { sender:data.payload.receiver, msg:data.payload.msg,time }})); //Viesti myös takas adminille.
    } else {
      throw new Error("Vastaanottajaa "+data.payload.receiver+" ei ole");
    }
  } else {
    throw new Error("admin only");
  }
}

async function chatList(ws,data)
{
  const tokenLoad = jwt.verify(data.payload.code,config.SessionSecret);
  console.log("get chat list!");
  if ( !tokenLoad.email ) throw new Error("ChatList - User is not valid");

  const results = await getChatList(tokenLoad.email);
  ws.send(JSON.stringify({event:"CHATLIST", payload: { data:results }}));
}

async function token(ws,data)
{
  console.log(" ---> TOKEN");
  const tokenLoad = jwt.verify(data.payload.code,config.SessionSecret);
  console.log("Logging "+tokenLoad.email+" - chat:"+data.payload.chat);

  if ( !tokenLoad.email ) throw new Error("Token - User is not valid");
    
  var results = [];
  results = await getChatList(tokenLoad.email);
  for(let result of results)
    console.log(result["user"]+" - "+result["chat"]); 
      
  if ( !results.find(e=>e.chat == data.payload.chat) )
      throw new Error("TOKEN, chat, User is not valid "+ data.payload.chat)

  console.log("homma skulaa");
  users[tokenLoad.email]={ws,chat:data.payload.chat,admin:true};
  sendUsers("server",data.payload.chat);

  ws.send(JSON.stringify({event:"CHATLIST", payload: { data:results }}));
}

//tällä funktiolla lähetetään kaikille chatin admineille käytttäjät
function sendUsers(sender,chat)
{
  Object.keys(users).forEach(e => {
    if ( chat ===  users[e].chat && users[e].admin )
    {
      let usersInChatOb = Object.keys(users).filter(x => users[x].chat == chat && !users[x].admin).map(e=>{ return {id:e,address:users[e].ws._socket.remoteAddress}});
      users[e].ws.send(JSON.stringify({event:"USERS", payload: { sender, users:usersInChatOb }}));
      console.log(usersInChatOb);
    }
  });
}

function removeUser(username)
{
  if ( users[username] )
  {
    let chat = users[username].chat;
    delete users[username];
    sendUsers(username,chat);
    console.log("User removed "+username);
  }
}

function randomString(len, charSet) {
  charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var randomString = '';
  for (var i = 0; i < len; i++) {
      var randomPoz = Math.floor(Math.random() * charSet.length);
      randomString += charSet.substring(randomPoz,randomPoz+1);
  }
  return randomString;
}

function getTime()
{
  let dateOb = new Date();
  let hours = dateOb.getHours();
  let minutes = dateOb.getMinutes();
  if ( minutes < 10 ) minutes ="0"+minutes;
  let time=hours+":"+minutes;
  return time;
}


/*
setInterval(() => {
  wss.clients.forEach((client) => {
    client.send( JSON.stringify( { event:"MSG", payload: { sender:"server", msg: new Date().toTimeString()}   })  );
  });
}, 10000);
*/

