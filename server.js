//interactive connectivity establishment
//session traversal utilities for nat

import express from "express"
import fs from "fs"
import { Server } from "socket.io"
// import https from "https"
import http from "http"

const app = express()

// const key = fs.readFileSync('create-cert-key.pem')
// const cert = fs.readFileSync('create-cert.pem')

//we changed our express setup so we can use https
//pass the key and cert to createServer on https
//const expressServer = https.createServer({key, cert}, app);
const expressServer = http.createServer(app)
// app.listen(8181, '0.0.0.0', () => {
//   console.log("HTTP server running on port 8181");
// });
expressServer.listen(process.env.PORT|| 8080, "0.0.0.0", () => {
  console.log("Server running at http://0.0.0.0:8181");
});
//const expressServer = app.listen(8181);
//create our socket.io server... it will listen to our express port
// app.use((req, res, next) => {
//   res.setHeader(
//     "Content-Security-Policy",
//     "default-src 'self'; connect-src 'self' https://localhost:8181 wss://localhost:8181"
//   );
//   next();
// });
const io = new Server(expressServer,{
    cors: {
        origin : true,
        // origin: [
        //     // "*",
        //     'https://172.16.54.42' //if using a phone or another computer
        // ],
        methods: ["GET", "POST"]
    }
});
app.use(express.static('public'))
//expressServer.listen(8181);

const offers = [
        // offererUserName
    // offer
    // offerIceCandidates
    // answererUserName
    // answer
    // answererIceCandidates
]

const connectedSockets = [
    //username , socketId
]

io.on('connection',(socket)=>{
    // console.log("Someone has connected");
    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if(password !== "x"){
        socket.disconnect(true);
        return;
    }
    connectedSockets.push({
        socketId: socket.id,
        userName
    })
    console.log("connected sockets :-",connectedSockets)

    //a new client has joined. If there are any offers available,
    //emit them out
    if(offers.length){
        socket.emit('availableOffers',offers);
    }
    
    socket.on('newOffer',newOffer=>{
        offers.push({
            offererUserName: userName,
            offer: newOffer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: []
        })
        console.log("recieved offer");
        // console.log(newOffer.sdp.slice(50))
        //send out to all connected sockets EXCEPT the caller
        socket.broadcast.emit('newOfferAwaiting',offers.slice(-1))
    })

    socket.on('newAnswer',(offerObj,ackFunction)=>{
        //console.log(offerObj);
        console.log('recieved new answer ')
        //emit this answer (offerObj) back to CLIENT1
        //in order to do that, we need CLIENT1's socketid
        const socketToAnswer = connectedSockets.find(s=>s.userName === offerObj.offererUserName)
        if(!socketToAnswer){
            console.log("No matching socket")
            return;
        }
        //we found the matching socket, so we can emit to it!
        const socketIdToAnswer = socketToAnswer.socketId;
        //we find the offer to update so we can emit it
        const offerToUpdate = offers.find(o=>o.offererUserName === offerObj.offererUserName)
        if(!offerToUpdate){
            console.log("No OfferToUpdate")
            return;
        }
        //send back to the answerer all the iceCandidates we have already collected
        ackFunction(offerToUpdate.offerIceCandidates);
        console.log("offer ice candidate in newAnswer listener ,:-",offerToUpdate.offerIceCandidates)
        offerToUpdate.answer = offerObj.answer
        offerToUpdate.answererUserName = userName
        //socket has a .to() which allows emiting to a "room"
        //every socket has it's own room
        socket.to(socketIdToAnswer).emit('answerResponse',offerToUpdate)
    })

    socket.on('sendIceCandidateToSignalingServer',iceCandidateObj=>{
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;
        // console.log(iceCandidate);
        if(didIOffer){
            //this ice is coming from the offerer. Send to the answerer
            const offerInOffers = offers.find(o=>o.offererUserName === iceUserName);
            if(offerInOffers){
                
                offerInOffers.offerIceCandidates.push(iceCandidate)
                console.log("recieved ice candidate from client1")
                // 1. When the answerer answers, all existing ice candidates are sent
                // 2. Any candidates that come in after the offer has been answered, will be passed through
                if(offerInOffers.answererUserName){
                    //pass it through to the other socket
                    const socketToSendTo = connectedSockets.find(s=>s.userName === offerInOffers.answererUserName);
                    if(socketToSendTo){
                        console.log("recieved ice candidate from client1")
                        socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer',iceCandidate)
                        console.log("sent ice candidate to client 2")
                    }else{
                        console.log("Ice candidate recieved but could not find answere")
                    }
                }
            }else{
                return
            }
        }else{
            //this ice is coming from the answerer. Send to the offerer
            //pass it through to the other socket
            const offerInOffers = offers.find(o=>o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(s=>s.userName === offerInOffers.offererUserName);
            if(socketToSendTo){
                console.log("getting ice candidates from client 2")
                socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer',iceCandidate)
                console.log("sent ice candidates to client 1 from clinet 2")
            }else{
                console.log("Ice candidate recieved but could not find offerer")
            }
        }
        // console.log(offers)
    })

})

