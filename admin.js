'use strict';

const { getChatList,insertChat,deleteChat } = require("./mysql");

module.exports = function()
{

router.get('/insert', cors(), async (req, res) => {
    console.log("insert chat");
    try 
    {
        if ( !req.query.chat) 
            throw new Error("chat id is required");
        if ( req.query.chat.length < 3 )
            throw new Error("Too short chat id.")
        if ( req.query.chat.length > 30 )
            throw new Error("Too long chat id.")
        const results = await getChatList();
        if ( results.find(e=>e.chat==req.query.chat))
            throw new Error("chat id "+req.query.chat+" is already reserved.");
        if ( results.filter(e=>e.user==req.user.email).length >= 5 )
            throw new Error("Maximum count of chats exceeded.")

        await insertChat(req.user.email,req.query.chat)
        res.json({error:false,msg:"Insert done."});
    } catch(err) {
        res.json({error:true, msg:err.message});
    }
});

router.get('/delete', cors(), async(req, res) => {
    console.log("delete chat");
    try 
    {
        if ( !req.query.chat) 
            throw new Error("no chat query");
        const results = await getChatList(req.user.email);
        if ( results.find(e=>e.chat==req.query.chat))
        {
            deleteChat(req.user.email,req.query.chat);
            res.json({error:false,msg:"Chat "+req.query.chat+" has deleted." });
        } 
        else 
            throw new Error("Chat not found");
    } catch(err) {
        res.json({error:true, msg:err.message});
    }
});

router.get('/chatlist', cors(), async(req, res) => {
    try {
    const results = await getChatList(req.user.email);
    console.log(results);
    res.json(results);
    } catch(err) {
        res.json({error:true, msg:err.message});
    }
});
}

